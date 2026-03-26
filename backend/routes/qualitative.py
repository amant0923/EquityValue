"""AI-powered qualitative analysis endpoints (SWOT, PESTLE).

Data is pre-computed monthly by refresh_qualitative.py and cached in Supabase.
POST endpoints check cache first; generate on demand only if stale/missing.
"""
import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from auth import get_current_user
from config import validate_ticker
from db import get_supabase_service

try:
    from rate_limit import limiter
except Exception:
    limiter = Limiter(key_func=get_remote_address)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis")

CLAUDE_MODEL = "claude-haiku-4-5-20251001"
FRESHNESS_DAYS = 30


def _get_anthropic_client():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(503, "AI analysis not available — ANTHROPIC_API_KEY not configured")
    import anthropic
    return anthropic.Anthropic(api_key=api_key)


def _fetch_company_data(ticker: str) -> dict:
    sb = get_supabase_service()
    if not sb:
        return {}
    try:
        rows = sb.table("stock_fundamentals").select("*").eq("ticker", ticker).limit(1).execute().data
        return rows[0] if rows else {}
    except Exception as e:
        logger.warning("Failed to fetch fundamentals for %s: %s", ticker, e)
        return {}


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


def _is_fresh(timestamp_str) -> bool:
    if not timestamp_str:
        return False
    try:
        ts = datetime.fromisoformat(str(timestamp_str).replace("Z", "+00:00"))
        cutoff = datetime.now(timezone.utc) - timedelta(days=FRESHNESS_DAYS)
        return ts > cutoff
    except Exception:
        return False


# ── SWOT Analysis ────────────────────────────────────────────────────────────

@router.post("/swot/{ticker}")
@limiter.limit("10/minute")
async def swot_analysis(request: Request, ticker: str, user: dict = Depends(get_current_user)):
    """Return SWOT analysis — from cache if fresh, else generate on demand."""
    ticker = validate_ticker(ticker)

    sb = get_supabase_service()
    if sb:
        row = sb.table("qualitative_cache").select("ticker, swot, swot_generated_at").eq("ticker", ticker).limit(1).execute().data
        if row and row[0].get("swot") and _is_fresh(row[0].get("swot_generated_at")):
            cached = row[0]["swot"]
            if isinstance(cached, str):
                cached = json.loads(cached)
            cached["ticker"] = ticker
            return cached

    # Generate on demand
    data = _fetch_company_data(ticker)
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

    client = _get_anthropic_client()
    try:
        response = client.messages.create(
            model=CLAUDE_MODEL, max_tokens=1000,
            system="Return only valid JSON, no markdown.",
            messages=[{"role": "user", "content": prompt}],
        )
        raw_text = response.content[0].text
    except Exception as e:
        logger.error("Claude API error for SWOT %s: %s", ticker, e)
        raise HTTPException(502, f"AI analysis failed: {str(e)}")

    try:
        parsed = _extract_json(raw_text)
    except ValueError:
        logger.error("Failed to parse SWOT JSON for %s: %s", ticker, raw_text[:500])
        raise HTTPException(502, "AI returned malformed response — please try again")

    result = {
        "ticker": ticker,
        "strengths": parsed.get("strengths", []),
        "weaknesses": parsed.get("weaknesses", []),
        "opportunities": parsed.get("opportunities", []),
        "threats": parsed.get("threats", []),
        "summary": parsed.get("summary", ""),
    }

    # Save to cache
    if sb:
        try:
            now = datetime.now(timezone.utc).isoformat()
            sb.table("qualitative_cache").upsert({
                "ticker": ticker,
                "swot": json.dumps(result),
                "swot_generated_at": now,
            }, on_conflict="ticker").execute()
        except Exception as e:
            logger.warning("Failed to cache SWOT for %s: %s", ticker, e)

    return result


# ── PESTLE Analysis ──────────────────────────────────────────────────────────

@router.post("/pestle/{ticker}")
@limiter.limit("10/minute")
async def pestle_analysis(request: Request, ticker: str, user: dict = Depends(get_current_user)):
    """Return PESTLE analysis — from cache if fresh, else generate on demand."""
    ticker = validate_ticker(ticker)

    sb = get_supabase_service()
    if sb:
        row = sb.table("qualitative_cache").select("ticker, pestle, pestle_generated_at").eq("ticker", ticker).limit(1).execute().data
        if row and row[0].get("pestle") and _is_fresh(row[0].get("pestle_generated_at")):
            cached = row[0]["pestle"]
            if isinstance(cached, str):
                cached = json.loads(cached)
            cached["ticker"] = ticker
            return cached

    # Generate on demand
    data = _fetch_company_data(ticker)
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

    client = _get_anthropic_client()
    try:
        response = client.messages.create(
            model=CLAUDE_MODEL, max_tokens=1500,
            system="Return only valid JSON, no markdown.",
            messages=[{"role": "user", "content": prompt}],
        )
        raw_text = response.content[0].text
    except Exception as e:
        logger.error("Claude API error for PESTLE %s: %s", ticker, e)
        raise HTTPException(502, f"AI analysis failed: {str(e)}")

    try:
        parsed = _extract_json(raw_text)
    except ValueError:
        logger.error("Failed to parse PESTLE JSON for %s: %s", ticker, raw_text[:500])
        raise HTTPException(502, "AI returned malformed response — please try again")

    pestle_keys = ["political", "economic", "social", "technological", "legal", "environmental"]
    result = {"ticker": ticker}
    for key in pestle_keys:
        entry = parsed.get(key, {})
        result[key] = {
            "impact": entry.get("impact", "medium"),
            "analysis": entry.get("analysis", ""),
            "factors": entry.get("factors", []),
        }

    # Save to cache
    if sb:
        try:
            now = datetime.now(timezone.utc).isoformat()
            sb.table("qualitative_cache").upsert({
                "ticker": ticker,
                "pestle": json.dumps(result),
                "pestle_generated_at": now,
            }, on_conflict="ticker").execute()
        except Exception as e:
            logger.warning("Failed to cache PESTLE for %s: %s", ticker, e)

    return result
