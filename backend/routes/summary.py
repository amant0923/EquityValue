"""Combined summary endpoint for the company landing page."""
import logging
from fastapi import APIRouter, HTTPException, Request
from config import validate_ticker
from rate_limit import limiter
from db import get_supabase, parse_json_strings

logger = logging.getLogger(__name__)

router = APIRouter()


def _safe_query(sb, table, query_fn, default=None):
    """Execute a Supabase query with error handling. Returns default on failure."""
    try:
        return query_fn(sb)
    except Exception as e:
        logger.warning("Query failed on %s: %s", table, e)
        return default if default is not None else []


@router.get("/summary/{ticker}")
@limiter.limit("30/minute")
async def get_summary(request: Request, ticker: str):
    """Single call that returns everything the Summary page needs."""
    ticker = validate_ticker(ticker)
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    # Company basics from existing table
    basics = sb.table("stock_fundamentals") \
        .select("*").eq("ticker", ticker).limit(1).execute().data
    if not basics:
        raise HTTPException(404, f"No data for {ticker}")

    # Last 4 quarters of financials (income only for snapshot)
    quarterly_income = _safe_query(sb, "financial_statements", lambda s:
        s.table("financial_statements")
        .select("period_date,period_type,revenue,net_income,eps,eps_diluted,gross_profit,operating_income,ebitda")
        .eq("ticker", ticker)
        .eq("statement_type", "income")
        .in_("period_type", ["Q1", "Q2", "Q3", "Q4"])
        .order("period_date", desc=True)
        .limit(8)
        .execute().data)

    # Latest key metrics (FY + quarterly)
    metrics = _safe_query(sb, "key_metrics", lambda s:
        s.table("key_metrics")
        .select("period_date,period_type,pe_ratio,pb_ratio,ev_to_sales,enterprise_value_over_ebitda,roe,roa,dividend_yield,current_ratio,debt_to_equity")
        .eq("ticker", ticker)
        .order("period_date", desc=True)
        .limit(8)
        .execute().data)

    # Analyst
    analyst = _safe_query(sb, "analyst_data", lambda s:
        s.table("analyst_data")
        .select("*").eq("ticker", ticker).limit(1)
        .execute().data)

    # Scores
    scores = _safe_query(sb, "company_scores", lambda s:
        s.table("company_scores")
        .select("*").eq("ticker", ticker).limit(1)
        .execute().data)

    # Growth (latest)
    growth = _safe_query(sb, "growth_metrics", lambda s:
        s.table("growth_metrics")
        .select("*").eq("ticker", ticker)
        .order("period_date", desc=True).limit(8)
        .execute().data)

    return {
        "company": basics[0] if basics else {},
        "quarterly_financials": quarterly_income or [],
        "key_metrics": metrics or [],
        "analyst": parse_json_strings(analyst[0]) if analyst else {},
        "scores": parse_json_strings(scores[0]) if scores else {},
        "growth": growth or [],
    }
