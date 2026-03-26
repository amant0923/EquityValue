"""Macroeconomic data endpoints powered by FRED API."""
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request
from auth import get_current_user
from redis_cache import cache_get, cache_set

try:
    from rate_limit import limiter
except Exception:
    limiter = None

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/macro")

FRED_API_KEY = "dda0d98c26bb10421a55ffe896a096ff"

# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_fred():
    """Create a Fred client. Raises on import/init failure."""
    from fredapi import Fred
    return Fred(api_key=FRED_API_KEY)


def _series_to_list(series) -> list[dict]:
    """Convert a pandas Series (index=dates, values=floats) to list of dicts."""
    if series is None or series.empty:
        return []
    result = []
    for date, value in series.items():
        if value is not None and str(value) != "nan":
            result.append({
                "date": date.strftime("%Y-%m-%d"),
                "value": round(float(value), 2),
            })
    return result


def _compute_yoy_change(series) -> list[dict]:
    """Compute year-over-year percentage change from a raw pandas Series.

    For each observation, find the value ~12 months prior and compute
    ((current - prior) / prior) * 100.  Returns list of dicts.
    """
    if series is None or series.empty:
        return []
    import pandas as pd
    pct = series.pct_change(periods=12 if series.index.freqstr and "M" in series.index.freqstr else 4) * 100
    # pct_change with inferred periods: for monthly data use 12, quarterly use 4
    # Fallback: just use the built-in pct_change with appropriate period
    # Re-do with explicit logic to handle freq detection properly
    try:
        freq = pd.infer_freq(series.index)
    except Exception:
        freq = None

    if freq and "Q" in str(freq):
        periods = 4
    else:
        periods = 12  # monthly default

    pct = series.pct_change(periods=periods) * 100
    result = []
    for date, value in pct.items():
        if value is not None and str(value) != "nan":
            result.append({
                "date": date.strftime("%Y-%m-%d"),
                "value": round(float(value), 2),
            })
    return result


def _fetch_series_safe(fred, series_id: str, start_date: str):
    """Fetch a FRED series, returning None on any failure."""
    try:
        return fred.get_series(series_id, observation_start=start_date)
    except Exception as e:
        logger.warning("FRED fetch failed for %s: %s", series_id, e)
        return None


# ── Sector → FRED series mapping ────────────────────────────────────────────

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

DEFAULT_SERIES = ["GDP", "CPIAUCSL", "FEDFUNDS"]


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/overview")
@limiter.limit("30/minute")
async def macro_overview(request: Request, user: dict = Depends(get_current_user)):
    """Return 10 years of key US macroeconomic indicators from FRED."""

    cache_key = "macro:overview"
    cached = cache_get(cache_key)
    if cached:
        return cached

    fred = _get_fred()
    start_date = (datetime.now() - timedelta(days=365 * 10)).strftime("%Y-%m-%d")

    # Fetch all series (each wrapped in try/except via helper)
    raw_gdp = _fetch_series_safe(fred, "GDP", start_date)
    raw_cpi = _fetch_series_safe(fred, "CPIAUCSL", start_date)
    raw_fedfunds = _fetch_series_safe(fred, "FEDFUNDS", start_date)
    raw_umcsent = _fetch_series_safe(fred, "UMCSENT", start_date)
    raw_unrate = _fetch_series_safe(fred, "UNRATE", start_date)

    # GDP: compute YoY % change (quarterly → 4-period lag)
    gdp_yoy = _compute_yoy_change(raw_gdp) if raw_gdp is not None else []

    # CPI: compute YoY % change (monthly → 12-period lag)
    cpi_yoy = _compute_yoy_change(raw_cpi) if raw_cpi is not None else []

    # Interest rates, confidence, unemployment: raw values
    fedfunds_list = _series_to_list(raw_fedfunds)
    umcsent_list = _series_to_list(raw_umcsent)
    unrate_list = _series_to_list(raw_unrate)

    # Build "current" snapshot from the last available value of each series
    def _last_value(data_list: list[dict]):
        return data_list[-1]["value"] if data_list else None

    current = {
        "gdp_growth": _last_value(gdp_yoy),
        "inflation_rate": _last_value(cpi_yoy),
        "fed_funds_rate": _last_value(fedfunds_list),
        "consumer_confidence": _last_value(umcsent_list),
        "unemployment_rate": _last_value(unrate_list),
    }

    result = {
        "gdp": {"us": gdp_yoy},
        "inflation": {"us": cpi_yoy},
        "interest_rates": {"us_fed_funds": fedfunds_list},
        "consumer_confidence": {"us": umcsent_list},
        "unemployment": {"us": unrate_list},
        "current": current,
    }

    cache_set(cache_key, result, ttl=86400)
    return result


@router.get("/sector/{sector}")
@limiter.limit("30/minute")
async def macro_sector(request: Request, sector: str, user: dict = Depends(get_current_user)):
    """Return FRED macro series relevant to a given stock sector (last 5 years)."""

    # Normalise sector name: title-case the input for flexible matching
    sector_key = sector.strip().title()

    cache_key = f"macro:sector:{sector_key}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    series_ids = SECTOR_SERIES.get(sector_key, DEFAULT_SERIES)

    fred = _get_fred()
    start_date = (datetime.now() - timedelta(days=365 * 5)).strftime("%Y-%m-%d")

    result = {"sector": sector_key, "series": {}}

    for sid in series_ids:
        raw = _fetch_series_safe(fred, sid, start_date)
        result["series"][sid] = _series_to_list(raw)

    cache_set(cache_key, result, ttl=86400)
    return result
