"""Diagnostic script: check row counts for all Supabase cache tables."""
import os
import sys

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_KEY environment variables")
    sys.exit(1)

from supabase import create_client
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

tables = {
    "stock_fundamentals": "Base S&P 500 ticker data (MUST have ~500 rows)",
    "equity_value_scores": "EVS scores (Screener, Dashboard, Compare)",
    "technicals_cache": "Technical indicators (Technical tab)",
    "risk_analysis_cache": "Risk metrics (Risk tab)",
    "price_forecasts": "ARIMA-GARCH forecasts (Risk tab)",
    "governance_cache": "Corporate governance (Governance section)",
    "wacc_cache": "WACC calculations (WACC section)",
    "estimates_cache": "Forward estimates (Estimates section)",
    "qualitative_cache": "SWOT & PESTLE analyses (SWOT/PESTLE)",
    "macro_cache": "Macroeconomic data (Macro section)",
    "macro_sector_cache": "Sector macro data (Sector Macro)",
    "key_metrics": "Valuation ratios, ROE/ROA/ROIC (Return Ratios chart)",
    "analyst_data": "Analyst ratings (Dashboard top picks)",
    "financial_statements": "Income/Balance/CashFlow (Financials tab)",
    "growth_metrics": "Growth rates (Summary page)",
    "insider_trades": "Insider trades (Intelligence tab)",
    "earnings_history": "Earnings history (Intelligence tab)",
    "dividends_history": "Dividend history (Financials tab)",
    "company_scores": "Altman Z / Piotroski (Scores section)",
    "revenue_segments": "Revenue segments (Segment charts)",
}

print("\n" + "=" * 60)
print("  TABLE STATUS REPORT")
print("=" * 60)

empty_tables = []
ok_tables = []

for table, desc in tables.items():
    try:
        result = sb.table(table).select("*", count="exact").limit(0).execute()
        count = result.count if result.count is not None else 0
        if count == 0:
            status = "[EMPTY - CRITICAL]"
            empty_tables.append(table)
        else:
            status = "[OK]"
            ok_tables.append((table, count))
        print(f"  {table:30s} {count:>6d} rows  {status}")
    except Exception as e:
        err = str(e)[:60]
        print(f"  {table:30s}  ERROR: {err}")
        empty_tables.append(table)

print("=" * 60)
print(f"\n  OK: {len(ok_tables)} tables with data")
print(f"  EMPTY/ERROR: {len(empty_tables)} tables need attention")
if empty_tables:
    print(f"\n  Empty tables: {', '.join(empty_tables)}")
print()
