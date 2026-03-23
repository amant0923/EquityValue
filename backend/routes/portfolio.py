"""Routes for portfolio management — all endpoints require auth."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import get_current_user, get_user_profile
from rate_limit import limiter
from db import get_supabase_service

def _sb():
    """Get service-role Supabase client (bypasses RLS — auth checked via get_current_user)."""
    sb = get_supabase_service()
    if not sb:
        raise HTTPException(503, "Database not configured")
    return sb

router = APIRouter()

# Tier limits: {plan: (max_portfolios, max_holdings_per_portfolio)}
PORTFOLIO_LIMITS = {
    "free": (1, 5),
    "pro": (5, 25),
    "max": (999999, 999999),
}


# ── Request models ──────────────────────────────────────────────

class CreatePortfolioRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)

class AddHoldingRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=10)
    shares: float = Field(..., gt=0)
    avg_price: float = Field(..., gt=0)

class EditHoldingRequest(BaseModel):
    shares: float | None = Field(None, gt=0)
    avg_price: float | None = Field(None, gt=0)


# ── Helpers ─────────────────────────────────────────────────────

async def _get_limits(user_id: str):
    """Return (max_portfolios, max_holdings) for user's plan."""
    profile = await get_user_profile(user_id)
    plan = profile.get("plan", "free")
    return PORTFOLIO_LIMITS.get(plan, PORTFOLIO_LIMITS["free"])


async def _verify_portfolio_owner(portfolio_id: str, user_id: str):
    """Raise 404 if portfolio doesn't exist or isn't owned by user."""
    result = _sb().table("user_portfolios") \
        .select("id") \
        .eq("id", portfolio_id) \
        .eq("user_id", user_id) \
        .execute()
    if not result.data:
        raise HTTPException(404, "Portfolio not found")


# ── Portfolio CRUD ──────────────────────────────────────────────

@router.get("/portfolio")
@limiter.limit("30/minute")
async def list_portfolios(request: Request, user: dict = Depends(get_current_user)):
    """List all portfolios for the current user with holding counts."""
    user_id = user["sub"]
    portfolios = _sb().table("user_portfolios") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("created_at") \
        .execute().data or []

    # Attach holding count to each portfolio
    for p in portfolios:
        count = _sb().table("portfolio_holdings") \
            .select("id", count="exact") \
            .eq("portfolio_id", p["id"]) \
            .execute()
        p["holding_count"] = count.count if count.count is not None else 0

    max_portfolios, max_holdings = await _get_limits(user_id)
    return {
        "portfolios": portfolios,
        "limits": {"max_portfolios": max_portfolios, "max_holdings": max_holdings},
    }


@router.post("/portfolio")
@limiter.limit("30/minute")
async def create_portfolio(request: Request, body: CreatePortfolioRequest, user: dict = Depends(get_current_user)):
    """Create a new portfolio."""
    user_id = user["sub"]
    max_portfolios, _ = await _get_limits(user_id)

    # Check limit
    existing = _sb().table("user_portfolios") \
        .select("id", count="exact") \
        .eq("user_id", user_id) \
        .execute()
    if (existing.count or 0) >= max_portfolios:
        raise HTTPException(403, f"Portfolio limit reached ({max_portfolios}). Upgrade your plan.")

    result = _sb().table("user_portfolios") \
        .insert({"user_id": user_id, "name": body.name.strip()}) \
        .execute()
    return result.data[0]


@router.delete("/portfolio/{portfolio_id}")
@limiter.limit("30/minute")
async def delete_portfolio(request: Request, portfolio_id: str, user: dict = Depends(get_current_user)):
    """Delete a portfolio and all its holdings/snapshots (cascade)."""
    await _verify_portfolio_owner(portfolio_id, user["sub"])
    _sb().table("user_portfolios").delete().eq("id", portfolio_id).execute()
    return {"ok": True}


# ── Holdings CRUD ───────────────────────────────────────────────

@router.get("/portfolio/{portfolio_id}/holdings")
@limiter.limit("30/minute")
async def list_holdings(request: Request, portfolio_id: str, user: dict = Depends(get_current_user)):
    """List all holdings in a portfolio."""
    await _verify_portfolio_owner(portfolio_id, user["sub"])
    holdings = _sb().table("portfolio_holdings") \
        .select("*") \
        .eq("portfolio_id", portfolio_id) \
        .order("added_at") \
        .execute().data or []
    return holdings


@router.post("/portfolio/{portfolio_id}/holdings")
@limiter.limit("30/minute")
async def add_holding(request: Request, portfolio_id: str, body: AddHoldingRequest, user: dict = Depends(get_current_user)):
    """Add a holding to a portfolio."""
    user_id = user["sub"]
    await _verify_portfolio_owner(portfolio_id, user_id)
    _, max_holdings = await _get_limits(user_id)

    # Check holding limit
    existing = _sb().table("portfolio_holdings") \
        .select("id", count="exact") \
        .eq("portfolio_id", portfolio_id) \
        .execute()
    if (existing.count or 0) >= max_holdings:
        raise HTTPException(403, f"Holding limit reached ({max_holdings}). Upgrade your plan.")

    # Validate ticker exists in S&P 500
    ticker = body.ticker.upper().strip()
    check = _sb().table("stock_fundamentals") \
        .select("ticker") \
        .eq("ticker", ticker) \
        .execute()
    if not check.data:
        raise HTTPException(400, f"Ticker {ticker} not found in S&P 500")

    try:
        result = _sb().table("portfolio_holdings") \
            .insert({
                "portfolio_id": portfolio_id,
                "ticker": ticker,
                "shares": body.shares,
                "avg_price": body.avg_price,
            }).execute()
        return result.data[0]
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(409, f"{ticker} already in this portfolio. Edit the existing holding instead.")
        raise


@router.put("/portfolio/{portfolio_id}/holdings/{holding_id}")
@limiter.limit("30/minute")
async def edit_holding(request: Request, portfolio_id: str, holding_id: str, body: EditHoldingRequest, user: dict = Depends(get_current_user)):
    """Edit shares and/or avg_price of a holding."""
    await _verify_portfolio_owner(portfolio_id, user["sub"])

    updates = {}
    if body.shares is not None:
        updates["shares"] = body.shares
    if body.avg_price is not None:
        updates["avg_price"] = body.avg_price
    if not updates:
        raise HTTPException(400, "Nothing to update")

    result = _sb().table("portfolio_holdings") \
        .update(updates) \
        .eq("id", holding_id) \
        .eq("portfolio_id", portfolio_id) \
        .execute()
    if not result.data:
        raise HTTPException(404, "Holding not found")
    return result.data[0]


@router.delete("/portfolio/{portfolio_id}/holdings/{holding_id}")
@limiter.limit("30/minute")
async def delete_holding(request: Request, portfolio_id: str, holding_id: str, user: dict = Depends(get_current_user)):
    """Remove a holding from a portfolio."""
    await _verify_portfolio_owner(portfolio_id, user["sub"])
    _sb().table("portfolio_holdings").delete() \
        .eq("id", holding_id) \
        .eq("portfolio_id", portfolio_id) \
        .execute()
    return {"ok": True}


# ── Live P&L ────────────────────────────────────────────────────

@router.get("/portfolio/{portfolio_id}/live")
@limiter.limit("30/minute")
async def get_live_pnl(request: Request, portfolio_id: str, user: dict = Depends(get_current_user)):
    """Fetch current prices and calculate live P&L for all holdings."""
    await _verify_portfolio_owner(portfolio_id, user["sub"])

    holdings = _sb().table("portfolio_holdings") \
        .select("*") \
        .eq("portfolio_id", portfolio_id) \
        .execute().data or []

    if not holdings:
        return {"holdings": [], "total_value": 0, "total_cost": 0, "total_pnl": 0, "total_pnl_pct": 0}

    # Fetch current prices in one query
    tickers = [h["ticker"] for h in holdings]
    prices_result = _sb().table("stock_fundamentals") \
        .select("ticker, current_price, name") \
        .in_("ticker", tickers) \
        .execute().data or []
    price_map = {r["ticker"]: r for r in prices_result}

    enriched = []
    total_value = 0
    total_cost = 0

    for h in holdings:
        price_data = price_map.get(h["ticker"], {})
        current_price = float(price_data.get("current_price") or 0)
        shares = float(h["shares"])
        avg_price = float(h["avg_price"])

        market_value = shares * current_price
        cost_basis = shares * avg_price
        pnl = market_value - cost_basis
        pnl_pct = ((current_price - avg_price) / avg_price * 100) if avg_price > 0 else 0

        total_value += market_value
        total_cost += cost_basis

        enriched.append({
            "id": h["id"],
            "ticker": h["ticker"],
            "name": price_data.get("name", h["ticker"]),
            "shares": shares,
            "avg_price": avg_price,
            "current_price": current_price,
            "market_value": round(market_value, 2),
            "cost_basis": round(cost_basis, 2),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
        })

    # Calculate weights
    for item in enriched:
        item["weight"] = round((item["market_value"] / total_value * 100) if total_value > 0 else 0, 2)

    total_pnl = total_value - total_cost
    total_pnl_pct = ((total_value - total_cost) / total_cost * 100) if total_cost > 0 else 0

    return {
        "holdings": enriched,
        "total_value": round(total_value, 2),
        "total_cost": round(total_cost, 2),
        "total_pnl": round(total_pnl, 2),
        "total_pnl_pct": round(total_pnl_pct, 2),
    }


# ── Snapshots ───────────────────────────────────────────────────

@router.get("/portfolio/{portfolio_id}/snapshots")
@limiter.limit("30/minute")
async def get_snapshots(request: Request, portfolio_id: str, days: str = "90", user: dict = Depends(get_current_user)):
    """Get historical portfolio snapshots for P&L chart."""
    await _verify_portfolio_owner(portfolio_id, user["sub"])

    query = _sb().table("portfolio_snapshots") \
        .select("*") \
        .eq("portfolio_id", portfolio_id) \
        .order("snapshot_date")

    if days != "all":
        from datetime import date, timedelta
        try:
            days_int = int(days)
        except ValueError:
            raise HTTPException(400, "Invalid days parameter")
        if days_int < 1 or days_int > 3650:  # Max ~10 years
            raise HTTPException(400, "Days must be between 1 and 3650")
        cutoff = (date.today() - timedelta(days=days_int)).isoformat()
        query = query.gte("snapshot_date", cutoff)

    snapshots = query.execute().data or []
    return snapshots
