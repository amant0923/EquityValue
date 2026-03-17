"""Combined summary endpoint for the company landing page."""
from fastapi import APIRouter, HTTPException
import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://efbtgnplotlshrwbotfp.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmYnRnbnBsb3Rsc2hyd2JvdGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDEzODIsImV4cCI6MjA4ODQ3NzM4Mn0.grKm3Rh-UtXU3bIz2ajLNiVxbfTECC9cwuslZe_BY-I")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

router = APIRouter()


@router.get("/summary/{ticker}")
async def get_summary(ticker: str):
    """Single call that returns everything the Summary page needs."""
    ticker = ticker.upper().strip()

    # Company basics from existing table
    basics = supabase.table("stock_fundamentals") \
        .select("*").eq("ticker", ticker).limit(1).execute().data
    if not basics:
        raise HTTPException(404, f"No data for {ticker}")

    # Last 4 quarters of financials (income only for snapshot)
    quarterly_income = supabase.table("financial_statements") \
        .select("period_date,period_type,revenue,net_income,eps,eps_diluted,gross_profit,operating_income,ebitda") \
        .eq("ticker", ticker) \
        .eq("statement_type", "income") \
        .in_("period_type", ["Q1", "Q2", "Q3", "Q4"]) \
        .order("period_date", desc=True) \
        .limit(8) \
        .execute().data

    # Latest key metrics (FY + quarterly)
    metrics = supabase.table("key_metrics") \
        .select("period_date,period_type,pe_ratio,pb_ratio,ev_to_sales,enterprise_value_over_ebitda,roe,roa,dividend_yield,current_ratio,debt_to_equity") \
        .eq("ticker", ticker) \
        .order("period_date", desc=True) \
        .limit(8) \
        .execute().data

    # Analyst
    analyst = supabase.table("analyst_data") \
        .select("*").eq("ticker", ticker).limit(1).execute().data

    # Scores
    scores = supabase.table("company_scores") \
        .select("*").eq("ticker", ticker).limit(1).execute().data

    # Growth (latest)
    growth = supabase.table("growth_metrics") \
        .select("*").eq("ticker", ticker) \
        .order("period_date", desc=True).limit(8).execute().data

    return {
        "company": basics[0] if basics else {},
        "quarterly_financials": quarterly_income,
        "key_metrics": metrics,
        "analyst": analyst[0] if analyst else {},
        "scores": scores[0] if scores else {},
        "growth": growth,
    }
