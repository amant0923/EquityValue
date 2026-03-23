"""Routes for AI portfolio builder — build and optimize endpoints."""
from __future__ import annotations

import logging
from typing import Literal

import numpy as np
import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from supabase import create_client

from auth import get_current_user, get_user_profile
from portfolio_builder import (
    get_sector_template,
    select_stocks,
    _build_allocation,
    STOCK_COUNT_RANGES,
)
from rate_limit import limiter
from routes.portfolio import PORTFOLIO_LIMITS

logger = logging.getLogger(__name__)

from config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY or SUPABASE_KEY)

router = APIRouter()


# ── Request models ────────────────────────────────────────────────────

class BuildRequest(BaseModel):
    risk_score: int = Field(..., ge=1, le=100)
    profile: Literal[
        "conservative",
        "moderately_conservative",
        "moderate",
        "moderately_aggressive",
        "aggressive",
    ]
    stock_count: Literal["small", "medium", "large"]
    investment_amount: float = Field(..., ge=1000)
    name: str = Field("", max_length=50)
    confirm: bool = False


class OptimizeRequest(BaseModel):
    tickers: list[str] = Field(..., min_length=2, max_length=50)
    risk_score: int = Field(..., ge=1, le=100)
    profile: Literal[
        "conservative",
        "moderately_conservative",
        "moderate",
        "moderately_aggressive",
        "aggressive",
    ]
    method: Literal["mean_variance", "hrp"] = "mean_variance"
    investment_amount: float = Field(..., ge=1000)
    max_position: float | None = Field(None, ge=0.01, le=0.25)
    name: str = Field("", max_length=50)
    confirm: bool = False


# ── Helpers ───────────────────────────────────────────────────────────

def _fetch_evs_data() -> dict[str, dict]:
    """Fetch EVS scores joined with fundamentals. Returns {ticker: {...}}."""
    evs_rows = (
        supabase.table("equity_value_scores")
        .select("ticker, score, verdict")
        .execute()
        .data or []
    )
    fund_rows = (
        supabase.table("stock_fundamentals")
        .select("ticker, name, sector, current_price, market_cap")
        .execute()
        .data or []
    )
    fund_map = {r["ticker"]: r for r in fund_rows}

    result: dict[str, dict] = {}
    for row in evs_rows:
        t = row["ticker"]
        fund = fund_map.get(t)
        if not fund or not fund.get("current_price"):
            continue
        result[t] = {
            "name": fund.get("name", t),
            "sector": fund.get("sector", "Unknown"),
            "current_price": float(fund["current_price"]),
            "market_cap": fund.get("market_cap"),
            "evs_score": row["score"],
        }
    return result


def _fetch_returns(tickers: list[str], period: str = "1y") -> np.ndarray | None:
    """Download daily returns via yfinance. Returns T x N array or None if < 60 rows."""
    try:
        df = yf.download(tickers, period=period, auto_adjust=True, progress=False)
        if df.empty:
            return None
        # yf.download returns MultiIndex columns when multiple tickers
        if isinstance(df.columns, __import__("pandas").MultiIndex):
            prices = df["Close"]
        else:
            prices = df[["Close"]]
            prices.columns = tickers[:1]
        # Drop tickers with all NaN
        prices = prices.dropna(axis=1, how="all")
        prices = prices.ffill().dropna()
        if prices.shape[0] < 60:
            return None
        returns = prices.pct_change().dropna().values
        return returns if returns.shape[0] >= 60 else None
    except Exception as e:
        logger.error("yfinance download failed: %s", e)
        return None


def _create_portfolio_with_holdings(
    user_id: str, name: str, allocations: list[dict]
) -> str:
    """Insert portfolio + holdings rows. Returns portfolio_id."""
    portfolio_name = name.strip() or "AI Portfolio"
    result = (
        supabase.table("user_portfolios")
        .insert({"user_id": user_id, "name": portfolio_name})
        .execute()
    )
    portfolio_id = result.data[0]["id"]

    holdings = [
        {
            "portfolio_id": portfolio_id,
            "ticker": a["ticker"],
            "shares": a["shares"],
            "avg_price": a["avg_price"],
        }
        for a in allocations
        if a["shares"] > 0
    ]
    if holdings:
        supabase.table("portfolio_holdings").insert(holdings).execute()

    return portfolio_id


# ── Routes ────────────────────────────────────────────────────────────

@router.post("/portfolio/build")
@limiter.limit("5/minute")
async def build_portfolio(request: Request, body: BuildRequest, user: dict = Depends(get_current_user)):
    """Build an optimised portfolio from EVS data and risk profile.

    When confirm=False (default), returns a preview of the allocation.
    When confirm=True, creates the portfolio and holdings in the database.
    """
    user_id = user["sub"]

    # Check portfolio limit if confirming
    if body.confirm:
        profile = await get_user_profile(user_id)
        plan = profile.get("plan", "free")
        max_portfolios = PORTFOLIO_LIMITS.get(plan, PORTFOLIO_LIMITS["free"])[0]
        existing = (
            supabase.table("user_portfolios")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        if (existing.count or 0) >= max_portfolios:
            raise HTTPException(
                403, f"Portfolio limit reached ({max_portfolios}). Upgrade your plan."
            )

    # Fetch EVS universe
    evs_data = _fetch_evs_data()
    if not evs_data:
        raise HTTPException(503, "EVS data unavailable. Try again later.")

    # Select stocks via sector template
    sector_template = get_sector_template(body.profile)
    evs_list = [
        {"ticker": t, "sector": d["sector"], "score": d["evs_score"], "price": d["current_price"]}
        for t, d in evs_data.items()
    ]
    selected = select_stocks(sector_template, body.stock_count, evs_list)
    if not selected:
        raise HTTPException(500, "Stock selection returned no results.")

    tickers = [s["ticker"] for s in selected]

    # Fetch historical returns
    returns = _fetch_returns(tickers)
    if returns is None:
        raise HTTPException(503, "Insufficient price history for selected stocks.")

    # Align tickers with returns columns (yfinance may drop some)
    if returns.shape[1] < len(tickers):
        # Re-download to get the actual column order
        import pandas as pd

        df = yf.download(tickers, period="1y", auto_adjust=True, progress=False)
        if isinstance(df.columns, pd.MultiIndex):
            available = list(df["Close"].dropna(axis=1, how="all").columns)
        else:
            available = tickers[:1]
        tickers = [t for t in tickers if t in available]
        returns = _fetch_returns(tickers)
        if returns is None or len(tickers) < 2:
            raise HTTPException(503, "Insufficient price history after filtering.")

    prices = {t: evs_data[t]["current_price"] for t in tickers}

    allocation = _build_allocation(
        tickers=tickers,
        evs_data={t: {"score": evs_data[t]["evs_score"], "sector": evs_data[t]["sector"]} for t in tickers},
        returns_data=returns,
        prices=prices,
        profile=body.profile,
        investment_amount=body.investment_amount,
        method="auto",
    )

    portfolio_id = None
    if body.confirm:
        portfolio_id = _create_portfolio_with_holdings(
            user_id, body.name, allocation["allocations"]
        )

    return {
        "portfolio_id": portfolio_id,
        "investment_amount": body.investment_amount,
        **allocation,
    }


@router.post("/portfolio/optimize")
@limiter.limit("5/minute")
async def optimize_portfolio(request: Request, body: OptimizeRequest, user: dict = Depends(get_current_user)):
    """Optimize a user-supplied list of tickers using mean-variance or HRP.

    Pro+ only. When confirm=False, returns a preview. When confirm=True, creates the portfolio.
    """
    user_id = user["sub"]

    # Pro+ gate
    profile = await get_user_profile(user_id)
    plan = profile.get("plan", "free")
    if plan == "free":
        raise HTTPException(403, "Portfolio optimization requires a Pro or Max plan.")

    # Check portfolio limit if confirming
    if body.confirm:
        max_portfolios = PORTFOLIO_LIMITS.get(plan, PORTFOLIO_LIMITS["free"])[0]
        existing = (
            supabase.table("user_portfolios")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        if (existing.count or 0) >= max_portfolios:
            raise HTTPException(
                403, f"Portfolio limit reached ({max_portfolios}). Upgrade your plan."
            )

    # Normalise tickers
    tickers = [t.upper().strip() for t in body.tickers]

    # Validate tickers against EVS data
    evs_data = _fetch_evs_data()
    if not evs_data:
        raise HTTPException(503, "EVS data unavailable. Try again later.")

    missing = [t for t in tickers if t not in evs_data]
    if missing:
        raise HTTPException(400, f"Unknown tickers: {', '.join(missing[:10])}")

    # Fetch returns
    returns = _fetch_returns(tickers)
    if returns is None:
        raise HTTPException(503, "Insufficient price history for the requested tickers.")

    # Handle dropped tickers from yfinance
    if returns.shape[1] < len(tickers):
        import pandas as pd

        df = yf.download(tickers, period="1y", auto_adjust=True, progress=False)
        if isinstance(df.columns, pd.MultiIndex):
            available = list(df["Close"].dropna(axis=1, how="all").columns)
        else:
            available = tickers[:1]
        tickers = [t for t in tickers if t in available]
        returns = _fetch_returns(tickers)
        if returns is None or len(tickers) < 2:
            raise HTTPException(503, "Insufficient price history after filtering.")

    # Map API method names to internal optimizer names
    method_map = {"mean_variance": "gmv", "hrp": "hrp"}
    internal_method = method_map[body.method]

    prices = {t: evs_data[t]["current_price"] for t in tickers}

    allocation = _build_allocation(
        tickers=tickers,
        evs_data={t: {"score": evs_data[t]["evs_score"], "sector": evs_data[t]["sector"]} for t in tickers},
        returns_data=returns,
        prices=prices,
        profile=body.profile,
        investment_amount=body.investment_amount,
        method=internal_method,
        max_position_override=body.max_position,
    )

    portfolio_id = None
    if body.confirm:
        portfolio_id = _create_portfolio_with_holdings(
            user_id, body.name, allocation["allocations"]
        )

    return {
        "portfolio_id": portfolio_id,
        "investment_amount": body.investment_amount,
        **allocation,
    }
