"""
Weekly refresh: fetch forward consensus estimates for all S&P 500 tickers.
Stores results in estimates_cache table.

Usage: FMP_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python3 refresh_estimates.py
Schedule: Sunday 6am ET via GitHub Actions
"""
import os
import sys
import json
import time

from supabase import create_client
from fmp_client import fmp_get_list

# ── Supabase setup ────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", os.environ.get("SUPABASE_KEY", ""))
FMP_KEY = os.environ.get("FMP_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_all_tickers():
    rows = supabase.table("stock_fundamentals").select("ticker").execute().data
    return [r["ticker"] for r in rows]


def fetch_estimates(ticker: str) -> list:
    """Fetch forward consensus estimates from FMP."""
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

    estimates.sort(key=lambda e: e.get("date", ""))
    return estimates


def main():
    if not FMP_KEY:
        raise SystemExit("FMP_KEY must be set.")

    tickers = get_all_tickers()
    total = len(tickers)
    print(f"Refreshing estimates for {total} tickers...")

    ok = 0
    fail = 0

    for i, ticker in enumerate(tickers):
        try:
            estimates = fetch_estimates(ticker)
            if not estimates:
                print(f"  [{i+1}/{total}] {ticker} — SKIPPED (no estimates)")
                fail += 1
                continue

            record = {
                "ticker": ticker,
                "estimates": json.dumps(estimates),
            }

            supabase.table("estimates_cache").upsert(record, on_conflict="ticker").execute()
            ok += 1

            if (i + 1) % 50 == 0:
                print(f"  [{i+1}/{total}] Progress: {ok} OK, {fail} failed")

        except Exception as e:
            fail += 1
            print(f"  [{i+1}/{total}] {ticker} — FAILED: {e}")

    print(f"\nDone: {ok} OK, {fail} failed/skipped out of {total}")


if __name__ == "__main__":
    main()
