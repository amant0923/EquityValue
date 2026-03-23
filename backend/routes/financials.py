"""Routes for financial statements, metrics, growth, segments."""
from fastapi import APIRouter, HTTPException, Request
from config import validate_ticker
from rate_limit import limiter
from db import get_supabase

router = APIRouter()


@router.get("/financials/{ticker}")
@limiter.limit("30/minute")
async def get_financials(request: Request, ticker: str, period: str = "annual"):
    """Get all 3 financial statements. period=annual|quarterly"""
    ticker = validate_ticker(ticker)
    if period not in ("annual", "quarterly"):
        raise HTTPException(400, "Invalid period. Use 'annual' or 'quarterly'.")
    period_types = ["FY"] if period == "annual" else ["Q1", "Q2", "Q3", "Q4"]

    result = {}
    for stmt_type in ["income", "balance", "cashflow"]:
        rows = get_supabase().table("financial_statements") \
            .select("*") \
            .eq("ticker", ticker) \
            .eq("statement_type", stmt_type) \
            .in_("period_type", period_types) \
            .order("period_date", desc=True) \
            .limit(25) \
            .execute().data
        result[stmt_type] = rows

    if not any(result.values()):
        raise HTTPException(404, f"No financial data for {ticker}")
    return result


@router.get("/financials/{ticker}/growth")
@limiter.limit("30/minute")
async def get_growth(request: Request, ticker: str):
    ticker = validate_ticker(ticker)
    rows = get_supabase().table("growth_metrics") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("period_date", desc=True) \
        .limit(25) \
        .execute().data
    return rows


@router.get("/metrics/{ticker}")
@limiter.limit("30/minute")
async def get_metrics(request: Request, ticker: str, period: str = "annual"):
    ticker = validate_ticker(ticker)
    if period not in ("annual", "quarterly"):
        raise HTTPException(400, "Invalid period. Use 'annual' or 'quarterly'.")
    period_types = ["FY"] if period == "annual" else ["Q1", "Q2", "Q3", "Q4"]

    rows = get_supabase().table("key_metrics") \
        .select("*") \
        .eq("ticker", ticker) \
        .in_("period_type", period_types) \
        .order("period_date", desc=True) \
        .limit(25) \
        .execute().data
    return rows


@router.get("/segments/{ticker}")
@limiter.limit("30/minute")
async def get_segments(request: Request, ticker: str):
    ticker = validate_ticker(ticker)
    rows = get_supabase().table("revenue_segments") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("period_date", desc=True) \
        .execute().data

    product = [r for r in rows if r.get("segment_type") == "product"]
    geographic = [r for r in rows if r.get("segment_type") == "geographic"]
    return {"product": product, "geographic": geographic}
