"""Nightly EVS pipeline: compute scores for all S&P 500 tickers.

Steps (run sequentially):
1. Fetch all tickers from stock_fundamentals
2. For each ticker: fetch data, run valuation, extract EVS inputs, compute score
3. Upsert to equity_value_scores + append to equity_value_score_history

Usage: python -m evs.snapshot
"""
import os
import sys
import json
from datetime import datetime, timezone

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client
from data_fetcher import fetch_stock_data
from main import normalise
from valuation.router import run_valuation
from evs.score import compute_evs
from evs.extract import extract_evs_inputs

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", os.environ.get("SUPABASE_KEY", ""))
sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_all_tickers():
    """Get all tickers from stock_fundamentals."""
    rows = sb.table("stock_fundamentals").select("ticker").execute().data
    return [r["ticker"] for r in rows]


def fetch_scores(ticker):
    """Get company_scores row for Altman Z, Piotroski."""
    rows = sb.table("company_scores").select("*").eq("ticker", ticker).limit(1).execute().data
    return rows[0] if rows else {}


def compute_and_store(ticker):
    """Compute EVS for one ticker and store results."""
    try:
        raw_data = fetch_stock_data(ticker)
        if not raw_data:
            print(f"  SKIP {ticker}: no data")
            return None
        data = normalise(raw_data)
        valuation = run_valuation(data)
        scores = fetch_scores(ticker)
        evs_inputs = extract_evs_inputs(data, valuation, scores)
        evs_result = compute_evs(evs_inputs)

        now = datetime.now(timezone.utc).isoformat()

        # Upsert to equity_value_scores (current score)
        sb.table("equity_value_scores").upsert({
            "ticker": ticker,
            "score": evs_result["score"],
            "verdict": evs_result["verdict"],
            "valuation_score": evs_result["components"]["valuation"],
            "health_score": evs_result["components"]["health"],
            "analyst_score": evs_result["components"]["analyst"],
            "growth_score": evs_result["components"]["growth"],
            "risk_score": evs_result["components"]["risk"],
            "components": json.dumps(evs_result["components"]),
            "computed_at": now,
        }, on_conflict="ticker").execute()

        # Append to history
        sb.table("equity_value_score_history").upsert({
            "ticker": ticker,
            "score": evs_result["score"],
            "verdict": evs_result["verdict"],
            "computed_at": now,
        }, on_conflict="ticker,computed_at").execute()

        return evs_result["score"]
    except Exception as e:
        print(f"  ERROR {ticker}: {e}")
        return None


def main():
    tickers = fetch_all_tickers()
    print(f"Computing EVS for {len(tickers)} tickers...")
    success = 0
    failed = 0
    for i, ticker in enumerate(tickers):
        score = compute_and_store(ticker)
        if score is not None:
            success += 1
            if (i + 1) % 50 == 0:
                print(f"  Progress: {i + 1}/{len(tickers)} ({success} ok, {failed} failed)")
        else:
            failed += 1
    print(f"Done: {success} computed, {failed} failed out of {len(tickers)}")
    if failed > len(tickers) * 0.10:
        print("WARNING: >10% failure rate — check data sources")
        sys.exit(1)


if __name__ == "__main__":
    main()
