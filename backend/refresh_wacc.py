"""
Weekly refresh: compute WACC for all S&P 500 tickers.
Stores results in wacc_cache table.

Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python3 refresh_wacc.py
Schedule: Sunday 6am ET via GitHub Actions

Pure computation from existing Supabase data — no external API calls.
Should complete in <1 minute for ~500 tickers.
"""
import os
import sys
import json
import time

from supabase import create_client

# ── Supabase setup ────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", os.environ.get("SUPABASE_KEY", ""))

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_all_tickers():
    rows = supabase.table("stock_fundamentals").select("ticker").execute().data
    return [r["ticker"] for r in rows]


def _safe_float(val, default=None):
    if val is None:
        return default
    try:
        f = float(val)
        return f if f == f else default  # NaN check
    except (TypeError, ValueError):
        return default


def compute_wacc(ticker: str) -> dict | None:
    """Compute WACC for a ticker using Supabase data only. Returns dict or None."""
    # 1. Fetch fundamentals
    fund_row = supabase.table("stock_fundamentals") \
        .select("beta, market_cap, total_debt, total_cash, shares_outstanding, current_price") \
        .eq("ticker", ticker).limit(1).execute().data

    if not fund_row:
        return None

    stock = fund_row[0]
    beta = _safe_float(stock.get("beta"), 1.0)
    market_cap = _safe_float(stock.get("market_cap"), 0)
    total_debt = _safe_float(stock.get("total_debt"), 0)
    total_cash = _safe_float(stock.get("total_cash"), 0)
    shares_outstanding = _safe_float(stock.get("shares_outstanding"), 0)
    price = _safe_float(stock.get("current_price"), 0)

    if market_cap <= 0:
        return None

    # 2. Fetch most recent income statement
    fin_rows = supabase.table("financial_statements") \
        .select("income_tax_expense, income_before_tax, interest_expense") \
        .eq("ticker", ticker).eq("statement_type", "income") \
        .order("period_date", desc=True).limit(1).execute().data

    income_tax_expense = None
    income_before_tax = None
    interest_expense = None
    if fin_rows:
        row = fin_rows[0]
        income_tax_expense = _safe_float(row.get("income_tax_expense"))
        income_before_tax = _safe_float(row.get("income_before_tax"))
        interest_expense = _safe_float(row.get("interest_expense"))

    # 3. Risk-free rate
    from valuation.sector_multiples import get_risk_free_rate
    risk_free_rate = get_risk_free_rate()

    # WACC calculation
    market_risk_premium = 0.059
    cost_of_equity = risk_free_rate + beta * market_risk_premium

    if (income_tax_expense is not None and income_before_tax is not None
            and income_before_tax > 0):
        effective_tax_rate = income_tax_expense / income_before_tax
        effective_tax_rate = max(0.0, min(0.4, effective_tax_rate))
    else:
        effective_tax_rate = 0.21

    if interest_expense is not None and total_debt > 0 and interest_expense > 0:
        cost_of_debt_pretax = abs(interest_expense) / total_debt
    else:
        cost_of_debt_pretax = 0.045

    cost_of_debt_after_tax = cost_of_debt_pretax * (1 - effective_tax_rate)

    total_capital = market_cap + total_debt
    if total_capital <= 0:
        total_capital = market_cap

    equity_weight = market_cap / total_capital
    debt_weight = total_debt / total_capital

    wacc = equity_weight * cost_of_equity + debt_weight * cost_of_debt_after_tax
    wacc = max(0.04, min(0.20, wacc))

    net_debt = total_debt - total_cash
    enterprise_value = market_cap + net_debt

    return {
        "ticker": ticker,
        "wacc": round(wacc, 6),
        "components": {
            "risk_free_rate": round(risk_free_rate, 6),
            "beta": round(beta, 6),
            "market_risk_premium": round(market_risk_premium, 6),
            "cost_of_equity": round(cost_of_equity, 6),
            "cost_of_debt_pretax": round(cost_of_debt_pretax, 6),
            "effective_tax_rate": round(effective_tax_rate, 6),
            "cost_of_debt_after_tax": round(cost_of_debt_after_tax, 6),
            "equity_weight": round(equity_weight, 6),
            "debt_weight": round(debt_weight, 6),
        },
        "capital_structure": {
            "market_cap": int(market_cap),
            "total_debt": int(total_debt),
            "total_cash": int(total_cash),
            "net_debt": int(net_debt),
            "enterprise_value": int(enterprise_value),
            "shares_outstanding": int(shares_outstanding),
            "price": round(price, 2),
        },
    }


def main():
    tickers = get_all_tickers()
    total = len(tickers)
    print(f"Refreshing WACC for {total} tickers...")

    ok = 0
    fail = 0

    for i, ticker in enumerate(tickers):
        try:
            result = compute_wacc(ticker)
            if result is None:
                print(f"  [{i+1}/{total}] {ticker} — SKIPPED (missing data)")
                fail += 1
                continue

            record = {
                "ticker": ticker,
                "wacc": result["wacc"],
                "components": json.dumps(result["components"]),
                "capital_structure": json.dumps(result["capital_structure"]),
            }

            supabase.table("wacc_cache").upsert(record, on_conflict="ticker").execute()
            ok += 1

            if (i + 1) % 50 == 0:
                print(f"  [{i+1}/{total}] Progress: {ok} OK, {fail} failed")

        except Exception as e:
            fail += 1
            print(f"  [{i+1}/{total}] {ticker} — FAILED: {e}")

    print(f"\nDone: {ok} OK, {fail} failed/skipped out of {total}")


if __name__ == "__main__":
    main()
