"""Forward consensus estimates API endpoint."""
from fastapi import APIRouter, HTTPException, Depends, Request
from config import validate_ticker, FMP_KEY
from auth import get_current_user
from redis_cache import cache_get, cache_set

try:
    from rate_limit import limiter
except Exception:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    limiter = Limiter(key_func=get_remote_address)

router = APIRouter()


@router.get("/estimates/{ticker}")
@limiter.limit("30/minute")
async def get_estimates(request: Request, ticker: str, user: dict = Depends(get_current_user)):
    """Fetch forward consensus analyst estimates from FMP."""
    ticker = validate_ticker(ticker)
    cache_key = f"estimates:{ticker}"

    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    if not FMP_KEY:
        raise HTTPException(503, "FMP API key not configured")

    from fmp_client import fmp_get_list

    raw = fmp_get_list(f"analyst-estimates/{ticker}", {"apikey": FMP_KEY, "limit": 5})

    estimates = []
    for item in raw:
        estimates.append({
            "date": item.get("date", ""),
            "estimated_revenue": item.get("estimatedRevenueAvg"),
            "estimated_ebitda": item.get("estimatedEbitdaAvg"),
            "estimated_net_income": item.get("estimatedNetIncomeAvg"),
            "estimated_eps": item.get("estimatedEpsAvg"),
            "revenue_low": item.get("estimatedRevenueLow"),
            "revenue_high": item.get("estimatedRevenueHigh"),
            "eps_low": item.get("estimatedEpsLow"),
            "eps_high": item.get("estimatedEpsHigh"),
            "number_analysts": item.get("numberAnalystEstimatedRevenue"),
        })

    # Sort by date ascending
    estimates.sort(key=lambda e: e.get("date", ""))

    result = {
        "ticker": ticker,
        "estimates": estimates,
    }

    cache_set(cache_key, result, ttl=86400)
    return result
