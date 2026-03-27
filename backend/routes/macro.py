"""Macroeconomic data endpoints.

Data is pre-computed by refresh_macro.py and served from Supabase.
"""
import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from auth import get_current_user
from db import get_supabase_service, get_supabase

try:
    from rate_limit import limiter
except Exception:
    limiter = None

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/macro")


# ── Sector → FRED series mapping (kept for reference / refresh script) ───────

SECTOR_SERIES = {
    "Technology":             ["NAPM", "T10Y2Y", "JTSJOL"],
    "Healthcare":             ["PCE", "CPIMEDSL"],
    "Financial Services":     ["T10Y2Y", "MORTGAGE30US", "FEDFUNDS"],
    "Financials":             ["T10Y2Y", "MORTGAGE30US", "FEDFUNDS"],
    "Energy":                 ["DCOILWTICO", "GASREGW"],
    "Consumer Discretionary": ["RSAFS", "UMCSENT", "UNRATE"],
    "Consumer Cyclical":      ["RSAFS", "UMCSENT", "UNRATE"],
    "Consumer Staples":       ["CPIAUCSL", "RSAFS"],
    "Consumer Defensive":     ["CPIAUCSL", "RSAFS"],
    "Industrials":            ["INDPRO", "NAPM"],
    "Real Estate":            ["MORTGAGE30US", "CSUSHPINSA"],
    "Utilities":              ["FEDFUNDS", "CPIENGSL"],
    "Communication Services": ["NAPM", "T10Y2Y"],
    "Basic Materials":        ["INDPRO", "DCOILWTICO"],
}


@router.get("/overview")
@limiter.limit("60/minute")
async def macro_overview(request: Request, user: dict = Depends(get_current_user)):
    """Return cached US macroeconomic indicators from Supabase."""
    sb = get_supabase_service() or get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    row = sb.table("macro_cache").select("*").eq("id", "global").limit(1).execute().data
    if not row:
        raise HTTPException(404, "Macro data not yet computed. Check back in a few hours.")

    data = row[0]
    # Remove the 'id' and 'computed_at' fields to match original response shape
    data.pop("id", None)
    data.pop("computed_at", None)
    return data


@router.get("/sector/{sector}")
@limiter.limit("60/minute")
async def macro_sector(request: Request, sector: str, user: dict = Depends(get_current_user)):
    """Return cached FRED macro series relevant to a given stock sector."""
    sector_key = sector.strip().title()

    sb = get_supabase_service() or get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    row = sb.table("macro_sector_cache").select("*").eq("sector", sector_key).limit(1).execute().data
    if not row:
        raise HTTPException(404, f"Macro data not available for sector '{sector_key}'. Check back in a few hours.")

    data = row[0]
    # Reshape to match original response: {sector, series: {...}}
    return {
        "sector": data["sector"],
        "series": data.get("indicators", {}),
    }
