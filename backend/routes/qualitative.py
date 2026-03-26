"""AI-powered qualitative analysis endpoints (SWOT, PESTLE)."""
import json
import logging
import os
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from auth import get_current_user
from config import validate_ticker
from db import get_supabase_service
from redis_cache import cache_get, cache_set

try:
    from rate_limit import limiter
except Exception:
    limiter = Limiter(key_func=get_remote_address)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis")

SWOT_TTL = 604800  # 7 days
PESTLE_TTL = 604800  # 7 days
CLAUDE_MODEL = "claude-haiku-4-5-20251001"


def _get_anthropic_client():
    """Return an Anthropic client or raise 503 if not configured."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(503, "AI analysis not available — ANTHROPIC_API_KEY not configured")
    import anthropic
    return anthropic.Anthropic(api_key=api_key)


def _fetch_company_data(ticker: str) -> dict:
    """Fetch fundamentals from Supabase. Returns empty dict on failure."""
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
    """Format a value for the prompt, returning default if None."""
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
    """Format a ratio (0.15) or percentage (15.0) as a percent string."""
    if value is None:
        return default
    if isinstance(value, (int, float)):
        # If value looks like a ratio (between -1 and 1), multiply by 100
        if -1 < value < 1:
            return f"{value * 100:.1f}%"
        return f"{value:.1f}%"
    return str(value)


def _extract_json(text: str) -> dict:
    """Try to parse JSON from Claude's response, with fallback regex extraction."""
    # Direct parse
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass

    # Try to find JSON object in the response
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group())
        except (json.JSONDecodeError, TypeError):
            pass

    raise ValueError("Could not parse JSON from AI response")


# ── SWOT Analysis ────────────────────────────────────────────────────────────


@router.post("/swot/{ticker}")
@limiter.limit("5/minute")
async def swot_analysis(request: Request, ticker: str, user: dict = Depends(get_current_user)):
    """Generate an AI-powered SWOT analysis for a company."""
    ticker = validate_ticker(ticker)

    # Check cache
    cache_key = f"swot:{ticker}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    # Fetch company data
    data = _fetch_company_data(ticker)
    company_name = data.get("name", ticker)
    sector = data.get("sector", "Unknown")
    industry = data.get("industry", "Unknown")
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
            model=CLAUDE_MODEL,
            max_tokens=1000,
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

    cache_set(cache_key, result, ttl=SWOT_TTL)
    return result


# ── PESTLE Analysis ──────────────────────────────────────────────────────────


@router.post("/pestle/{ticker}")
@limiter.limit("5/minute")
async def pestle_analysis(request: Request, ticker: str, user: dict = Depends(get_current_user)):
    """Generate an AI-powered PESTLE analysis for a company."""
    ticker = validate_ticker(ticker)

    # Check cache
    cache_key = f"pestle:{ticker}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    # Fetch company data
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
            model=CLAUDE_MODEL,
            max_tokens=1500,
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

    cache_set(cache_key, result, ttl=PESTLE_TTL)
    return result
