"""Risk analysis and forecasting endpoints for a given ticker.

Data is pre-computed by refresh_risk.py and refresh_forecasts.py, served from Supabase.
"""

from fastapi import APIRouter, HTTPException, Request, Depends
from slowapi import Limiter
from slowapi.util import get_remote_address
import logging

from config import validate_ticker
from auth import get_optional_user
from db import get_supabase, get_supabase_service

logger = logging.getLogger(__name__)
router = APIRouter()

try:
    from rate_limit import limiter
except Exception:
    limiter = Limiter(key_func=get_remote_address)


@router.get("/risk/{ticker}")
@limiter.limit("60/minute")
async def get_risk_analysis(ticker: str, request: Request, user: dict = Depends(get_optional_user)):
    ticker = validate_ticker(ticker)

    sb = get_supabase_service() or get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    row = sb.table("risk_analysis_cache").select("*").eq("ticker", ticker).limit(1).execute().data
    if not row:
        raise HTTPException(404, "Risk data not yet computed for this ticker. Check back in a few hours.")

    return row[0]


@router.get("/forecast/{ticker}")
@limiter.limit("60/minute")
async def get_forecast(ticker: str, request: Request, user: dict = Depends(get_optional_user)):
    ticker = validate_ticker(ticker)

    sb = get_supabase_service() or get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    row = sb.table("price_forecasts").select("*").eq("ticker", ticker).limit(1).execute().data
    if not row:
        raise HTTPException(404, "Forecast data not yet computed for this ticker. Check back in a few hours.")

    return row[0]
