"""Routes for analyst data, insider trades, earnings, dividends, scores, senate."""
from fastapi import APIRouter, HTTPException
import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://efbtgnplotlshrwbotfp.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmYnRnbnBsb3Rsc2hyd2JvdGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDEzODIsImV4cCI6MjA4ODQ3NzM4Mn0.grKm3Rh-UtXU3bIz2ajLNiVxbfTECC9cwuslZe_BY-I")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

router = APIRouter()


@router.get("/analyst/{ticker}")
async def get_analyst(ticker: str):
    ticker = ticker.upper().strip()
    row = supabase.table("analyst_data") \
        .select("*") \
        .eq("ticker", ticker) \
        .limit(1) \
        .execute().data
    if not row:
        raise HTTPException(404, f"No analyst data for {ticker}")
    return row[0]


@router.get("/insider/{ticker}")
async def get_insider(ticker: str):
    ticker = ticker.upper().strip()
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
async def get_earnings(ticker: str):
    ticker = ticker.upper().strip()
    rows = supabase.table("earnings_history") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("date", desc=True) \
        .limit(20) \
        .execute().data
    return rows


@router.get("/dividends/{ticker}")
async def get_dividends(ticker: str):
    ticker = ticker.upper().strip()
    rows = supabase.table("dividends_history") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("ex_date", desc=True) \
        .limit(40) \
        .execute().data
    return rows


@router.get("/scores/{ticker}")
async def get_scores(ticker: str):
    ticker = ticker.upper().strip()
    row = supabase.table("company_scores") \
        .select("*") \
        .eq("ticker", ticker) \
        .limit(1) \
        .execute().data
    if not row:
        raise HTTPException(404, f"No score data for {ticker}")
    return row[0]
