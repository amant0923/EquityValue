"""WACC (Weighted Average Cost of Capital) API endpoint."""
from fastapi import APIRouter, HTTPException, Depends, Request
from config import validate_ticker
from auth import get_current_user
from redis_cache import cache_get, cache_set
from db import get_supabase_service

try:
    from rate_limit import limiter
except Exception:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    limiter = Limiter(key_func=get_remote_address)

router = APIRouter()


def _safe_float(val, default=None):
    """Safely convert a value to float, returning default if not possible."""
    if val is None:
        return default
    try:
        f = float(val)
        return f if f == f else default  # NaN check
    except (TypeError, ValueError):
        return default


@router.get("/wacc/{ticker}")
@limiter.limit("30/minute")
async def get_wacc(request: Request, ticker: str, user: dict = Depends(get_current_user)):
    """Calculate full CAPM-based WACC for a ticker."""
    ticker = validate_ticker(ticker)
    cache_key = f"wacc:{ticker}"

    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    sb = get_supabase_service()
    if not sb:
        raise HTTPException(503, "Database not configured")

    # 1. Fetch fundamentals
    fund_row = sb.table("stock_fundamentals") \
        .select("beta, market_cap, total_debt, total_cash, shares_outstanding, current_price") \
        .eq("ticker", ticker) \
        .limit(1) \
        .execute().data

    if not fund_row:
        raise HTTPException(404, f"No fundamental data found for {ticker}")

    stock = fund_row[0]
    beta = _safe_float(stock.get("beta"), 1.0)
    market_cap = _safe_float(stock.get("market_cap"), 0)
    total_debt = _safe_float(stock.get("total_debt"), 0)
    total_cash = _safe_float(stock.get("total_cash"), 0)
    shares_outstanding = _safe_float(stock.get("shares_outstanding"), 0)
    price = _safe_float(stock.get("current_price"), 0)

    if market_cap <= 0:
        raise HTTPException(422, f"Invalid market cap for {ticker}")

    # 2. Fetch most recent income statement for tax rate and interest expense
    fin_rows = sb.table("financial_statements") \
        .select("income_tax_expense, income_before_tax, interest_expense") \
        .eq("ticker", ticker) \
        .eq("statement_type", "income") \
        .order("period_date", desc=True) \
        .limit(1) \
        .execute().data

    income_tax_expense = None
    income_before_tax = None
    interest_expense = None
    if fin_rows:
        row = fin_rows[0]
        income_tax_expense = _safe_float(row.get("income_tax_expense"))
        income_before_tax = _safe_float(row.get("income_before_tax"))
        interest_expense = _safe_float(row.get("interest_expense"))

    # 3. Risk-free rate
    from valuation.sector_multiples import get_risk_free_rate
    risk_free_rate = get_risk_free_rate()

    # ── WACC calculation ─────────────────────────────────────────────────────

    market_risk_premium = 0.059

    # Cost of equity (CAPM)
    cost_of_equity = risk_free_rate + beta * market_risk_premium

    # Effective tax rate (clamped 0-0.4, default 0.21)
    if (income_tax_expense is not None and income_before_tax is not None
            and income_before_tax > 0):
        effective_tax_rate = income_tax_expense / income_before_tax
        effective_tax_rate = max(0.0, min(0.4, effective_tax_rate))
    else:
        effective_tax_rate = 0.21

    # Cost of debt
    if interest_expense is not None and total_debt > 0 and interest_expense > 0:
        cost_of_debt_pretax = abs(interest_expense) / total_debt
    else:
        cost_of_debt_pretax = 0.045

    cost_of_debt_after_tax = cost_of_debt_pretax * (1 - effective_tax_rate)

    # Capital weights
    total_capital = market_cap + total_debt
    if total_capital <= 0:
        total_capital = market_cap  # fallback to equity-only

    equity_weight = market_cap / total_capital
    debt_weight = total_debt / total_capital

    # WACC
    wacc = equity_weight * cost_of_equity + debt_weight * cost_of_debt_after_tax
    wacc = max(0.04, min(0.20, wacc))

    # Derived values
    net_debt = total_debt - total_cash
    enterprise_value = market_cap + net_debt

    result = {
        "ticker": ticker,
        "wacc": round(wacc, 6),
        "components": {
            "risk_free_rate": round(risk_free_rate, 6),
            "beta": round(beta, 6),
            "market_risk_premium": round(market_risk_premium, 6),
            "cost_of_equity": round(cost_of_equity, 6),
            "cost_of_debt_pretax": round(cost_of_debt_pretax, 6),
            "effective_tax_rate": round(effective_tax_rate, 6),
            "cost_of_debt_after_tax": round(cost_of_debt_after_tax, 6),
            "equity_weight": round(equity_weight, 6),
            "debt_weight": round(debt_weight, 6),
        },
        "capital_structure": {
            "market_cap": int(market_cap),
            "total_debt": int(total_debt),
            "total_cash": int(total_cash),
            "net_debt": int(net_debt),
            "enterprise_value": int(enterprise_value),
            "shares_outstanding": int(shares_outstanding),
            "price": round(price, 2),
        },
    }

    cache_set(cache_key, result, ttl=3600)
    return result
