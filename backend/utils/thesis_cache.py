from datetime import datetime, timezone, timedelta

THESIS_TTL_HOURS = 24


async def get_cached_thesis(sb, ticker: str) -> dict | None:
    """Return cached thesis if fresh enough."""
    result = sb.table("cached_theses").select("*").eq("ticker", ticker.upper()).execute()
    if not result.data:
        return None
    row = result.data[0]
    generated = datetime.fromisoformat(row["generated_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) - generated > timedelta(hours=THESIS_TTL_HOURS):
        return None
    return {"ticker": row["ticker"], "thesis": row["thesis_html"], "cached": True}


async def cache_thesis(sb, ticker: str, thesis_html: str):
    """Upsert thesis to cache."""
    sb.table("cached_theses").upsert({
        "ticker": ticker.upper(),
        "thesis_html": thesis_html,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="ticker").execute()
