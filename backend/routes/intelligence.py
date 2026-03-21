"""Routes for analyst data, insider trades, earnings, dividends, scores, senate."""
from fastapi import APIRouter, HTTPException, Request
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY, validate_ticker
from rate_limit import limiter

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

router = APIRouter()


@router.get("/analyst/{ticker}")
@limiter.limit("30/minute")
async def get_analyst(request: Request, ticker: str):
    ticker = validate_ticker(ticker)
    row = supabase.table("analyst_data") \
        .select("*") \
        .eq("ticker", ticker) \
        .limit(1) \
        .execute().data
    if not row:
        raise HTTPException(404, f"No analyst data for {ticker}")
    return row[0]


@router.get("/insider/{ticker}")
@limiter.limit("30/minute")
async def get_insider(request: Request, ticker: str):
    ticker = validate_ticker(ticker)
    insiders = supabase.table("insider_trades") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("filing_date", desc=True) \
        .limit(50) \
        .execute().data

    senate = supabase.table("senate_trades") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("transaction_date", desc=True) \
        .limit(20) \
        .execute().data

    return {"insider": insiders, "senate": senate}


@router.get("/earnings/{ticker}")
@limiter.limit("30/minute")
async def get_earnings(request: Request, ticker: str):
    ticker = validate_ticker(ticker)
    rows = supabase.table("earnings_history") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("date", desc=True) \
        .limit(20) \
        .execute().data
    return rows


@router.get("/dividends/{ticker}")
@limiter.limit("30/minute")
async def get_dividends(request: Request, ticker: str):
    ticker = validate_ticker(ticker)
    rows = supabase.table("dividends_history") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("ex_date", desc=True) \
        .limit(40) \
        .execute().data
    return rows


@router.get("/scores/{ticker}")
@limiter.limit("30/minute")
async def get_scores(request: Request, ticker: str):
    ticker = validate_ticker(ticker)
    row = supabase.table("company_scores") \
        .select("*") \
        .eq("ticker", ticker) \
        .limit(1) \
        .execute().data
    if not row:
        raise HTTPException(404, f"No score data for {ticker}")
    return row[0]
