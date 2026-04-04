"""
Weekly refresh: fetch macroeconomic data from FRED API.
Stores results in macro_cache and macro_sector_cache tables.

Usage: FRED_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python3 refresh_macro.py
Schedule: Sunday 6am ET via GitHub Actions
"""
import os
import sys
import json
import time

from supabase import create_client

# ── Supabase setup ────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", os.environ.get("SUPABASE_KEY", ""))
FRED_API_KEY = os.environ.get("FRED_API_KEY") or "dda0d98c26bb10421a55ffe896a096ff"

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── FRED helpers (reused from routes/macro.py) ────────────────────────────────

from datetime import datetime, timedelta

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


def _get_fred():
    from fredapi import Fred
    return Fred(api_key=FRED_API_KEY)


def _series_to_list(series) -> list[dict]:
    if series is None or series.empty:
        return []
    result = []
    for date, value in series.items():
        if value is not None and str(value) != "nan":
            result.append({"date": date.strftime("%Y-%m-%d"), "value": round(float(value), 2)})
    return result


def _compute_yoy_change(series) -> list[dict]:
    if series is None or series.empty:
        return []
    import pandas as pd
    try:
        freq = pd.infer_freq(series.index)
    except Exception:
        freq = None
    periods = 4 if (freq and "Q" in str(freq)) else 12
    pct = series.pct_change(periods=periods) * 100
    result = []
    for date, value in pct.items():
        if value is not None and str(value) != "nan":
            result.append({"date": date.strftime("%Y-%m-%d"), "value": round(float(value), 2)})
    return result


def _fetch_series_safe(fred, series_id: str, start_date: str):
    try:
        return fred.get_series(series_id, observation_start=start_date)
    except Exception as e:
        print(f"  FRED fetch failed for {series_id}: {e}")
        return None


def refresh_overview():
    """Refresh the global macro overview (single row in macro_cache)."""
    print("Refreshing macro overview...")
    fred = _get_fred()
    start_date = (datetime.now() - timedelta(days=365 * 10)).strftime("%Y-%m-%d")

    raw_gdp = _fetch_series_safe(fred, "GDP", start_date)
    time.sleep(1)
    raw_cpi = _fetch_series_safe(fred, "CPIAUCSL", start_date)
    time.sleep(1)
    raw_fedfunds = _fetch_series_safe(fred, "FEDFUNDS", start_date)
    time.sleep(1)
    raw_umcsent = _fetch_series_safe(fred, "UMCSENT", start_date)
    time.sleep(1)
    raw_unrate = _fetch_series_safe(fred, "UNRATE", start_date)

    gdp_yoy = _compute_yoy_change(raw_gdp) if raw_gdp is not None else []
    cpi_yoy = _compute_yoy_change(raw_cpi) if raw_cpi is not None else []
    fedfunds_list = _series_to_list(raw_fedfunds)
    umcsent_list = _series_to_list(raw_umcsent)
    unrate_list = _series_to_list(raw_unrate)

    def _last_value(data_list):
        return data_list[-1]["value"] if data_list else None

    current = {
        "gdp_growth": _last_value(gdp_yoy),
        "inflation_rate": _last_value(cpi_yoy),
        "fed_funds_rate": _last_value(fedfunds_list),
        "consumer_confidence": _last_value(umcsent_list),
        "unemployment_rate": _last_value(unrate_list),
    }

    record = {
        "id": "global",
        "gdp": json.dumps({"us": gdp_yoy}),
        "inflation": json.dumps({"us": cpi_yoy}),
        "interest_rates": json.dumps({"us_fed_funds": fedfunds_list}),
        "consumer_confidence": json.dumps({"us": umcsent_list}),
        "unemployment": json.dumps({"us": unrate_list}),
        "current": json.dumps(current),
    }

    supabase.table("macro_cache").upsert(record, on_conflict="id").execute()
    print("  Macro overview — OK")


def refresh_sectors():
    """Refresh sector-specific macro data."""
    print("Refreshing macro sector data...")
    fred = _get_fred()
    start_date = (datetime.now() - timedelta(days=365 * 5)).strftime("%Y-%m-%d")

    # Get unique sectors from stock_fundamentals
    rows = supabase.table("stock_fundamentals").select("sector").execute().data
    db_sectors = set(r["sector"] for r in rows if r.get("sector"))

    # Also include all sectors in SECTOR_SERIES
    all_sectors = db_sectors | set(SECTOR_SERIES.keys())

    for sector in sorted(all_sectors):
        series_ids = SECTOR_SERIES.get(sector, ["GDP", "CPIAUCSL", "FEDFUNDS"])
        series_data = {}

        for sid in series_ids:
            raw = _fetch_series_safe(fred, sid, start_date)
            series_data[sid] = _series_to_list(raw)
            time.sleep(1)

        record = {
            "sector": sector,
            "indicators": json.dumps(series_data),
        }

        supabase.table("macro_sector_cache").upsert(record, on_conflict="sector").execute()
        print(f"  {sector} — OK")


def main():
    refresh_overview()
    refresh_sectors()
    print("\nDone.")


if __name__ == "__main__":
    main()
