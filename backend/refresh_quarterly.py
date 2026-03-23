"""
Quarterly refresh: financial_statements + earnings_history.
Fetches 5 years of quarterly + annual data from FMP and upserts into Supabase.
Usage: FMP_KEY=... SUPABASE_URL=... SUPABASE_KEY=... python3 refresh_quarterly.py
"""
import os
import time
from datetime import datetime
from supabase import create_client
from fmp_client import fmp_get_list, _safe

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit(
        "SUPABASE_URL and SUPABASE_KEY must be set. "
        "Add them as GitHub Actions secrets or export in your shell."
    )

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

LIMIT = 20  # 5 years × 4 quarters = 20, plus 5 annual = 25 total


def get_all_tickers():
    rows = supabase.table("stock_fundamentals").select("ticker").execute().data
    return [r["ticker"] for r in rows]


def determine_period_type(date_str: str, period_str: str) -> str:
    """Map FMP period field to Q1/Q2/Q3/Q4/FY."""
    if period_str and period_str.upper() == "FY":
        return "FY"
    if period_str and period_str.upper().startswith("Q"):
        return period_str.upper()  # Q1, Q2, Q3, Q4
    # Fallback: guess from date
    if date_str:
        month = int(date_str.split("-")[1])
        return {1: "Q1", 2: "Q1", 3: "Q1", 4: "Q2", 5: "Q2", 6: "Q2",
                7: "Q3", 8: "Q3", 9: "Q3", 10: "Q4", 11: "Q4", 12: "Q4"}[month]
    return "FY"


def fetch_statements(ticker: str):
    """Fetch all 3 statements (quarterly + annual) and upsert."""
    statement_configs = [
        ("income-statement", "income", map_income),
        ("balance-sheet-statement", "balance", map_balance),
        ("cash-flow-statement", "cashflow", map_cashflow),
    ]

    total = 0
    for endpoint, stmt_type, mapper in statement_configs:
        # Annual
        annual = fmp_get_list(endpoint, {"symbol": ticker, "limit": 5})
        for row in annual:
            record = mapper(row)
            record["ticker"] = ticker
            record["statement_type"] = stmt_type
            record["period_date"] = row.get("date")
            record["period_type"] = "FY"
            upsert_statement(record)
            total += 1

        # Quarterly
        quarterly = fmp_get_list(endpoint, {"symbol": ticker, "period": "quarter", "limit": LIMIT})
        for row in quarterly:
            record = mapper(row)
            record["ticker"] = ticker
            record["statement_type"] = stmt_type
            record["period_date"] = row.get("date")
            record["period_type"] = determine_period_type(row.get("date"), row.get("period"))
            upsert_statement(record)
            total += 1

    return total


def map_income(d: dict) -> dict:
    return {
        "revenue": _safe(d.get("revenue")),
        "cost_of_revenue": _safe(d.get("costOfRevenue")),
        "gross_profit": _safe(d.get("grossProfit")),
        "gross_profit_ratio": _safe(d.get("grossProfitRatio")),
        "research_and_development": _safe(d.get("researchAndDevelopmentExpenses")),
        "selling_general_admin": _safe(d.get("sellingGeneralAndAdministrativeExpenses")),
        "operating_expenses": _safe(d.get("operatingExpenses")),
        "operating_income": _safe(d.get("operatingIncome")),
        "operating_income_ratio": _safe(d.get("operatingIncomeRatio")),
        "interest_income": _safe(d.get("interestIncome")),
        "interest_expense": _safe(d.get("interestExpense")),
        "income_before_tax": _safe(d.get("incomeBeforeTax")),
        "income_tax_expense": _safe(d.get("incomeTaxExpense")),
        "net_income": _safe(d.get("netIncome")),
        "net_income_ratio": _safe(d.get("netIncomeRatio")),
        "eps": _safe(d.get("eps")),
        "eps_diluted": _safe(d.get("epsdiluted")),
        "weighted_avg_shares": _safe(d.get("weightedAverageShsOut")),
        "weighted_avg_shares_diluted": _safe(d.get("weightedAverageShsOutDil")),
        "ebitda": _safe(d.get("ebitda")),
        "ebitda_ratio": _safe(d.get("ebitdaratio")),
    }


def map_balance(d: dict) -> dict:
    return {
        "cash_and_equivalents": _safe(d.get("cashAndCashEquivalents")),
        "short_term_investments": _safe(d.get("shortTermInvestments")),
        "cash_and_short_term": _safe(d.get("cashAndShortTermInvestments")),
        "net_receivables": _safe(d.get("netReceivables")),
        "inventory": _safe(d.get("inventory")),
        "other_current_assets": _safe(d.get("otherCurrentAssets")),
        "total_current_assets": _safe(d.get("totalCurrentAssets")),
        "property_plant_equipment": _safe(d.get("propertyPlantEquipmentNet")),
        "goodwill": _safe(d.get("goodwill")),
        "intangible_assets": _safe(d.get("intangibleAssets")),
        "long_term_investments": _safe(d.get("longTermInvestments")),
        "other_non_current_assets": _safe(d.get("otherNonCurrentAssets")),
        "total_non_current_assets": _safe(d.get("totalNonCurrentAssets")),
        "total_assets": _safe(d.get("totalAssets")),
        "accounts_payable": _safe(d.get("accountPayables")),
        "short_term_debt": _safe(d.get("shortTermDebt")),
        "other_current_liabilities": _safe(d.get("otherCurrentLiabilities")),
        "total_current_liabilities": _safe(d.get("totalCurrentLiabilities")),
        "long_term_debt": _safe(d.get("longTermDebt")),
        "other_non_current_liabilities": _safe(d.get("otherNonCurrentLiabilities")),
        "total_non_current_liabilities": _safe(d.get("totalNonCurrentLiabilities")),
        "total_liabilities": _safe(d.get("totalLiabilities")),
        "total_stockholders_equity": _safe(d.get("totalStockholdersEquity")),
        "total_equity": _safe(d.get("totalEquity")),
        "total_liabilities_and_equity": _safe(d.get("totalLiabilitiesAndStockholdersEquity")),
        "total_debt": _safe(d.get("totalDebt")),
        "net_debt": _safe(d.get("netDebt")),
    }


def map_cashflow(d: dict) -> dict:
    return {
        "net_income_cf": _safe(d.get("netIncome")),
        "depreciation_amortization": _safe(d.get("depreciationAndAmortization")),
        "stock_based_compensation": _safe(d.get("stockBasedCompensation")),
        "change_in_working_capital": _safe(d.get("changeInWorkingCapital")),
        "accounts_receivables_cf": _safe(d.get("accountsReceivables")),
        "inventory_cf": _safe(d.get("inventory")),
        "accounts_payable_cf": _safe(d.get("accountsPayables")),
        "other_operating_activities": _safe(d.get("otherOperatingActivites")),
        "operating_cash_flow": _safe(d.get("operatingCashFlow")),
        "capital_expenditure": _safe(d.get("capitalExpenditure")),
        "acquisitions": _safe(d.get("acquisitionsNet")),
        "purchases_of_investments": _safe(d.get("purchasesOfInvestments")),
        "sales_of_investments": _safe(d.get("salesMaturitiesOfInvestments")),
        "other_investing_activities": _safe(d.get("otherInvestingActivites")),
        "investing_cash_flow": _safe(d.get("netCashUsedForInvestingActivites")),
        "debt_repayment": _safe(d.get("debtRepayment")),
        "common_stock_issued": _safe(d.get("commonStockIssued")),
        "common_stock_repurchased": _safe(d.get("commonStockRepurchased")),
        "dividends_paid": _safe(d.get("dividendsPaid")),
        "other_financing_activities": _safe(d.get("otherFinancingActivites")),
        "financing_cash_flow": _safe(d.get("netCashUsedProvidedByFinancingActivities")),
        "net_change_in_cash": _safe(d.get("netChangeInCash")),
        "free_cash_flow": _safe(d.get("freeCashFlow")),
    }


def upsert_statement(record: dict):
    clean = {k: v for k, v in record.items() if v is not None}
    if not clean.get("period_date"):
        return
    supabase.table("financial_statements").upsert(
        clean, on_conflict="ticker,period_date,period_type,statement_type"
    ).execute()


def fetch_earnings(ticker: str):
    """Fetch earnings history (EPS actual vs estimate)."""
    data = fmp_get_list("earnings", {"symbol": ticker, "limit": LIMIT})
    count = 0
    for row in data:
        record = {
            "ticker": ticker,
            "date": row.get("date"),
            "fiscal_period": row.get("fiscalDateEnding"),
            "eps_actual": _safe(row.get("epsActual")),
            "eps_estimate": _safe(row.get("epsEstimated")),
            "revenue_actual": _safe(row.get("revenueActual")),
            "revenue_estimate": _safe(row.get("revenueEstimated")),
        }
        if record.get("eps_actual") is not None and record.get("eps_estimate") is not None:
            record["eps_surprise"] = record["eps_actual"] - record["eps_estimate"]
            if record["eps_estimate"] != 0:
                record["eps_surprise_pct"] = round(
                    (record["eps_surprise"] / abs(record["eps_estimate"])) * 100, 2
                )
        if record.get("revenue_actual") is not None and record.get("revenue_estimate") is not None:
            record["revenue_surprise"] = record["revenue_actual"] - record["revenue_estimate"]

        clean = {k: v for k, v in record.items() if v is not None}
        if clean.get("date"):
            supabase.table("earnings_history").upsert(
                clean, on_conflict="ticker,date"
            ).execute()
            count += 1
    return count


def main():
    tickers = get_all_tickers()
    print(f"Quarterly refresh for {len(tickers)} tickers\n")

    for i, ticker in enumerate(tickers):
        print(f"[{i+1}/{len(tickers)}] {ticker}...", end=" ", flush=True)
        try:
            stmt_count = fetch_statements(ticker)
            earn_count = fetch_earnings(ticker)
            print(f"✓ {stmt_count} statements, {earn_count} earnings")
        except Exception as e:
            print(f"✗ {e}")

    print("\nDone.")


if __name__ == "__main__":
    main()
