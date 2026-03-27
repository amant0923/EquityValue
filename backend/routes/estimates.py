"""Forward consensus estimates API endpoint.

Data is pre-computed by refresh_estimates.py and served from Supabase.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from config import validate_ticker
from auth import get_current_user
from db import get_supabase, get_supabase_service

try:
    from rate_limit import limiter
except Exception:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    limiter = Limiter(key_func=get_remote_address)

router = APIRouter()


@router.get("/estimates/{ticker}")
@limiter.limit("60/minute")
async def get_estimates(request: Request, ticker: str, user: dict = Depends(get_current_user)):
    """Return cached forward consensus estimates from Supabase."""
    ticker = validate_ticker(ticker)

    sb = get_supabase_service() or get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    row = sb.table("estimates_cache").select("*").eq("ticker", ticker).limit(1).execute().data
    if not row:
        raise HTTPException(404, f"Estimates not yet computed for {ticker}. Check back in a few hours.")

    data = row[0]
    data.pop("computed_at", None)
    return data
