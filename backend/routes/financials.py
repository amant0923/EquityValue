"""Routes for financial statements, metrics, growth, segments."""
from fastapi import APIRouter, HTTPException
import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

router = APIRouter()


@router.get("/financials/{ticker}")
async def get_financials(ticker: str, period: str = "annual"):
    """Get all 3 financial statements. period=annual|quarterly"""
    ticker = ticker.upper().strip()
    period_types = ["FY"] if period == "annual" else ["Q1", "Q2", "Q3", "Q4"]

    result = {}
    for stmt_type in ["income", "balance", "cashflow"]:
        rows = supabase.table("financial_statements") \
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
async def get_growth(ticker: str):
    ticker = ticker.upper().strip()
    rows = supabase.table("growth_metrics") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("period_date", desc=True) \
        .limit(25) \
        .execute().data
    return rows


@router.get("/metrics/{ticker}")
async def get_metrics(ticker: str, period: str = "annual"):
    ticker = ticker.upper().strip()
    period_types = ["FY"] if period == "annual" else ["Q1", "Q2", "Q3", "Q4"]

    rows = supabase.table("key_metrics") \
        .select("*") \
        .eq("ticker", ticker) \
        .in_("period_type", period_types) \
        .order("period_date", desc=True) \
        .limit(25) \
        .execute().data
    return rows


@router.get("/segments/{ticker}")
async def get_segments(ticker: str):
    ticker = ticker.upper().strip()
    rows = supabase.table("revenue_segments") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("period_date", desc=True) \
        .execute().data

    product = [r for r in rows if r.get("segment_type") == "product"]
    geographic = [r for r in rows if r.get("segment_type") == "geographic"]
    return {"product": product, "geographic": geographic}
