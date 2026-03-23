"""Combined summary endpoint for the company landing page."""
from fastapi import APIRouter, HTTPException, Request
from config import validate_ticker
from rate_limit import limiter
from db import get_supabase

router = APIRouter()


@router.get("/summary/{ticker}")
@limiter.limit("30/minute")
async def get_summary(request: Request, ticker: str):
    """Single call that returns everything the Summary page needs."""
    ticker = validate_ticker(ticker)

    # Company basics from existing table
    basics = get_supabase().table("stock_fundamentals") \
        .select("*").eq("ticker", ticker).limit(1).execute().data
    if not basics:
        raise HTTPException(404, f"No data for {ticker}")

    # Last 4 quarters of financials (income only for snapshot)
    quarterly_income = get_supabase().table("financial_statements") \
        .select("period_date,period_type,revenue,net_income,eps,eps_diluted,gross_profit,operating_income,ebitda") \
        .eq("ticker", ticker) \
        .eq("statement_type", "income") \
        .in_("period_type", ["Q1", "Q2", "Q3", "Q4"]) \
        .order("period_date", desc=True) \
        .limit(8) \
        .execute().data

    # Latest key metrics (FY + quarterly)
    metrics = get_supabase().table("key_metrics") \
        .select("period_date,period_type,pe_ratio,pb_ratio,ev_to_sales,enterprise_value_over_ebitda,roe,roa,dividend_yield,current_ratio,debt_to_equity") \
        .eq("ticker", ticker) \
        .order("period_date", desc=True) \
        .limit(8) \
        .execute().data

    # Analyst
    analyst = get_supabase().table("analyst_data") \
        .select("*").eq("ticker", ticker).limit(1).execute().data

    # Scores
    scores = get_supabase().table("company_scores") \
        .select("*").eq("ticker", ticker).limit(1).execute().data

    # Growth (latest)
    growth = get_supabase().table("growth_metrics") \
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
