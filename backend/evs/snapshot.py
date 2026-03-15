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
        valuation = run_valuation(ticker, data)
        scores = fetch_scores(ticker)
        evs_inputs = extract_evs_inputs(data, valuation, scores)
        evs_result = compute_evs(evs_inputs)

        # Snapshot individual model outputs for accuracy tracking
        price = data.get("price") or data.get("current_price") or 0
        snapshot_valuations(ticker, valuation, price)

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

        # Append to history (computed_at is DATE, one row per ticker per day)
        today = datetime.now(timezone.utc).date().isoformat()
        sb.table("equity_value_score_history").upsert({
            "ticker": ticker,
            "score": evs_result["score"],
            "verdict": evs_result["verdict"],
            "computed_at": today,
        }, on_conflict="ticker,computed_at").execute()

        return evs_result["score"]
    except Exception as e:
        print(f"  ERROR {ticker}: {e}")
        return None


def snapshot_valuations(ticker, valuation_result, price):
    """Snapshot each model's output for accuracy tracking."""
    today = datetime.now(timezone.utc).date().isoformat()
    models = valuation_result.get("models", [])
    for model in models:
        if not model.get("applicable"):
            continue
        try:
            sb.table("valuation_snapshots").upsert({
                "ticker": ticker,
                "snapshot_date": today,
                "model_name": model.get("model", "Unknown"),
                "intrinsic_value": model.get("intrinsic_value"),
                "verdict": model.get("verdict"),
                "price_at_snapshot": price,
            }, on_conflict="ticker,snapshot_date,model_name").execute()
        except Exception as e:
            print(f"  SNAPSHOT ERROR {ticker}/{model.get('model')}: {e}")


def backfill_accuracy():
    """Compare past snapshots (6/12 months ago) to current prices."""
    from data_fetcher import fetch_finnhub_price
    from datetime import timedelta

    today = datetime.now(timezone.utc).date()

    for months, col_price, col_correct in [(6, "price_6mo", "direction_correct_6mo"),
                                            (12, "price_12mo", "direction_correct_12mo")]:
        target_date = (today - timedelta(days=months * 30)).isoformat()
        snapshots = sb.table("valuation_snapshots") \
            .select("*") \
            .eq("snapshot_date", target_date) \
            .execute().data

        for snap in snapshots:
            ticker = snap["ticker"]
            try:
                price_data = fetch_finnhub_price(ticker)
                current_price = price_data.get("current_price") if price_data else None
                if not current_price:
                    continue
                price_at = snap["price_at_snapshot"]
                iv = snap["intrinsic_value"]
                if not price_at or not iv:
                    continue
                predicted_direction = "up" if iv > price_at else "down"
                actual_direction = "up" if current_price > price_at else "down"
                correct = predicted_direction == actual_direction

                sb.table("accuracy_tracking").upsert({
                    "ticker": ticker,
                    "snapshot_date": snap["snapshot_date"],
                    "model_name": snap["model_name"],
                    "intrinsic_value": iv,
                    "price_at_snapshot": price_at,
                    col_price: current_price,
                    col_correct: correct,
                }, on_conflict="ticker,snapshot_date,model_name").execute()
            except Exception as e:
                print(f"  BACKFILL ERROR {ticker}: {e}")


def fire_alerts():
    """Compare today's EVS to yesterday's, fire matching user alerts."""
    from datetime import timedelta
    RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")

    current = {r["ticker"]: r for r in sb.table("equity_value_scores").select("*").execute().data}

    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    prev_rows = sb.table("equity_value_score_history") \
        .select("ticker, score, verdict") \
        .gte("computed_at", yesterday) \
        .lt("computed_at", datetime.now(timezone.utc).date().isoformat()) \
        .execute().data
    prev = {r["ticker"]: r for r in prev_rows}

    alerts = sb.table("user_alerts").select("*").eq("enabled", True).execute().data

    fired = 0
    for alert in alerts:
        ticker = alert["ticker"]
        cur = current.get(ticker)
        pre = prev.get(ticker)
        if not cur:
            continue
        message = None
        if alert["alert_type"] == "score_threshold" and alert.get("threshold"):
            if pre and ((pre["score"] > alert["threshold"] and cur["score"] <= alert["threshold"]) or
                       (pre["score"] < alert["threshold"] and cur["score"] >= alert["threshold"])):
                message = f"{ticker} EVS crossed {alert['threshold']} (now {cur['score']})"
        elif alert["alert_type"] == "score_change" and pre:
            change = abs(cur["score"] - pre["score"])
            if change >= 10:
                direction = "up" if cur["score"] > pre["score"] else "down"
                message = f"{ticker} EVS moved {direction} {change} points to {cur['score']}"
        elif alert["alert_type"] == "verdict_flip" and pre:
            if cur["verdict"] != pre["verdict"]:
                message = f"{ticker} verdict changed: {pre['verdict']} -> {cur['verdict']}"

        if message:
            sb.table("alert_history").insert({
                "user_id": alert["user_id"],
                "ticker": ticker,
                "alert_type": alert["alert_type"],
                "message": message,
            }).execute()
            # Send email notification
            if RESEND_API_KEY:
                try:
                    user_auth = sb.auth.admin.get_user_by_id(alert["user_id"])
                    email = user_auth.user.email if user_auth and user_auth.user else None
                    if email:
                        import requests as req
                        req.post("https://api.resend.com/emails", json={
                            "from": "alerts@equityvalue.ai",
                            "to": email,
                            "subject": f"EVS Alert: {message}",
                            "html": f'<div style="font-family:Arial;max-width:500px;margin:0 auto"><h2 style="color:#2563eb">EVS Alert</h2><p style="font-size:16px;color:#1e293b">{message}</p><a href="https://equityvalue.ai/company/{ticker}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;margin-top:12px">View {ticker}</a><p style="font-size:11px;color:#94a3b8;margin-top:20px">Equity Value is an educational tool, not investment advice.</p></div>',
                        }, headers={"Authorization": f"Bearer {RESEND_API_KEY}"})
                except Exception as e:
                    print(f"  ALERT EMAIL ERROR {ticker}: {e}")
            fired += 1

    print(f"Fired {fired} alerts")


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

    # Phase 2: backfill accuracy for snapshots from 6/12 months ago
    print("Backfilling accuracy data...")
    backfill_accuracy()

    # Fire alerts for score changes
    print("Checking alert subscriptions...")
    fire_alerts()


if __name__ == "__main__":
    main()
