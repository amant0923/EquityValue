"""
Weekly refresh: key_metrics, growth_metrics, dividends_history, revenue_segments.
Usage: FMP_KEY=... SUPABASE_URL=... SUPABASE_KEY=... python3 refresh_weekly.py
"""
import os
from supabase import create_client
from fmp_client import fmp_get_list, fmp_get_first, _safe

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit(
        "SUPABASE_URL and SUPABASE_KEY must be set. "
        "Add them as GitHub Actions secrets or export in your shell."
    )

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

LIMIT = 20


def get_all_tickers():
    rows = supabase.table("stock_fundamentals").select("ticker").execute().data
    return [r["ticker"] for r in rows]


def refresh_key_metrics(ticker: str) -> int:
    count = 0
    for period_arg, period_prefix in [(None, "FY"), ("quarter", None)]:
        params = {"symbol": ticker, "limit": LIMIT}
        if period_arg:
            params["period"] = period_arg
        data = fmp_get_list("key-metrics", params)
        for row in data:
            period_type = period_prefix or row.get("period", "FY")
            record = {
                "ticker": ticker,
                "period_date": row.get("date"),
                "period_type": period_type.upper(),
                "revenue_per_share": _safe(row.get("revenuePerShare")),
                "net_income_per_share": _safe(row.get("netIncomePerShare")),
                "operating_cash_flow_per_share": _safe(row.get("operatingCashFlowPerShare")),
                "free_cash_flow_per_share": _safe(row.get("freeCashFlowPerShare")),
                "cash_per_share": _safe(row.get("cashPerShare")),
                "book_value_per_share": _safe(row.get("bookValuePerShare")),
                "tangible_book_value_per_share": _safe(row.get("tangibleBookValuePerShare")),
                "shareholders_equity_per_share": _safe(row.get("shareholdersEquityPerShare")),
                "interest_debt_per_share": _safe(row.get("interestDebtPerShare")),
                "market_cap": _safe(row.get("marketCap")),
                "enterprise_value": _safe(row.get("enterpriseValue")),
                "pe_ratio": _safe(row.get("peRatio")),
                "price_to_sales": _safe(row.get("priceToSalesRatio")),
                "pocf_ratio": _safe(row.get("pocfratio")),
                "pfcf_ratio": _safe(row.get("pfcfRatio")),
                "pb_ratio": _safe(row.get("pbRatio")),
                "ptb_ratio": _safe(row.get("ptbRatio")),
                "ev_to_sales": _safe(row.get("evToSales")),
                "enterprise_value_over_ebitda": _safe(row.get("enterpriseValueOverEBITDA")),
                "ev_to_operating_cash_flow": _safe(row.get("evToOperatingCashFlow")),
                "ev_to_free_cash_flow": _safe(row.get("evToFreeCashFlow")),
                "earnings_yield": _safe(row.get("earningsYield")),
                "free_cash_flow_yield": _safe(row.get("freeCashFlowYield")),
                "debt_to_equity": _safe(row.get("debtToEquity")),
                "debt_to_assets": _safe(row.get("debtToAssets")),
                "net_debt_to_ebitda": _safe(row.get("netDebtToEBITDA")),
                "current_ratio": _safe(row.get("currentRatio")),
                "interest_coverage": _safe(row.get("interestCoverage")),
                "income_quality": _safe(row.get("incomeQuality")),
                "dividend_yield": _safe(row.get("dividendYield")),
                "payout_ratio": _safe(row.get("payoutRatio")),
                "sga_to_revenue": _safe(row.get("sgaToRevenue")),
                "rnd_to_revenue": _safe(row.get("researchAndDdevelopementToRevenue")),
                "intangibles_to_total_assets": _safe(row.get("intangiblesToTotalAssets")),
                "capex_to_operating_cash_flow": _safe(row.get("capexToOperatingCashFlow")),
                "capex_to_revenue": _safe(row.get("capexToRevenue")),
                "capex_to_depreciation": _safe(row.get("capexToDepreciation")),
                "stock_based_compensation_to_revenue": _safe(row.get("stockBasedCompensationToRevenue")),
                "graham_number": _safe(row.get("grahamNumber")),
                "roic": _safe(row.get("roic")),
                "return_on_tangible_assets": _safe(row.get("returnOnTangibleAssets")),
                "graham_net_net": _safe(row.get("grahamNetNet")),
                "working_capital": _safe(row.get("workingCapital")),
                "tangible_asset_value": _safe(row.get("tangibleAssetValue")),
                "net_current_asset_value": _safe(row.get("netCurrentAssetValue")),
                "invested_capital": _safe(row.get("investedCapital")),
                "average_receivables": _safe(row.get("averageReceivables")),
                "average_payables": _safe(row.get("averagePayables")),
                "average_inventory": _safe(row.get("averageInventory")),
                "days_sales_outstanding": _safe(row.get("daysSalesOutstanding")),
                "days_payables_outstanding": _safe(row.get("daysPayablesOutstanding")),
                "days_of_inventory_on_hand": _safe(row.get("daysOfInventoryOnHand")),
                "receivables_turnover": _safe(row.get("receivablesTurnover")),
                "payables_turnover": _safe(row.get("payablesTurnover")),
                "inventory_turnover": _safe(row.get("inventoryTurnover")),
                "roe": _safe(row.get("roe")),
                "roa": _safe(row.get("returnOnAssets")),
            }
            clean = {k: v for k, v in record.items() if v is not None}
            if clean.get("period_date"):
                supabase.table("key_metrics").upsert(
                    clean, on_conflict="ticker,period_date,period_type"
                ).execute()
                count += 1
    return count


def refresh_growth(ticker: str) -> int:
    count = 0
    for endpoint in ["income-statement-growth", "balance-sheet-statement-growth", "cash-flow-statement-growth"]:
        data = fmp_get_list(endpoint, {"symbol": ticker, "limit": LIMIT})
        for row in data:
            record = {
                "ticker": ticker,
                "period_date": row.get("date"),
                "period_type": (row.get("period") or "FY").upper(),
                "revenue_growth": _safe(row.get("growthRevenue")),
                "gross_profit_growth": _safe(row.get("growthGrossProfit")),
                "ebitda_growth": _safe(row.get("growthEBITDA")),
                "operating_income_growth": _safe(row.get("growthOperatingIncome")),
                "net_income_growth": _safe(row.get("growthNetIncome")),
                "eps_growth": _safe(row.get("growthEPS")),
                "eps_diluted_growth": _safe(row.get("growthEPSDiluted")),
                "weighted_avg_shares_growth": _safe(row.get("growthWeightedAverageShsOut")),
                "operating_cash_flow_growth": _safe(row.get("growthOperatingCashFlow")),
                "free_cash_flow_growth": _safe(row.get("growthFreeCashFlow")),
                "receivables_growth": _safe(row.get("growthReceivables")),
                "inventory_growth": _safe(row.get("growthInventory")),
                "asset_growth": _safe(row.get("growthTotalAssets")),
                "book_value_per_share_growth": _safe(row.get("growthBookValueperShare")),
                "debt_growth": _safe(row.get("growthTotalDebt") or row.get("growthLongTermDebt")),
                "rd_expense_growth": _safe(row.get("growthRD")),
                "sga_expense_growth": _safe(row.get("growthSGA")),
            }
            clean = {k: v for k, v in record.items() if v is not None}
            if clean.get("period_date"):
                supabase.table("growth_metrics").upsert(
                    clean, on_conflict="ticker,period_date,period_type"
                ).execute()
                count += 1
    return count


def refresh_dividends(ticker: str) -> int:
    data = fmp_get_list("dividends", {"symbol": ticker})
    count = 0
    for row in data:
        record = {
            "ticker": ticker,
            "ex_date": row.get("date"),
            "pay_date": row.get("paymentDate"),
            "record_date": row.get("recordDate"),
            "declaration_date": row.get("declarationDate"),
            "amount": _safe(row.get("dividend") or row.get("adjDividend")),
            "yield": _safe(row.get("yield")),
            "frequency": row.get("frequency"),
        }
        clean = {k: v for k, v in record.items() if v is not None}
        if clean.get("ex_date"):
            supabase.table("dividends_history").upsert(
                clean, on_conflict="ticker,ex_date"
            ).execute()
            count += 1
    return count


def refresh_segments(ticker: str) -> int:
    count = 0
    for seg_type, endpoint in [("product", "revenue-product-segmentation"), ("geographic", "revenue-geographic-segmentation")]:
        data = fmp_get_list(endpoint, {"symbol": ticker})
        for row in data:
            date = row.get("date")
            # FMP returns segments as a dict within each row
            segments = row.get("segments") or row.get(list(row.keys())[-1]) or {}
            if isinstance(segments, dict):
                for name, value in segments.items():
                    if name == "date":
                        continue
                    record = {
                        "ticker": ticker,
                        "period_date": date,
                        "segment_type": seg_type,
                        "segment_name": name,
                        "revenue": _safe(value),
                    }
                    clean = {k: v for k, v in record.items() if v is not None}
                    if clean.get("period_date") and clean.get("segment_name"):
                        supabase.table("revenue_segments").upsert(
                            clean, on_conflict="ticker,period_date,segment_type,segment_name"
                        ).execute()
                        count += 1
    return count


def main():
    tickers = get_all_tickers()
    print(f"Weekly refresh for {len(tickers)} tickers\n")

    for i, ticker in enumerate(tickers):
        print(f"[{i+1}/{len(tickers)}] {ticker}...", end=" ", flush=True)
        try:
            km = refresh_key_metrics(ticker)
            gr = refresh_growth(ticker)
            dv = refresh_dividends(ticker)
            sg = refresh_segments(ticker)
            print(f"✓ metrics:{km} growth:{gr} divs:{dv} segs:{sg}")
        except Exception as e:
            print(f"✗ {e}")

    print("\nDone.")


if __name__ == "__main__":
    main()
