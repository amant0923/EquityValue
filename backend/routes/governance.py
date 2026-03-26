"""Corporate governance API endpoints.

Data is pre-computed by refresh_governance.py and served from Supabase.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from config import validate_ticker
from auth import get_current_user
from db import get_supabase_service

try:
    from rate_limit import limiter
except Exception:
    limiter = None

router = APIRouter(prefix="/governance")


def _governance_limiter(func):
    if limiter is not None:
        return limiter.limit("60/minute")(func)
    return func


@router.get("/{ticker}")
@_governance_limiter
async def get_governance(
    request: Request,
    ticker: str,
    user: dict = Depends(get_current_user),
):
    """Return cached corporate governance data from Supabase."""
    ticker = validate_ticker(ticker)

    sb = get_supabase_service()
    if not sb:
        raise HTTPException(503, "Database not configured")

    row = sb.table("governance_cache").select("*").eq("ticker", ticker).limit(1).execute().data
    if not row:
        raise HTTPException(404, "Governance data not yet computed for this ticker. Check back in a few hours.")

    data = row[0]
    data.pop("computed_at", None)
    return data
