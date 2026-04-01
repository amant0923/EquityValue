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
import asyncio
from datetime import datetime, timezone, timedelta

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
    models = valuation_result.get("valuations", [])
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

    # Pre-fetch sector for all tickers
    fund_rows = sb.table("stock_fundamentals").select("ticker, sector").execute().data
    sector_map = {f["ticker"]: f.get("sector", "Unknown") for f in fund_rows}

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
                    "sector": sector_map.get(ticker, "Unknown"),
                }, on_conflict="ticker,snapshot_date,model_name").execute()
            except Exception as e:
                print(f"  BACKFILL ERROR {ticker}: {e}")


def _compute_volatility_thresholds():
    """Compute per-ticker score volatility from 30 days of history.

    Returns a dict of ticker -> dynamic threshold (2 std devs above mean
    daily change).  Falls back to fixed threshold of 10 if fewer than 7
    data points exist for a ticker.
    """
    from datetime import timedelta
    import statistics

    FALLBACK_THRESHOLD = 10
    MIN_HISTORY_DAYS = 7

    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=30)).isoformat()
    history_rows = sb.table("equity_value_score_history") \
        .select("ticker, score, computed_at") \
        .gte("computed_at", cutoff) \
        .order("computed_at") \
        .execute().data

    # Group by ticker, sorted by date
    from collections import defaultdict
    ticker_scores = defaultdict(list)
    for row in history_rows:
        ticker_scores[row["ticker"]].append(row["score"])

    thresholds = {}
    volatilities = {}
    for ticker, scores in ticker_scores.items():
        if len(scores) < MIN_HISTORY_DAYS:
            thresholds[ticker] = FALLBACK_THRESHOLD
            volatilities[ticker] = None
            continue
        # Compute daily changes
        daily_changes = [abs(scores[i] - scores[i - 1]) for i in range(1, len(scores))]
        if not daily_changes:
            thresholds[ticker] = FALLBACK_THRESHOLD
            volatilities[ticker] = None
            continue
        mean_change = statistics.mean(daily_changes)
        std_change = statistics.stdev(daily_changes) if len(daily_changes) >= 2 else 0
        volatility = std_change
        threshold = mean_change + 2 * std_change
        # Ensure minimum threshold of 3 to avoid noisy alerts
        thresholds[ticker] = max(threshold, 3)
        volatilities[ticker] = round(volatility, 2)

    return thresholds, volatilities


def _build_digest_email_html(messages):
    """Build a batched digest-style HTML email for multiple alerts."""
    alert_rows = "".join(
        f'<tr><td style="padding:10px 12px;border-bottom:1px solid #eee">'
        f'<span style="font-weight:600;color:#2563eb">{msg["ticker"]}</span></td>'
        f'<td style="padding:10px 12px;border-bottom:1px solid #eee">{msg["message"]}</td>'
        f'<td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center">'
        f'<a href="https://equityvalue.ai/company/{msg["ticker"]}" '
        f'style="color:#2563eb;text-decoration:none;font-weight:600">View</a></td></tr>'
        for msg in messages
    )
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
      <div style="padding:20px 24px;background:#2563eb;color:white;border-radius:8px 8px 0 0">
        <h2 style="margin:0;font-size:18px">EVS Alert Digest</h2>
        <p style="margin:4px 0 0;opacity:0.8;font-size:13px">{datetime.now(timezone.utc).strftime("%B %d, %Y")} &middot; {len(messages)} alert{"s" if len(messages) != 1 else ""}</p>
      </div>
      <div style="padding:20px 24px;background:white;border:1px solid #e2e8f0;border-top:none">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left">Ticker</th>
            <th style="padding:8px 12px;text-align:left">Alert</th>
            <th style="padding:8px 12px;text-align:center">Link</th>
          </tr>
          {alert_rows}
        </table>
        <div style="margin-top:20px;text-align:center">
          <a href="https://equityvalue.ai/dashboard" style="display:inline-block;padding:10px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">View Dashboard</a>
        </div>
      </div>
      <div style="padding:12px;text-align:center;font-size:11px;color:#94a3b8">
        Equity Value is an educational tool, not investment advice.
      </div>
    </div>
    """


def fire_alerts():
    """Compare today's EVS to yesterday's, fire matching user alerts.

    Uses volatility-based dynamic thresholds for score_change alerts and
    batches all alerts per user into a single digest email.
    """
    from datetime import timedelta
    from collections import defaultdict
    import requests as req

    RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")

    current = {r["ticker"]: r for r in sb.table("equity_value_scores").select("*").execute().data}

    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    prev_rows = sb.table("equity_value_score_history") \
        .select("ticker, score, verdict") \
        .gte("computed_at", yesterday) \
        .lt("computed_at", datetime.now(timezone.utc).date().isoformat()) \
        .execute().data
    prev = {r["ticker"]: r for r in prev_rows}

    # Compute volatility-based thresholds for score_change alerts
    thresholds, volatilities = _compute_volatility_thresholds()

    # Store volatility_30d on equity_value_scores for each ticker.
    # One update per ticker (supabase-py doesn't support bulk update).
    vol_items = [(t, v) for t, v in volatilities.items() if v is not None]
    for i, (ticker, vol) in enumerate(vol_items):
        try:
            sb.table("equity_value_scores").update({
                "volatility_30d": vol,
            }).eq("ticker", ticker).execute()
        except Exception as e:
            print(f"  VOLATILITY UPDATE ERROR {ticker}: {e}")
        if (i + 1) % 100 == 0:
            print(f"  Volatility updates: {i + 1}/{len(vol_items)}")

    alerts = sb.table("user_alerts").select("*").eq("enabled", True).execute().data

    # Collect alerts per user for batched email
    user_messages = defaultdict(list)  # user_id -> [{"ticker": ..., "message": ...}]
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
            dynamic_threshold = thresholds.get(ticker, 10)
            if change >= dynamic_threshold:
                direction = "up" if cur["score"] > pre["score"] else "down"
                message = f"{ticker} EVS moved {direction} {change} points to {cur['score']}"
        elif alert["alert_type"] == "verdict_flip" and pre:
            if cur["verdict"] != pre["verdict"]:
                message = f"{ticker} verdict changed: {pre['verdict']} -> {cur['verdict']}"

        if message:
            try:
                sb.table("alert_history").insert({
                    "user_id": alert["user_id"],
                    "ticker": ticker,
                    "alert_type": alert["alert_type"],
                    "message": message,
                }).execute()
            except Exception as e:
                # Duplicate alert (idempotent re-run) or other error — log and continue
                print(f"  ALERT INSERT WARN {ticker}/{alert['alert_type']}: {e}")
            user_messages[alert["user_id"]].append({
                "ticker": ticker,
                "message": message,
            })
            fired += 1

    # Send one batched digest email per user
    if RESEND_API_KEY and user_messages:
        for user_id, messages in user_messages.items():
            try:
                user_auth = sb.auth.admin.get_user_by_id(user_id)
                email = user_auth.user.email if user_auth and user_auth.user else None
                if not email:
                    continue
                subject = (f"EVS Alert: {messages[0]['message']}"
                           if len(messages) == 1
                           else f"EVS Alert Digest: {len(messages)} alerts for your watchlist")
                html = _build_digest_email_html(messages)
                req.post("https://api.resend.com/emails", json={
                    "from": "alerts@equityvalue.ai",
                    "to": email,
                    "subject": subject,
                    "html": html,
                }, headers={"Authorization": f"Bearer {RESEND_API_KEY}"})
            except Exception as e:
                print(f"  ALERT EMAIL ERROR user {user_id}: {e}")

    print(f"Fired {fired} alerts, emailed {len(user_messages)} users")


def compute_sector_rankings():
    """Compute sector percentile rankings for all tickers after nightly EVS run."""
    from evs.sector import compute_sector_percentiles

    evs_rows = sb.table("equity_value_scores").select("ticker, score").execute().data
    fund_rows = sb.table("stock_fundamentals").select("ticker, sector, industry").execute().data
    sector_map = {f["ticker"]: f for f in fund_rows}

    scores = []
    for row in evs_rows:
        fund = sector_map.get(row["ticker"], {})
        scores.append({
            "ticker": row["ticker"],
            "score": row["score"],
            "sector": fund.get("sector", "Unknown"),
            "industry": fund.get("industry", "Unknown"),
        })

    enriched = compute_sector_percentiles(scores)

    # Update sector rankings one-by-one (supabase-py doesn't support bulk update).
    # Progress logged every 100 tickers to reduce log noise.
    for i, item in enumerate(enriched):
        sb.table("equity_value_scores").update({
            "sector_rank": item["sector_rank"],
            "sector_percentile": item["sector_percentile"],
            "sector_total": item["sector_total"],
        }).eq("ticker", item["ticker"]).execute()
        if (i + 1) % 100 == 0:
            print(f"  Sector rankings: {i + 1}/{len(enriched)}")

    print(f"Updated sector rankings for {len(enriched)} tickers")


async def _async_compute(ticker):
    """Async wrapper around the synchronous compute_and_store."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, compute_and_store, ticker)


async def compute_all_evs(tickers):
    """Process tickers in batches concurrently with backoff between batches."""
    BATCH_SIZE = 5
    BATCH_DELAY = 1.5  # seconds between batches to let connections close
    success = 0
    failed_tickers = []
    total = len(tickers)

    for batch_start in range(0, total, BATCH_SIZE):
        batch = tickers[batch_start:batch_start + BATCH_SIZE]
        results = await asyncio.gather(
            *[_async_compute(t) for t in batch],
            return_exceptions=True,
        )
        for i, result in enumerate(results):
            idx = batch_start + i + 1
            if isinstance(result, Exception):
                print(f"  ERROR {batch[i]}: {result}")
                failed_tickers.append(batch[i])
            elif result is not None:
                success += 1
            else:
                failed_tickers.append(batch[i])
            if idx % 50 == 0:
                print(f"  Progress: {idx}/{total} ({success} ok, {len(failed_tickers)} failed)")
        # Brief pause between batches to avoid socket/file descriptor exhaustion
        await asyncio.sleep(BATCH_DELAY)

    # Retry failed tickers sequentially (no concurrency to avoid resource exhaustion)
    if failed_tickers:
        print(f"Retrying {len(failed_tickers)} failed tickers sequentially...")
        await asyncio.sleep(3.0)  # longer pause before retries
        retried = 0
        for ticker in failed_tickers:
            result = compute_and_store(ticker)
            if result is not None:
                retried += 1
                success += 1
        failed_count = len(failed_tickers) - retried
        print(f"  Retry recovered {retried}/{len(failed_tickers)} tickers")
        return success, failed_count

    return success, len(failed_tickers)


def precompute_theses():
    """Pre-generate theses for top 25 and bottom 25 EVS tickers using Haiku."""
    import anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("Skipping thesis precompute: no ANTHROPIC_API_KEY")
        return

    # Get top 25 and bottom 25 by EVS score
    top = sb.table("equity_value_scores").select("ticker").order("score", desc=True).limit(25).execute().data or []
    bottom = sb.table("equity_value_scores").select("ticker").order("score", desc=False).limit(25).execute().data or []
    tickers = list({r["ticker"] for r in top + bottom})

    # Filter out tickers with fresh cached theses (< 24h old)
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    try:
        cached = sb.table("cached_theses").select("ticker").gte("generated_at", cutoff).in_("ticker", tickers).execute().data or []
        cached_tickers = {r["ticker"] for r in cached}
        tickers = [t for t in tickers if t not in cached_tickers]
    except Exception:
        pass  # Table might not exist yet

    if not tickers:
        print("All top/bottom theses already cached")
        return

    print(f"Precomputing theses for {len(tickers)} tickers (Haiku)...")
    client = anthropic.Anthropic(api_key=api_key)

    generated = 0
    for ticker in tickers:
        try:
            fund = sb.table("stock_fundamentals").select("*").eq("ticker", ticker).limit(1).execute().data
            if not fund:
                continue
            row = fund[0]
            evs = sb.table("equity_value_scores").select("score,verdict").eq("ticker", ticker).limit(1).execute().data
            evs_info = evs[0] if evs else {}

            prompt = f"""Write a concise 3-paragraph investment thesis for {row.get('name', ticker)} ({ticker}).
Sector: {row.get('sector', 'N/A')} | Price: ${row.get('current_price', 'N/A')} | Market Cap: {row.get('market_cap', 'N/A')}
P/E: {row.get('pe_ratio', 'N/A')} | ROE: {row.get('roe', 'N/A')} | Revenue Growth: {row.get('revenue_growth', 'N/A')}
EVS Score: {evs_info.get('score', 'N/A')} ({evs_info.get('verdict', 'N/A')})

Paragraph 1: Investment thesis summary. Paragraph 2: Key strengths and catalysts. Paragraph 3: Main risks.
Be direct and analytical. Use specific numbers."""

            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=800,
                messages=[{"role": "user", "content": prompt}],
            )
            thesis_text = message.content[0].text

            sb.table("cached_theses").upsert({
                "ticker": ticker,
                "thesis_html": thesis_text,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }, on_conflict="ticker").execute()
            generated += 1
        except Exception as e:
            print(f"  THESIS ERROR {ticker}: {e}")

    print(f"Precomputed {generated} theses")


def main():
    tickers = fetch_all_tickers()
    print(f"Computing EVS for {len(tickers)} tickers (parallel batches of 10)...")

    success, failed = asyncio.run(compute_all_evs(tickers))
    print(f"Done: {success} computed, {failed} failed out of {len(tickers)}")

    if failed > len(tickers) * 0.50:
        print("CRITICAL: >50% failure rate — check data sources and API keys")
        sys.exit(1)
    elif failed > len(tickers) * 0.25:
        print("WARNING: >25% failure rate — some data sources may be unavailable")

    # Phase 1.5: compute sector-relative rankings
    print("Computing sector rankings...")
    compute_sector_rankings()

    # Precompute theses for top/bottom 50 EVS tickers
    print("Precomputing theses...")
    precompute_theses()

    # Phase 2: backfill accuracy for snapshots from 6/12 months ago
    print("Backfilling accuracy data...")
    backfill_accuracy()

    # Fire alerts for score changes
    print("Checking alert subscriptions...")
    fire_alerts()


if __name__ == "__main__":
    main()
