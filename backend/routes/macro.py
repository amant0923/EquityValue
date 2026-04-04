"""Macroeconomic data endpoints.

Data is pre-computed by refresh_macro.py and served from Supabase.
"""
import os
import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from auth import get_optional_user
from db import get_supabase_service, get_supabase, parse_json_strings

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
async def macro_overview(request: Request, user: dict = Depends(get_optional_user)):
    """Return cached US macroeconomic indicators from Supabase."""
    sb = get_supabase_service() or get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    row = sb.table("macro_cache").select("*").eq("id", "global").limit(1).execute().data
    if not row:
        raise HTTPException(404, "Macro data not yet computed. Check back in a few hours.")

    data = parse_json_strings(row[0])
    data.pop("id", None)
    data.pop("computed_at", None)

    # Reshape nested structure into the flat format the frontend expects
    current = data.get("current") or {}
    reshaped = {
        "current": {
            "gdp_growth": current.get("gdp_growth"),
            "inflation": current.get("inflation_rate"),
            "fed_rate": current.get("fed_funds_rate"),
            "consumer_confidence": current.get("consumer_confidence"),
            "unemployment": current.get("unemployment_rate"),
        },
        "gdp_history": (data.get("gdp") or {}).get("us", []),
        "inflation_history": (data.get("inflation") or {}).get("us", []),
        "fed_rate_history": (data.get("interest_rates") or {}).get("us_fed_funds", []),
        "consumer_confidence_history": (data.get("consumer_confidence") or {}).get("us", []),
        "unemployment_history": (data.get("unemployment") or {}).get("us", []),
    }
    return reshaped


@router.get("/sector/{sector}")
@limiter.limit("60/minute")
async def macro_sector(request: Request, sector: str, user: dict = Depends(get_optional_user)):
    """Return cached FRED macro series relevant to a given stock sector."""
    sector_key = sector.strip().title()

    sb = get_supabase_service() or get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    row = sb.table("macro_sector_cache").select("*").eq("sector", sector_key).limit(1).execute().data
    if not row:
        raise HTTPException(404, f"Macro data not available for sector '{sector_key}'. Check back in a few hours.")

    data = parse_json_strings(row[0])
    return {
        "sector": data["sector"],
        "series": data.get("indicators", {}),
    }


@router.post("/refresh")
async def macro_refresh(request: Request):
    """Manually trigger macro data refresh. Requires FRED_API_KEY to be set."""
    if not os.environ.get("FRED_API_KEY"):
        raise HTTPException(403, "FRED_API_KEY not configured")

    from refresh_macro import refresh_overview
    try:
        refresh_overview()
    except Exception as e:
        logger.exception("Macro refresh failed")
        raise HTTPException(500, f"Refresh failed: {e}")

    return {"status": "ok", "message": "Macro overview data refreshed"}
