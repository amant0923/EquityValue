"""Corporate governance API endpoints."""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from config import validate_ticker, FMP_KEY
from auth import get_current_user
from redis_cache import cache_get, cache_set
from db import get_supabase_service

try:
    from rate_limit import limiter
except Exception:
    limiter = None

router = APIRouter(prefix="/governance")

# ── FMP helpers (lazy import to avoid SystemExit when FMP_KEY is unset) ──────

_fmp_loaded = False
_fmp_get_list = None
_fmp_get_first = None


def _ensure_fmp():
    global _fmp_loaded, _fmp_get_list, _fmp_get_first
    if _fmp_loaded:
        return
    try:
        from fmp_client import fmp_get_list, fmp_get_first
        _fmp_get_list = fmp_get_list
        _fmp_get_first = fmp_get_first
    except SystemExit:
        _fmp_get_list = None
        _fmp_get_first = None
    _fmp_loaded = True


def _fmp_list(endpoint: str, params: dict) -> list:
    _ensure_fmp()
    if _fmp_get_list is None:
        return []
    try:
        return _fmp_get_list(endpoint, params)
    except Exception as e:
        print(f"[governance] FMP list error ({endpoint}): {e}")
        return []


def _fmp_first(endpoint: str, params: dict) -> dict | None:
    _ensure_fmp()
    if _fmp_get_first is None:
        return None
    try:
        return _fmp_get_first(endpoint, params)
    except Exception as e:
        print(f"[governance] FMP first error ({endpoint}): {e}")
        return None


# ── Board-member title detection ─────────────────────────────────────────────

_BOARD_KEYWORDS = ("director", "board", "chairman", "chairwoman")


def _is_board_member(title: str) -> bool:
    if not title:
        return False
    lower = title.lower()
    return any(kw in lower for kw in _BOARD_KEYWORDS)


# ── Main endpoint ────────────────────────────────────────────────────────────

def _governance_limiter(func):
    """Apply rate limit decorator only if limiter is available."""
    if limiter is not None:
        return limiter.limit("30/minute")(func)
    return func


@router.get("/{ticker}")
@_governance_limiter
async def get_governance(
    request: Request,
    ticker: str,
    user: dict = Depends(get_current_user),
):
    """Corporate governance: executives, board, institutional holders,
    insider sentiment, compensation, and capital structure."""

    ticker = validate_ticker(ticker)

    # ── Cache check ──────────────────────────────────────────────────────
    cache_key = f"gov:{ticker}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    params = {"apikey": FMP_KEY}

    # ── FMP: key executives ──────────────────────────────────────────────
    raw_execs = _fmp_list(f"key-executives/{ticker}", params)

    executives = []
    board = []
    for ex in raw_execs:
        entry = {
            "name": ex.get("name", ""),
            "title": ex.get("title", ""),
            "pay": ex.get("pay"),
            "age": ex.get("age"),
            "year_born": ex.get("yearBorn"),
            "gender": ex.get("gender", ""),
        }
        if _is_board_member(entry["title"]):
            board.append({"name": entry["name"], "title": entry["title"], "gender": entry["gender"]})
        else:
            executives.append(entry)

    # Board stats
    total_board = len(board)
    female_board = sum(1 for b in board if (b.get("gender") or "").lower() == "female")
    board_stats = {
        "total_members": total_board,
        "female_count": female_board,
        "female_pct": round(female_board / total_board * 100, 1) if total_board > 0 else 0,
    }

    # ── FMP: institutional holders ───────────────────────────────────────
    raw_holders = _fmp_list(f"institutional-holder/{ticker}", params)

    # ── Supabase: fundamentals for shares_outstanding & capital structure ─
    sb = get_supabase_service()
    shares_outstanding = None
    market_cap = None
    total_debt_fund = None
    total_cash_fund = None
    current_price = None

    if sb:
        try:
            fund_row = (
                sb.table("stock_fundamentals")
                .select("market_cap, shares_outstanding, total_debt, total_cash, current_price")
                .eq("ticker", ticker)
                .limit(1)
                .execute()
                .data
            )
            if fund_row:
                f = fund_row[0]
                shares_outstanding = f.get("shares_outstanding")
                market_cap = f.get("market_cap")
                total_debt_fund = f.get("total_debt")
                total_cash_fund = f.get("total_cash")
                current_price = f.get("current_price")
        except Exception as e:
            print(f"[governance] fundamentals query error: {e}")

    # Map institutional holders
    institutional_holders = []
    for h in raw_holders[:10]:
        shares = h.get("shares") or 0
        weight = round(shares / shares_outstanding * 100, 2) if shares_outstanding and shares_outstanding > 0 else None
        institutional_holders.append({
            "holder_name": h.get("holder", ""),
            "shares": shares,
            "weight_pct": weight,
            "change": h.get("change"),
            "date_reported": h.get("dateReported"),
        })

    # ── Supabase: balance sheet for capital structure ─────────────────────
    total_equity = None
    total_debt_bs = None
    total_assets = None

    if sb:
        try:
            bs_rows = (
                sb.table("financial_statements")
                .select("total_equity, total_debt, total_assets")
                .eq("ticker", ticker)
                .eq("statement_type", "balance_sheet")
                .order("period_date", desc=True)
                .limit(1)
                .execute()
                .data
            )
            if bs_rows:
                bs = bs_rows[0]
                total_equity = bs.get("total_equity")
                total_debt_bs = bs.get("total_debt")
                total_assets = bs.get("total_assets")
        except Exception as e:
            print(f"[governance] balance sheet query error: {e}")

    # Prefer balance-sheet debt over fundamentals debt
    total_debt = total_debt_bs if total_debt_bs is not None else total_debt_fund
    total_cash = total_cash_fund or 0

    # Capital structure computation
    capital_structure = {}
    if total_debt is not None and total_equity is not None:
        total_capital = (total_debt or 0) + (total_equity or 0)
        debt_pct = round(total_debt / total_capital * 100, 1) if total_capital > 0 else 0
        equity_pct = round(total_equity / total_capital * 100, 1) if total_capital > 0 else 0
        net_debt = (total_debt or 0) - total_cash
        ev = (market_cap or 0) + net_debt if market_cap else None

        capital_structure = {
            "debt_pct": debt_pct,
            "equity_pct": equity_pct,
            "total_debt": total_debt,
            "total_equity": total_equity,
            "total_capital": total_capital,
            "market_cap": market_cap,
            "net_debt": net_debt,
            "enterprise_value": ev,
        }

    # ── Supabase: insider sentiment (last 90 days) ───────────────────────
    insider_sentiment = {"net_buys_shares": 0, "net_sells_shares": 0, "net_sentiment": "neutral"}

    if sb:
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%d")
            insider_rows = (
                sb.table("insider_trades")
                .select("transaction_type, shares_traded")
                .eq("ticker", ticker)
                .gte("filing_date", cutoff)
                .execute()
                .data
            )
            buys = 0
            sells = 0
            for row in insider_rows:
                shares = abs(row.get("shares_traded") or 0)
                txn = (row.get("transaction_type") or "").strip()
                if txn == "Purchase":
                    buys += shares
                elif txn == "Sale":
                    sells += shares

            if buys > sells:
                sentiment = "bullish"
            elif sells > buys:
                sentiment = "bearish"
            else:
                sentiment = "neutral"

            insider_sentiment = {
                "net_buys_shares": buys,
                "net_sells_shares": sells,
                "net_sentiment": sentiment,
            }
        except Exception as e:
            print(f"[governance] insider trades query error: {e}")

    # ── Compensation summary ─────────────────────────────────────────────
    pay_values = [ex["pay"] for ex in executives if ex.get("pay") and ex["pay"] > 0]
    ceo_candidates = [ex for ex in executives if "ceo" in (ex.get("title") or "").lower() or "chief executive" in (ex.get("title") or "").lower()]
    ceo_pay = ceo_candidates[0]["pay"] if ceo_candidates and ceo_candidates[0].get("pay") else None

    if pay_values:
        sorted_pay = sorted(pay_values)
        mid = len(sorted_pay) // 2
        median_exec_pay = sorted_pay[mid] if len(sorted_pay) % 2 == 1 else round((sorted_pay[mid - 1] + sorted_pay[mid]) / 2)
    else:
        median_exec_pay = None

    compensation = {
        "ceo_pay": ceo_pay,
        "median_exec_pay": median_exec_pay,
    }

    # ── Assemble response ────────────────────────────────────────────────
    result = {
        "ticker": ticker,
        "executives": executives,
        "board": board,
        "board_stats": board_stats,
        "institutional_holders": institutional_holders,
        "insider_sentiment": insider_sentiment,
        "compensation": compensation,
        "capital_structure": capital_structure,
    }

    cache_set(cache_key, result, ttl=3600)
    return result
