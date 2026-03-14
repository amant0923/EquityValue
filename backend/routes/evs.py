"""EVS (Equity Value Score) API endpoints."""
from fastapi import APIRouter, HTTPException, Query
import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL else None

router = APIRouter(prefix="/evs")


@router.get("/top")
async def evs_top(limit: int = Query(default=20, le=50)):
    """Top N highest EVS scores. Public endpoint for SEO."""
    if not sb:
        raise HTTPException(503, "Database not configured")
    rows = sb.table("equity_value_scores") \
        .select("ticker, score, verdict, components, computed_at") \
        .order("score", desc=True) \
        .limit(limit) \
        .execute().data
    return rows


@router.get("/bottom")
async def evs_bottom(limit: int = Query(default=20, le=50)):
    """Bottom N lowest EVS scores. Public endpoint for SEO."""
    if not sb:
        raise HTTPException(503, "Database not configured")
    rows = sb.table("equity_value_scores") \
        .select("ticker, score, verdict, components, computed_at") \
        .order("score", desc=False) \
        .limit(limit) \
        .execute().data
    return rows


@router.get("/{ticker}")
async def evs_detail(ticker: str):
    """EVS score + component breakdown for a single ticker."""
    ticker = ticker.upper().strip()
    if not sb:
        raise HTTPException(503, "Database not configured")
    row = sb.table("equity_value_scores") \
        .select("*") \
        .eq("ticker", ticker) \
        .limit(1) \
        .execute().data
    if not row:
        raise HTTPException(404, f"No EVS data for {ticker}")
    # Get score history for sparkline
    history = sb.table("equity_value_score_history") \
        .select("score, verdict, computed_at") \
        .eq("ticker", ticker) \
        .order("computed_at", desc=True) \
        .limit(365) \
        .execute().data
    return {**row[0], "history": history}
