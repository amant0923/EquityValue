"""
Monthly refresh: generate SWOT and PESTLE analyses for all S&P 500 tickers.
Stores results in qualitative_cache table.

Usage: ANTHROPIC_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python3 refresh_qualitative.py
Schedule: 1st Sunday of month via GitHub Actions

Only regenerates if data is NULL or older than 30 days.
Cost: ~$7.50 for all SWOT + PESTLE across ~500 tickers.
"""
import os
import sys
import json
import re
import time
import logging
from datetime import datetime, timedelta, timezone

from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

# ── Supabase setup ────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", os.environ.get("SUPABASE_KEY", ""))
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.")

if not ANTHROPIC_API_KEY:
    raise SystemExit("ANTHROPIC_API_KEY must be set.")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

CLAUDE_MODEL = "claude-haiku-4-5-20251001"
FRESHNESS_DAYS = 30


def get_all_tickers():
    rows = supabase.table("stock_fundamentals").select("ticker").execute().data
    return [r["ticker"] for r in rows]


def _get_anthropic_client():
    import anthropic
    return anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def _fmt(value, prefix="", suffix="", default="N/A") -> str:
    if value is None:
        return default
    if isinstance(value, (int, float)):
        if abs(value) >= 1_000_000_000:
            return f"{prefix}{value / 1_000_000_000:.1f}B{suffix}"
        if abs(value) >= 1_000_000:
            return f"{prefix}{value / 1_000_000:.1f}M{suffix}"
        return f"{prefix}{value:,.2f}{suffix}"
    return f"{prefix}{value}{suffix}"


def _fmt_pct(value, default="N/A") -> str:
    if value is None:
        return default
    if isinstance(value, (int, float)):
        if -1 < value < 1:
            return f"{value * 100:.1f}%"
        return f"{value:.1f}%"
    return str(value)


def _extract_json(text: str) -> dict:
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group())
        except (json.JSONDecodeError, TypeError):
            pass
    raise ValueError("Could not parse JSON from AI response")


def _is_fresh(timestamp_str: str | None) -> bool:
    """Check if a timestamp is less than FRESHNESS_DAYS old."""
    if not timestamp_str:
        return False
    try:
        ts = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        cutoff = datetime.now(timezone.utc) - timedelta(days=FRESHNESS_DAYS)
        return ts > cutoff
    except Exception:
        return False


def generate_swot(client, ticker: str, data: dict) -> dict:
    """Generate SWOT analysis via Claude."""
    company_name = data.get("name", ticker)
    sector = data.get("sector", "Unknown")
    market_cap = _fmt(data.get("market_cap"), prefix="$")
    revenue = _fmt(data.get("revenue"), prefix="$")
    profit_margin = _fmt_pct(data.get("profit_margin"))
    revenue_growth = _fmt_pct(data.get("revenue_growth"))
    pe_ratio = _fmt(data.get("pe_ratio"))
    debt_equity = _fmt(data.get("debt_equity"))

    prompt = (
        f"Analyze {company_name} ({ticker}) in the {sector} sector.\n"
        f"Market Cap: {market_cap}, Revenue: {revenue}, Profit Margin: {profit_margin}, "
        f"Revenue Growth: {revenue_growth}, P/E: {pe_ratio}, Debt/Equity: {debt_equity}.\n\n"
        f"Provide a SWOT analysis. Return ONLY valid JSON with this exact structure:\n"
        f'{{"strengths": ["point 1", "point 2", "point 3"], '
        f'"weaknesses": ["point 1", "point 2", "point 3"], '
        f'"opportunities": ["point 1", "point 2", "point 3"], '
        f'"threats": ["point 1", "point 2", "point 3"], '
        f'"summary": "1-2 sentence summary"}}'
    )

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1000,
        system="Return only valid JSON, no markdown.",
        messages=[{"role": "user", "content": prompt}],
    )
    raw_text = response.content[0].text
    parsed = _extract_json(raw_text)

    return {
        "strengths": parsed.get("strengths", []),
        "weaknesses": parsed.get("weaknesses", []),
        "opportunities": parsed.get("opportunities", []),
        "threats": parsed.get("threats", []),
        "summary": parsed.get("summary", ""),
    }


def generate_pestle(client, ticker: str, data: dict) -> dict:
    """Generate PESTLE analysis via Claude."""
    company_name = data.get("name", ticker)
    sector = data.get("sector", "Unknown")
    industry = data.get("industry", "Unknown")
    market_cap = _fmt(data.get("market_cap"), prefix="$")
    revenue = _fmt(data.get("revenue"), prefix="$")

    prompt = (
        f"Analyze {company_name} ({ticker}) in the {sector}/{industry} sector.\n"
        f"Market Cap: {market_cap}, Revenue: {revenue}.\n\n"
        f"Provide a PESTLE analysis. Return ONLY valid JSON with this exact structure:\n"
        f'{{"political": {{"impact": "high|medium|low", "analysis": "2-3 sentences", "factors": ["factor1", "factor2"]}}, '
        f'"economic": {{"impact": "high|medium|low", "analysis": "2-3 sentences", "factors": ["factor1", "factor2"]}}, '
        f'"social": {{"impact": "high|medium|low", "analysis": "2-3 sentences", "factors": ["factor1", "factor2"]}}, '
        f'"technological": {{"impact": "high|medium|low", "analysis": "2-3 sentences", "factors": ["factor1", "factor2"]}}, '
        f'"legal": {{"impact": "high|medium|low", "analysis": "2-3 sentences", "factors": ["factor1", "factor2"]}}, '
        f'"environmental": {{"impact": "high|medium|low", "analysis": "2-3 sentences", "factors": ["factor1", "factor2"]}}}}'
    )

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1500,
        system="Return only valid JSON, no markdown.",
        messages=[{"role": "user", "content": prompt}],
    )
    raw_text = response.content[0].text
    parsed = _extract_json(raw_text)

    pestle_keys = ["political", "economic", "social", "technological", "legal", "environmental"]
    result = {}
    for key in pestle_keys:
        entry = parsed.get(key, {})
        result[key] = {
            "impact": entry.get("impact", "medium"),
            "analysis": entry.get("analysis", ""),
            "factors": entry.get("factors", []),
        }
    return result


def main():
    tickers = get_all_tickers()
    total = len(tickers)
    print(f"Refreshing qualitative analysis for {total} tickers...")
    print(f"Only regenerating data older than {FRESHNESS_DAYS} days.\n")

    client = _get_anthropic_client()

    # Fetch existing cache to check freshness
    existing = {}
    try:
        rows = supabase.table("qualitative_cache").select("ticker, swot_generated_at, pestle_generated_at").execute().data
        for r in rows:
            existing[r["ticker"]] = r
    except Exception:
        pass

    ok = 0
    skipped = 0
    fail = 0

    for i, ticker in enumerate(tickers):
        try:
            cached = existing.get(ticker, {})
            swot_fresh = _is_fresh(cached.get("swot_generated_at"))
            pestle_fresh = _is_fresh(cached.get("pestle_generated_at"))

            if swot_fresh and pestle_fresh:
                skipped += 1
                if (i + 1) % 50 == 0:
                    print(f"  [{i+1}/{total}] Progress: {ok} OK, {skipped} skipped, {fail} failed")
                continue

            # Fetch company data
            fund_rows = supabase.table("stock_fundamentals").select("*").eq("ticker", ticker).limit(1).execute().data
            data = fund_rows[0] if fund_rows else {}

            now = datetime.now(timezone.utc).isoformat()
            record = {"ticker": ticker}

            # Generate SWOT if stale
            if not swot_fresh:
                try:
                    swot = generate_swot(client, ticker, data)
                    record["swot"] = json.dumps(swot)
                    record["swot_generated_at"] = now
                    time.sleep(1)  # Anthropic rate limit
                except Exception as e:
                    logger.warning(f"SWOT failed for {ticker}: {e}")

            # Generate PESTLE if stale
            if not pestle_fresh:
                try:
                    pestle = generate_pestle(client, ticker, data)
                    record["pestle"] = json.dumps(pestle)
                    record["pestle_generated_at"] = now
                    time.sleep(1)  # Anthropic rate limit
                except Exception as e:
                    logger.warning(f"PESTLE failed for {ticker}: {e}")

            # Only upsert if we generated something new
            if len(record) > 1:
                supabase.table("qualitative_cache").upsert(record, on_conflict="ticker").execute()
                ok += 1
                print(f"  [{i+1}/{total}] {ticker} — OK")
            else:
                fail += 1

        except Exception as e:
            fail += 1
            print(f"  [{i+1}/{total}] {ticker} — FAILED: {e}")

    print(f"\nDone: {ok} generated, {skipped} skipped (fresh), {fail} failed out of {total}")


if __name__ == "__main__":
    main()
