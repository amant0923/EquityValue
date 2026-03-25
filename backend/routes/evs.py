"""EVS (Equity Value Score) API endpoints."""
from fastapi import APIRouter, HTTPException, Query, Request
from config import validate_ticker
from rate_limit import limiter
from db import get_supabase

router = APIRouter(prefix="/evs")


@router.get("/top")
@limiter.limit("30/minute")
async def evs_top(request: Request, limit: int = Query(default=20, ge=1, le=50)):
    """Top N highest EVS scores. Public endpoint for SEO."""
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")
    rows = sb.table("equity_value_scores") \
        .select("ticker, score, verdict, components, computed_at") \
        .order("score", desc=True) \
        .limit(limit) \
        .execute().data
    return rows


@router.get("/bottom")
@limiter.limit("30/minute")
async def evs_bottom(request: Request, limit: int = Query(default=20, ge=1, le=50)):
    """Bottom N lowest EVS scores. Public endpoint for SEO."""
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")
    rows = sb.table("equity_value_scores") \
        .select("ticker, score, verdict, components, computed_at") \
        .order("score", desc=False) \
        .limit(limit) \
        .execute().data
    return rows


@router.get("/sectors")
@limiter.limit("30/minute")
async def evs_sector_summaries(request: Request):
    """Summary stats per sector (avg score, top ticker, count)."""
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")
    evs_result = sb.table("equity_value_scores").select("ticker, score, verdict").limit(1000).execute()
    fund_result = sb.table("stock_fundamentals").select("ticker, sector").limit(1000).execute()
    sector_map = {f["ticker"]: f["sector"] for f in fund_result.data}
    scores = [{"ticker": r["ticker"], "score": r["score"], "sector": sector_map.get(r["ticker"], "Unknown")}
              for r in evs_result.data if r["ticker"] in sector_map]
    from evs.sector import get_sector_summaries
    return get_sector_summaries(scores)


@router.get("/sector/{sector}")
@limiter.limit("30/minute")
async def evs_by_sector(request: Request, sector: str, limit: int = Query(default=50, ge=1, le=100)):
    """All tickers in a sector, sorted by EVS score."""
    # Validate sector input to prevent injection via PostgREST operators
    if not sector or len(sector) > 100 or not all(c.isalnum() or c in (' ', '&', '-') for c in sector):
        raise HTTPException(400, "Invalid sector name")
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")
    # Get tickers in this sector from fundamentals
    fund_rows = sb.table("stock_fundamentals").select("ticker").eq("sector", sector).execute().data
    if not fund_rows:
        raise HTTPException(404, f"No tickers found for sector: {sector}")
    tickers = [f["ticker"] for f in fund_rows]
    # Get their EVS scores
    result = sb.table("equity_value_scores") \
        .select("ticker, score, verdict, sector_rank, sector_percentile, sector_total, computed_at") \
        .in_("ticker", tickers) \
        .order("score", desc=True) \
        .limit(limit) \
        .execute()
    return result.data


@router.get("/{ticker}")
@limiter.limit("30/minute")
async def evs_detail(request: Request, ticker: str):
    """EVS score + component breakdown + sector context for a single ticker."""
    ticker = validate_ticker(ticker)
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")
    row = sb.table("equity_value_scores") \
        .select("*") \
        .eq("ticker", ticker) \
        .limit(1) \
        .execute().data
    if not row:
        raise HTTPException(404, f"No EVS data for {ticker}")

    # Score history for sparkline
    history = sb.table("equity_value_score_history") \
        .select("score, verdict, computed_at") \
        .eq("ticker", ticker) \
        .order("computed_at", desc=True) \
        .limit(365) \
        .execute().data

    # Compute trend metrics from history
    from evs.trends import compute_trend_metrics
    trend = compute_trend_metrics(history)

    # Peer context: fetch all scores in same sector
    fund = sb.table("stock_fundamentals") \
        .select("ticker, sector, industry") \
        .eq("ticker", ticker).limit(1).execute().data
    peer_context = None
    if fund:
        sector = fund[0].get("sector")
        if sector:
            sector_tickers = sb.table("stock_fundamentals") \
                .select("ticker, sector, industry") \
                .eq("sector", sector).execute().data
            sector_ticker_list = [t["ticker"] for t in sector_tickers]
            # Only fetch EVS scores for tickers in this sector (not ALL scores)
            sector_evs = sb.table("equity_value_scores") \
                .select("ticker, score") \
                .in_("ticker", sector_ticker_list) \
                .execute().data if sector_ticker_list else []
            evs_map = {e["ticker"]: e["score"] for e in sector_evs}
            scores = [{"ticker": t["ticker"], "score": evs_map.get(t["ticker"], 0),
                       "sector": t["sector"], "industry": t.get("industry", "")}
                      for t in sector_tickers if t["ticker"] in evs_map]
            from evs.sector import get_peer_context
            peer_context = get_peer_context(ticker, scores)

    return {**row[0], "history": history, "peer_context": peer_context, "trend": trend}
