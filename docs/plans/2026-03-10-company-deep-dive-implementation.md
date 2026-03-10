# Company Deep Dive — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the single-page stock analysis into a multi-page company deep dive with full quarterly/annual financial statements, company intelligence, and valuation modelling — all backed by FMP data stored in Supabase.

**Architecture:** FMP data fetched on schedule (GitHub Actions) → stored in Supabase → backend serves from Supabase (zero FMP calls at runtime) → frontend renders across 4 views (Summary + 3 tabs) with institutional-quality charts. React Router replaces manual state-based routing.

**Tech Stack:** FastAPI, Supabase (Postgres), FMP API, GitHub Actions, React 18, React Router, Recharts, Tailwind CSS, Framer Motion

**Design doc:** `docs/plans/2026-03-10-company-deep-dive-design.md`

---

## Phase 1: Supabase Schema

### Task 1: Create financial_statements table

**Files:**
- Create: `backend/migrations/001_financial_statements.sql`

**Step 1: Write the migration SQL**

```sql
CREATE TABLE IF NOT EXISTS financial_statements (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  period_date DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('Q1','Q2','Q3','Q4','FY')),
  statement_type TEXT NOT NULL CHECK (statement_type IN ('income','balance','cashflow')),

  -- Income statement fields
  revenue NUMERIC,
  cost_of_revenue NUMERIC,
  gross_profit NUMERIC,
  gross_profit_ratio NUMERIC,
  research_and_development NUMERIC,
  selling_general_admin NUMERIC,
  operating_expenses NUMERIC,
  operating_income NUMERIC,
  operating_income_ratio NUMERIC,
  interest_income NUMERIC,
  interest_expense NUMERIC,
  income_before_tax NUMERIC,
  income_tax_expense NUMERIC,
  net_income NUMERIC,
  net_income_ratio NUMERIC,
  eps NUMERIC,
  eps_diluted NUMERIC,
  weighted_avg_shares NUMERIC,
  weighted_avg_shares_diluted NUMERIC,
  ebitda NUMERIC,
  ebitda_ratio NUMERIC,

  -- Balance sheet fields
  cash_and_equivalents NUMERIC,
  short_term_investments NUMERIC,
  cash_and_short_term NUMERIC,
  net_receivables NUMERIC,
  inventory NUMERIC,
  other_current_assets NUMERIC,
  total_current_assets NUMERIC,
  property_plant_equipment NUMERIC,
  goodwill NUMERIC,
  intangible_assets NUMERIC,
  long_term_investments NUMERIC,
  other_non_current_assets NUMERIC,
  total_non_current_assets NUMERIC,
  total_assets NUMERIC,
  accounts_payable NUMERIC,
  short_term_debt NUMERIC,
  other_current_liabilities NUMERIC,
  total_current_liabilities NUMERIC,
  long_term_debt NUMERIC,
  other_non_current_liabilities NUMERIC,
  total_non_current_liabilities NUMERIC,
  total_liabilities NUMERIC,
  total_stockholders_equity NUMERIC,
  total_equity NUMERIC,
  total_liabilities_and_equity NUMERIC,
  total_debt NUMERIC,
  net_debt NUMERIC,

  -- Cash flow fields
  net_income_cf NUMERIC,
  depreciation_amortization NUMERIC,
  stock_based_compensation NUMERIC,
  change_in_working_capital NUMERIC,
  accounts_receivables_cf NUMERIC,
  inventory_cf NUMERIC,
  accounts_payable_cf NUMERIC,
  other_operating_activities NUMERIC,
  operating_cash_flow NUMERIC,
  capital_expenditure NUMERIC,
  acquisitions NUMERIC,
  purchases_of_investments NUMERIC,
  sales_of_investments NUMERIC,
  other_investing_activities NUMERIC,
  investing_cash_flow NUMERIC,
  debt_repayment NUMERIC,
  common_stock_issued NUMERIC,
  common_stock_repurchased NUMERIC,
  dividends_paid NUMERIC,
  other_financing_activities NUMERIC,
  financing_cash_flow NUMERIC,
  net_change_in_cash NUMERIC,
  free_cash_flow NUMERIC,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(ticker, period_date, period_type, statement_type)
);

CREATE INDEX idx_fs_ticker ON financial_statements(ticker);
CREATE INDEX idx_fs_ticker_type ON financial_statements(ticker, statement_type, period_type);
```

**Step 2: Run migration in Supabase**

Go to Supabase dashboard → SQL Editor → paste and run, or use the Supabase CLI:
```bash
supabase db push
```

**Step 3: Commit**

```bash
git add backend/migrations/001_financial_statements.sql
git commit -m "chore: add financial_statements table migration"
```

---

### Task 2: Create remaining Supabase tables

**Files:**
- Create: `backend/migrations/002_company_data_tables.sql`

**Step 1: Write the migration SQL**

```sql
-- Key metrics (quarterly + annual)
CREATE TABLE IF NOT EXISTS key_metrics (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  period_date DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('Q1','Q2','Q3','Q4','FY')),
  revenue_per_share NUMERIC,
  net_income_per_share NUMERIC,
  operating_cash_flow_per_share NUMERIC,
  free_cash_flow_per_share NUMERIC,
  cash_per_share NUMERIC,
  book_value_per_share NUMERIC,
  tangible_book_value_per_share NUMERIC,
  shareholders_equity_per_share NUMERIC,
  interest_debt_per_share NUMERIC,
  market_cap NUMERIC,
  enterprise_value NUMERIC,
  pe_ratio NUMERIC,
  price_to_sales NUMERIC,
  pocf_ratio NUMERIC,
  pfcf_ratio NUMERIC,
  pb_ratio NUMERIC,
  ptb_ratio NUMERIC,
  ev_to_sales NUMERIC,
  enterprise_value_over_ebitda NUMERIC,
  ev_to_operating_cash_flow NUMERIC,
  ev_to_free_cash_flow NUMERIC,
  earnings_yield NUMERIC,
  free_cash_flow_yield NUMERIC,
  debt_to_equity NUMERIC,
  debt_to_assets NUMERIC,
  net_debt_to_ebitda NUMERIC,
  current_ratio NUMERIC,
  interest_coverage NUMERIC,
  income_quality NUMERIC,
  dividend_yield NUMERIC,
  payout_ratio NUMERIC,
  sga_to_revenue NUMERIC,
  rnd_to_revenue NUMERIC,
  intangibles_to_total_assets NUMERIC,
  capex_to_operating_cash_flow NUMERIC,
  capex_to_revenue NUMERIC,
  capex_to_depreciation NUMERIC,
  stock_based_compensation_to_revenue NUMERIC,
  graham_number NUMERIC,
  roic NUMERIC,
  return_on_tangible_assets NUMERIC,
  graham_net_net NUMERIC,
  working_capital NUMERIC,
  tangible_asset_value NUMERIC,
  net_current_asset_value NUMERIC,
  invested_capital NUMERIC,
  average_receivables NUMERIC,
  average_payables NUMERIC,
  average_inventory NUMERIC,
  days_sales_outstanding NUMERIC,
  days_payables_outstanding NUMERIC,
  days_of_inventory_on_hand NUMERIC,
  receivables_turnover NUMERIC,
  payables_turnover NUMERIC,
  inventory_turnover NUMERIC,
  roe NUMERIC,
  roa NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, period_date, period_type)
);

-- Growth metrics
CREATE TABLE IF NOT EXISTS growth_metrics (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  period_date DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('Q1','Q2','Q3','Q4','FY')),
  revenue_growth NUMERIC,
  gross_profit_growth NUMERIC,
  ebitda_growth NUMERIC,
  operating_income_growth NUMERIC,
  net_income_growth NUMERIC,
  eps_growth NUMERIC,
  eps_diluted_growth NUMERIC,
  weighted_avg_shares_growth NUMERIC,
  operating_cash_flow_growth NUMERIC,
  free_cash_flow_growth NUMERIC,
  receivables_growth NUMERIC,
  inventory_growth NUMERIC,
  asset_growth NUMERIC,
  book_value_per_share_growth NUMERIC,
  debt_growth NUMERIC,
  rd_expense_growth NUMERIC,
  sga_expense_growth NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, period_date, period_type)
);

-- Analyst data
CREATE TABLE IF NOT EXISTS analyst_data (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  updated_date DATE NOT NULL,
  -- Ratings
  strong_buy INT,
  buy INT,
  hold INT,
  sell INT,
  strong_sell INT,
  consensus TEXT,
  -- Price targets
  target_high NUMERIC,
  target_low NUMERIC,
  target_mean NUMERIC,
  target_median NUMERIC,
  target_count INT,
  -- Latest grades (stored as JSONB array)
  recent_grades JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker)
);

-- Insider trades
CREATE TABLE IF NOT EXISTS insider_trades (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  filing_date DATE,
  transaction_date DATE,
  reporter_name TEXT,
  reporter_title TEXT,
  transaction_type TEXT,
  shares_traded NUMERIC,
  price NUMERIC,
  total_value NUMERIC,
  shares_owned_after NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, filing_date, reporter_name, transaction_type, shares_traded)
);

-- Earnings history
CREATE TABLE IF NOT EXISTS earnings_history (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  date DATE NOT NULL,
  fiscal_period TEXT,
  eps_actual NUMERIC,
  eps_estimate NUMERIC,
  eps_surprise NUMERIC,
  eps_surprise_pct NUMERIC,
  revenue_actual NUMERIC,
  revenue_estimate NUMERIC,
  revenue_surprise NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, date)
);

-- Dividends history
CREATE TABLE IF NOT EXISTS dividends_history (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  ex_date DATE,
  pay_date DATE,
  record_date DATE,
  declaration_date DATE,
  amount NUMERIC,
  yield NUMERIC,
  frequency TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, ex_date)
);

-- Revenue segments
CREATE TABLE IF NOT EXISTS revenue_segments (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  period_date DATE NOT NULL,
  segment_type TEXT NOT NULL CHECK (segment_type IN ('product','geographic')),
  segment_name TEXT NOT NULL,
  revenue NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, period_date, segment_type, segment_name)
);

-- Company scores
CREATE TABLE IF NOT EXISTS company_scores (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  updated_date DATE NOT NULL,
  altman_z_score NUMERIC,
  piotroski_score NUMERIC,
  financial_score JSONB,
  dcf_value NUMERIC,
  levered_dcf NUMERIC,
  owner_earnings NUMERIC,
  owner_earnings_per_share NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker)
);

-- Senate trades
CREATE TABLE IF NOT EXISTS senate_trades (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  transaction_date DATE,
  disclosure_date DATE,
  senator_name TEXT,
  party TEXT,
  state TEXT,
  transaction_type TEXT,
  amount_range TEXT,
  asset_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, transaction_date, senator_name, transaction_type)
);

-- Indexes
CREATE INDEX idx_km_ticker ON key_metrics(ticker);
CREATE INDEX idx_gm_ticker ON growth_metrics(ticker);
CREATE INDEX idx_ad_ticker ON analyst_data(ticker);
CREATE INDEX idx_it_ticker ON insider_trades(ticker);
CREATE INDEX idx_eh_ticker ON earnings_history(ticker);
CREATE INDEX idx_dh_ticker ON dividends_history(ticker);
CREATE INDEX idx_rs_ticker ON revenue_segments(ticker);
CREATE INDEX idx_cs_ticker ON company_scores(ticker);
CREATE INDEX idx_st_ticker ON senate_trades(ticker);
```

**Step 2: Run migration in Supabase dashboard SQL Editor**

**Step 3: Commit**

```bash
git add backend/migrations/002_company_data_tables.sql
git commit -m "chore: add all company data tables migration"
```

---

## Phase 2: FMP Data Fetching Scripts

### Task 3: Create FMP client utility

**Files:**
- Create: `backend/fmp_client.py`

**Step 1: Write the FMP client**

This is a shared utility for all refresh scripts. Handles rate limiting, retries, and response parsing.

```python
"""
Shared FMP API client for all data refresh scripts.
Handles rate limiting, retries, and response parsing.
"""
import os
import time
import math
import requests

FMP_KEY = os.environ.get("FMP_KEY", "")
FMP_BASE = "https://financialmodelingprep.com/stable"

if not FMP_KEY:
    raise SystemExit("Set FMP_KEY environment variable before running.")

_last_call = 0.0
_MIN_INTERVAL = 0.25  # 4 calls/sec = 240/min, safely under 300/min

def _safe(val):
    if val is None:
        return None
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None

def fmp_get(endpoint: str, params: dict = None, retries: int = 2) -> list | dict | None:
    """Call an FMP endpoint. Returns parsed JSON (list or dict) or None on failure."""
    global _last_call
    params = params or {}
    params["apikey"] = FMP_KEY

    for attempt in range(retries + 1):
        # Rate limit
        elapsed = time.time() - _last_call
        if elapsed < _MIN_INTERVAL:
            time.sleep(_MIN_INTERVAL - elapsed)
        _last_call = time.time()

        try:
            r = requests.get(
                f"{FMP_BASE}/{endpoint}",
                params=params,
                headers={"User-Agent": "EquityValuation/1.0"},
                timeout=15,
            )
            if r.status_code == 429:
                wait = 60 * (attempt + 1)
                print(f"  [rate limited, waiting {wait}s]", flush=True)
                time.sleep(wait)
                continue
            if r.status_code != 200:
                print(f"  [{endpoint}] HTTP {r.status_code}")
                return None
            return r.json()
        except Exception as e:
            print(f"  [{endpoint}] {e}")
            if attempt < retries:
                time.sleep(2)
    return None

def fmp_get_first(endpoint: str, params: dict = None) -> dict | None:
    """Call an FMP endpoint and return the first item if result is a list."""
    data = fmp_get(endpoint, params)
    if isinstance(data, list) and data:
        return data[0]
    if isinstance(data, dict):
        return data
    return None

def fmp_get_list(endpoint: str, params: dict = None) -> list:
    """Call an FMP endpoint and return the list (or empty list)."""
    data = fmp_get(endpoint, params)
    if isinstance(data, list):
        return data
    return []
```

**Step 2: Commit**

```bash
git add backend/fmp_client.py
git commit -m "feat: add shared FMP client utility with rate limiting"
```

---

### Task 4: Create quarterly refresh script (financial statements + earnings)

**Files:**
- Create: `backend/refresh_quarterly.py`

**Step 1: Write the quarterly refresh script**

This fetches income statements, balance sheets, cash flow statements (quarterly + annual, up to 5 years) and earnings history for all tickers in `stock_fundamentals`.

```python
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
    data = fmp_get_list("earnings-report", {"symbol": ticker, "limit": LIMIT})
    count = 0
    for row in data:
        record = {
            "ticker": ticker,
            "date": row.get("date"),
            "fiscal_period": row.get("fiscalDateEnding"),
            "eps_actual": _safe(row.get("eps")),
            "eps_estimate": _safe(row.get("epsEstimated")),
            "revenue_actual": _safe(row.get("revenue")),
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
```

**Step 2: Commit**

```bash
git add backend/refresh_quarterly.py
git commit -m "feat: add quarterly refresh script for financial statements + earnings"
```

---

### Task 5: Create weekly refresh script (metrics, growth, dividends, segments)

**Files:**
- Create: `backend/refresh_weekly.py`

**Step 1: Write the weekly refresh script**

```python
"""
Weekly refresh: key_metrics, growth_metrics, dividends_history, revenue_segments.
Usage: FMP_KEY=... SUPABASE_URL=... SUPABASE_KEY=... python3 refresh_weekly.py
"""
import os
from supabase import create_client
from fmp_client import fmp_get_list, fmp_get_first, _safe

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
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
```

**Step 2: Commit**

```bash
git add backend/refresh_weekly.py
git commit -m "feat: add weekly refresh script for metrics, growth, dividends, segments"
```

---

### Task 6: Create daily refresh script (analyst, insider, senate, scores)

**Files:**
- Create: `backend/refresh_daily.py`

**Step 1: Write the daily refresh script**

```python
"""
Daily refresh: analyst_data, insider_trades, senate_trades, company_scores.
Usage: FMP_KEY=... SUPABASE_URL=... SUPABASE_KEY=... python3 refresh_daily.py
"""
import os
import json
from datetime import date
from supabase import create_client
from fmp_client import fmp_get_list, fmp_get_first, _safe

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_all_tickers():
    rows = supabase.table("stock_fundamentals").select("ticker").execute().data
    return [r["ticker"] for r in rows]


def refresh_analyst(ticker: str) -> bool:
    record = {"ticker": ticker, "updated_date": str(date.today())}

    # Ratings snapshot
    d = fmp_get_first("ratings-snapshot", {"symbol": ticker})
    if d:
        record["strong_buy"] = d.get("ratingDetailsDCFScoreStrongBuy") or d.get("strongBuy")
        record["buy"] = d.get("buy")
        record["hold"] = d.get("hold")
        record["sell"] = d.get("sell")
        record["strong_sell"] = d.get("strongSell")
        record["consensus"] = d.get("ratingRecommendation") or d.get("consensus")

    # Price target consensus
    d = fmp_get_first("price-target-consensus", {"symbol": ticker})
    if d:
        record["target_high"] = _safe(d.get("targetHigh"))
        record["target_low"] = _safe(d.get("targetLow"))
        record["target_mean"] = _safe(d.get("targetConsensus") or d.get("targetMean"))
        record["target_median"] = _safe(d.get("targetMedian"))
        record["target_count"] = _safe(d.get("targetCount"))

    # Recent grades
    grades = fmp_get_list("stock-grades", {"symbol": ticker, "limit": 10})
    if grades:
        record["recent_grades"] = json.dumps([{
            "date": g.get("date"),
            "firm": g.get("gradingCompany"),
            "action": g.get("newGrade"),
            "previous": g.get("previousGrade"),
        } for g in grades[:10]])

    clean = {k: v for k, v in record.items() if v is not None}
    supabase.table("analyst_data").upsert(clean, on_conflict="ticker").execute()
    return True


def refresh_insider(ticker: str) -> int:
    data = fmp_get_list("insider-trading", {"symbol": ticker, "limit": 50})
    count = 0
    for row in data:
        record = {
            "ticker": ticker,
            "filing_date": row.get("filingDate"),
            "transaction_date": row.get("transactionDate"),
            "reporter_name": row.get("reportingName"),
            "reporter_title": row.get("typeOfOwner"),
            "transaction_type": row.get("transactionType") or row.get("acquistionOrDisposition"),
            "shares_traded": _safe(row.get("securitiesTransacted")),
            "price": _safe(row.get("price")),
            "shares_owned_after": _safe(row.get("securitiesOwned")),
        }
        shares = record.get("shares_traded")
        price = record.get("price")
        if shares and price:
            record["total_value"] = abs(shares * price)

        clean = {k: v for k, v in record.items() if v is not None}
        if clean.get("filing_date") and clean.get("reporter_name"):
            supabase.table("insider_trades").upsert(
                clean, on_conflict="ticker,filing_date,reporter_name,transaction_type,shares_traded"
            ).execute()
            count += 1
    return count


def refresh_senate(ticker: str) -> int:
    data = fmp_get_list("senate-trading", {"symbol": ticker})
    count = 0
    for row in data:
        record = {
            "ticker": ticker,
            "transaction_date": row.get("transactionDate"),
            "disclosure_date": row.get("disclosureDate"),
            "senator_name": row.get("firstName", "") + " " + row.get("lastName", ""),
            "party": row.get("party"),
            "state": row.get("state"),
            "transaction_type": row.get("type"),
            "amount_range": row.get("amount"),
            "asset_description": row.get("assetDescription"),
        }
        clean = {k: v for k, v in record.items() if v is not None}
        if clean.get("transaction_date") and clean.get("senator_name"):
            supabase.table("senate_trades").upsert(
                clean, on_conflict="ticker,transaction_date,senator_name,transaction_type"
            ).execute()
            count += 1
    return count


def refresh_scores(ticker: str) -> bool:
    record = {"ticker": ticker, "updated_date": str(date.today())}

    # Financial scores
    d = fmp_get_first("financial-scores", {"symbol": ticker})
    if d:
        record["altman_z_score"] = _safe(d.get("altmanZScore"))
        record["piotroski_score"] = _safe(d.get("piotroskiScore"))
        record["financial_score"] = json.dumps(d) if d else None

    # DCF
    d = fmp_get_first("dcf-valuation", {"symbol": ticker})
    if d:
        record["dcf_value"] = _safe(d.get("dcf"))

    # Levered DCF
    d = fmp_get_first("levered-dcf", {"symbol": ticker})
    if d:
        record["levered_dcf"] = _safe(d.get("dcf"))

    # Owner earnings
    d = fmp_get_first("owner-earnings", {"symbol": ticker})
    if d:
        record["owner_earnings"] = _safe(d.get("ownerEarnings"))
        record["owner_earnings_per_share"] = _safe(d.get("ownerEarningsPerShare"))

    clean = {k: v for k, v in record.items() if v is not None}
    supabase.table("company_scores").upsert(clean, on_conflict="ticker").execute()
    return True


def main():
    tickers = get_all_tickers()
    print(f"Daily refresh for {len(tickers)} tickers\n")

    for i, ticker in enumerate(tickers):
        print(f"[{i+1}/{len(tickers)}] {ticker}...", end=" ", flush=True)
        try:
            refresh_analyst(ticker)
            ins = refresh_insider(ticker)
            sen = refresh_senate(ticker)
            refresh_scores(ticker)
            print(f"✓ insider:{ins} senate:{sen}")
        except Exception as e:
            print(f"✗ {e}")

    print("\nDone.")


if __name__ == "__main__":
    main()
```

**Step 2: Commit**

```bash
git add backend/refresh_daily.py
git commit -m "feat: add daily refresh script for analyst, insider, senate, scores"
```

---

## Phase 3: GitHub Actions Workflows

### Task 7: Create GitHub Actions workflows

**Files:**
- Create: `.github/workflows/daily-refresh.yml`
- Create: `.github/workflows/weekly-refresh.yml`
- Create: `.github/workflows/quarterly-refresh.yml`

**Step 1: Write daily workflow**

```yaml
name: Daily Data Refresh

on:
  schedule:
    - cron: '0 2 * * 1-5'  # Mon-Fri 2am UTC (9pm ET)
  workflow_dispatch:  # Manual trigger

jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 60

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.13'

      - name: Install dependencies
        run: pip install requests supabase

      - name: Run daily refresh
        working-directory: backend
        env:
          FMP_KEY: ${{ secrets.FMP_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: python3 refresh_daily.py
```

**Step 2: Write weekly workflow**

```yaml
name: Weekly Data Refresh

on:
  schedule:
    - cron: '0 4 * * 0'  # Sunday 4am UTC (midnight ET)
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 120

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.13'

      - name: Install dependencies
        run: pip install requests supabase

      - name: Run weekly refresh
        working-directory: backend
        env:
          FMP_KEY: ${{ secrets.FMP_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: python3 refresh_weekly.py
```

**Step 3: Write quarterly workflow**

```yaml
name: Quarterly Data Refresh

on:
  schedule:
    - cron: '0 6 8 1,4,7,10 *'  # 8th of Jan/Apr/Jul/Oct, 6am UTC
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 180

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.13'

      - name: Install dependencies
        run: pip install requests supabase

      - name: Run quarterly refresh
        working-directory: backend
        env:
          FMP_KEY: ${{ secrets.FMP_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: python3 refresh_quarterly.py
```

**Step 4: Commit**

```bash
git add .github/workflows/
git commit -m "feat: add GitHub Actions for daily/weekly/quarterly FMP data refresh"
```

---

## Phase 4: Backend API Endpoints

### Task 8: Add new Supabase read endpoints to backend

**Files:**
- Create: `backend/routes/financials.py`
- Create: `backend/routes/intelligence.py`
- Create: `backend/routes/summary.py`
- Modify: `backend/main.py` — add router imports

**Step 1: Create financials router**

```python
"""Routes for financial statements, metrics, growth, segments."""
from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

router = APIRouter()


@router.get("/financials/{ticker}")
async def get_financials(ticker: str, period: str = "annual", user=Depends(get_current_user)):
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
async def get_growth(ticker: str, user=Depends(get_current_user)):
    ticker = ticker.upper().strip()
    rows = supabase.table("growth_metrics") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("period_date", desc=True) \
        .limit(25) \
        .execute().data
    return rows


@router.get("/metrics/{ticker}")
async def get_metrics(ticker: str, period: str = "annual", user=Depends(get_current_user)):
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
async def get_segments(ticker: str, user=Depends(get_current_user)):
    ticker = ticker.upper().strip()
    rows = supabase.table("revenue_segments") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("period_date", desc=True) \
        .execute().data

    product = [r for r in rows if r.get("segment_type") == "product"]
    geographic = [r for r in rows if r.get("segment_type") == "geographic"]
    return {"product": product, "geographic": geographic}
```

**Step 2: Create intelligence router**

```python
"""Routes for analyst data, insider trades, earnings, dividends, scores, senate."""
from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

router = APIRouter()


@router.get("/analyst/{ticker}")
async def get_analyst(ticker: str, user=Depends(get_current_user)):
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
async def get_insider(ticker: str, user=Depends(get_current_user)):
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
async def get_earnings(ticker: str, user=Depends(get_current_user)):
    ticker = ticker.upper().strip()
    rows = supabase.table("earnings_history") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("date", desc=True) \
        .limit(20) \
        .execute().data
    return rows


@router.get("/dividends/{ticker}")
async def get_dividends(ticker: str, user=Depends(get_current_user)):
    ticker = ticker.upper().strip()
    rows = supabase.table("dividends_history") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("ex_date", desc=True) \
        .limit(40) \
        .execute().data
    return rows


@router.get("/scores/{ticker}")
async def get_scores(ticker: str, user=Depends(get_current_user)):
    ticker = ticker.upper().strip()
    row = supabase.table("company_scores") \
        .select("*") \
        .eq("ticker", ticker) \
        .limit(1) \
        .execute().data
    if not row:
        raise HTTPException(404, f"No score data for {ticker}")
    return row[0]
```

**Step 3: Create summary router**

```python
"""Combined summary endpoint for the company landing page."""
from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

router = APIRouter()


@router.get("/summary/{ticker}")
async def get_summary(ticker: str, user=Depends(get_current_user)):
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

    # Latest key metrics (last 8 quarters for sparklines)
    metrics = supabase.table("key_metrics") \
        .select("period_date,period_type,pe_ratio,pb_ratio,ev_to_sales,enterprise_value_over_ebitda,roe,roa,dividend_yield,current_ratio,debt_to_equity") \
        .eq("ticker", ticker) \
        .in_("period_type", ["Q1", "Q2", "Q3", "Q4"]) \
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
```

**Step 4: Register routers in main.py**

Add these lines near the top of `backend/main.py`, after the existing imports:

```python
from routes.financials import router as financials_router
from routes.intelligence import router as intelligence_router
from routes.summary import router as summary_router
```

And after the CORS middleware setup, add:

```python
app.include_router(financials_router)
app.include_router(intelligence_router)
app.include_router(summary_router)
```

Create the `backend/routes/` directory with an `__init__.py`:

```bash
mkdir -p backend/routes
touch backend/routes/__init__.py
```

**Step 5: Commit**

```bash
git add backend/routes/ backend/main.py
git commit -m "feat: add backend API routes for financials, intelligence, summary"
```

---

## Phase 5: Frontend — React Router & Layout

### Task 9: Install React Router and restructure routing

**Files:**
- Modify: `frontend/package.json` — add react-router-dom
- Modify: `frontend/src/main.jsx` — wrap in BrowserRouter
- Create: `frontend/src/layouts/AppLayout.jsx` — shared shell (sidebar, topbar)
- Modify: `frontend/src/App.jsx` — replace state-based routing with React Router routes

**Step 1: Install react-router-dom**

```bash
cd frontend && npm install react-router-dom
```

**Step 2: Update main.jsx**

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

**Step 3: Create AppLayout.jsx**

Extract the sidebar + topbar + main content area from `App.jsx` into a shared layout component. This wraps all authenticated pages.

```jsx
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import MobileNav from "../components/MobileNav";
import SearchBar from "../components/SearchBar";

export default function AppLayout({ onSearch, loading }) {
  const navigate = useNavigate();
  const location = useLocation();

  const currentPage = location.pathname.split("/")[1] || "dashboard";

  const handlePageChange = (page) => {
    if (page === "dashboard") navigate("/dashboard");
    else if (page === "screener") navigate("/screener");
    else if (page === "compare") navigate("/compare");
  };

  return (
    <div className="app-container">
      <Sidebar activePage={currentPage} onPageChange={handlePageChange} />
      <main className="main-content">
        <div className="topbar">
          <SearchBar onSearch={onSearch} loading={loading} />
        </div>
        <Outlet />
      </main>
      <MobileNav activePage={currentPage} onPageChange={handlePageChange} />
    </div>
  );
}
```

**Step 4: Rewrite App.jsx routing**

Replace the state-based `appMode`/`page` logic with React Router routes. Keep all existing component imports and state management — just change how pages are rendered.

The key routes:

```jsx
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import ScreenerPage from "./pages/ScreenerPage";
import CompanyPage from "./pages/CompanyPage";
// ... existing imports

function App() {
  const navigate = useNavigate();
  // ... keep existing state (user, profile, result, loading, etc.)

  const handleSearch = async (ticker) => {
    // ... existing search logic, but navigate to /company/{ticker} on success
    navigate(`/company/${ticker}`);
  };

  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage onSearch={handleSearch} />} />
        <Route element={<AppLayout onSearch={handleSearch} loading={loading} />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/screener" element={<ScreenerPage />} />
          <Route path="/company/:ticker" element={<CompanyPage />} />
          <Route path="/company/:ticker/financials" element={<CompanyFinancialsPage />} />
          <Route path="/company/:ticker/intelligence" element={<CompanyIntelligencePage />} />
          <Route path="/company/:ticker/valuation" element={<CompanyValuationPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AuthProvider>
  );
}
```

**Important:** This is a significant refactor of `App.jsx`. The existing inline analysis rendering (~800 lines) will be extracted into the new `CompanyPage` and sub-pages. Do this incrementally:

1. First get routing working with the existing pages (Landing, Dashboard, Screener)
2. Then extract the analysis view into `CompanyPage`
3. Then build the new sub-pages

**Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: migrate from state-based routing to React Router"
```

---

## Phase 6: Frontend — Company Pages

### Task 10: Create CompanyPage (Summary landing)

**Files:**
- Create: `frontend/src/pages/CompanyPage.jsx`
- Create: `frontend/src/components/company/CompanyNav.jsx` — tab navigation for Summary/Financials/Intelligence/Valuation

**Step 1: Create CompanyNav.jsx**

Tab navigation component shared across all company sub-pages.

```jsx
import { NavLink, useParams } from "react-router-dom";

const tabs = [
  { label: "Summary", path: "" },
  { label: "Financials", path: "/financials" },
  { label: "Company Intelligence", path: "/intelligence" },
  { label: "Valuation Modelling", path: "/valuation" },
];

export default function CompanyNav() {
  const { ticker } = useParams();
  const base = `/company/${ticker}`;

  return (
    <nav className="company-nav">
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={`${base}${tab.path}`}
          end={tab.path === ""}
          className={({ isActive }) =>
            `company-nav-tab ${isActive ? "active" : ""}`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

**Step 2: Create CompanyPage.jsx**

This is the Summary landing page. Uses the `/summary/{ticker}` endpoint.

Order: Company Header → Valuation Verdict → Analyst & Ratings → Key Metrics → Financial Snapshot → Margin & Growth Trends.

Each section is a separate component. Build them as you go — start with the page shell and data fetching, then fill in sections.

```jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import CompanyNav from "../components/company/CompanyNav";
import CompanyHeader from "../components/CompanyHeader";
import ConsensusCard from "../components/ConsensusCard";
import AnalystWidget from "../components/company/AnalystWidget";
import KeyMetricsRow from "../components/company/KeyMetricsRow";
import FinancialSnapshot from "../components/company/FinancialSnapshot";
import MarginGrowthTrends from "../components/company/MarginGrowthTrends";
import SkeletonLoader from "../components/SkeletonLoader";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function CompanyPage() {
  const { ticker } = useParams();
  const { getToken } = useAuth();
  const [data, setData] = useState(null);
  const [valuation, setValuation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [summaryRes, valuationRes] = await Promise.all([
        axios.get(`${API}/summary/${ticker}`, { headers }),
        axios.get(`${API}/valuation/${ticker}`, { headers }),
      ]);

      setData(summaryRes.data);
      setValuation(valuationRes.data);
      setLoading(false);
    }
    load();
  }, [ticker]);

  if (loading) return <SkeletonLoader />;

  return (
    <div className="company-page">
      <CompanyNav />

      <CompanyHeader data={valuation} />

      <ConsensusCard result={valuation} />

      <AnalystWidget analyst={data.analyst} />

      <KeyMetricsRow
        company={data.company}
        metrics={data.key_metrics}
      />

      <FinancialSnapshot quarters={data.quarterly_financials} />

      <MarginGrowthTrends
        quarters={data.quarterly_financials}
        growth={data.growth}
      />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/src/pages/CompanyPage.jsx frontend/src/components/company/
git commit -m "feat: add CompanyPage summary landing with nav tabs"
```

---

### Task 11: Build Summary page sub-components

**Files:**
- Create: `frontend/src/components/company/AnalystWidget.jsx`
- Create: `frontend/src/components/company/KeyMetricsRow.jsx`
- Create: `frontend/src/components/company/FinancialSnapshot.jsx`
- Create: `frontend/src/components/company/MarginGrowthTrends.jsx`

Build each component with Recharts for charts. Follow existing app styling (dark glass cards, Tailwind). Each component should:
- Accept props from the `/summary/{ticker}` response
- Render a card with title + "View full details →" link
- Include institutional-quality charts

**AnalystWidget** — horizontal stacked bar for rating distribution + price target arrow chart
**KeyMetricsRow** — grid of metric cards (P/E, EV/EBITDA, ROE, margins, dividend yield)
**FinancialSnapshot** — grouped bar chart (revenue bars + EPS line) for last 4 quarters
**MarginGrowthTrends** — multi-line sparklines (operating margin, profit margin, revenue growth over 8 quarters)

**Note:** Full component code will be written during implementation. The components follow existing patterns in the codebase (glass cards, Recharts, Tailwind, Framer Motion).

**Step 1: Build each component**
**Step 2: Commit**

```bash
git add frontend/src/components/company/
git commit -m "feat: add summary page sub-components with charts"
```

---

### Task 12: Build Financials page

**Files:**
- Create: `frontend/src/pages/CompanyFinancialsPage.jsx`
- Create: `frontend/src/components/company/StatementTable.jsx` — the spreadsheet-style data table
- Create: `frontend/src/components/company/RevenueChart.jsx` — stacked area chart
- Create: `frontend/src/components/company/MarginsChart.jsx` — multi-line chart
- Create: `frontend/src/components/company/CashFlowWaterfall.jsx` — waterfall chart
- Create: `frontend/src/components/company/BalanceSheetChart.jsx` — stacked bar
- Create: `frontend/src/components/company/PerShareChart.jsx` — grouped bar
- Create: `frontend/src/components/company/SegmentCharts.jsx` — stacked bar + donut

**Page structure:**
1. CompanyNav (shared)
2. Sub-tabs: Income Statement | Balance Sheet | Cash Flow
3. Toggle: Annual / Quarterly
4. StatementTable (columns = periods, rows = line items)
5. Charts below the table

**Data source:** `GET /financials/{ticker}?period=annual|quarterly` + `GET /segments/{ticker}`

**Step 1: Build page and components**
**Step 2: Commit**

```bash
git add frontend/src/pages/CompanyFinancialsPage.jsx frontend/src/components/company/
git commit -m "feat: add Financials page with statement tables and charts"
```

---

### Task 13: Build Company Intelligence page

**Files:**
- Create: `frontend/src/pages/CompanyIntelligencePage.jsx`
- Create: `frontend/src/components/company/RatingDistribution.jsx` — horizontal stacked bar
- Create: `frontend/src/components/company/PriceTargetChart.jsx` — arrow/gauge chart
- Create: `frontend/src/components/company/GradesTimeline.jsx` — timeline table
- Create: `frontend/src/components/company/EarningsChart.jsx` — bar chart (actual vs estimate)
- Create: `frontend/src/components/company/ScoresRadar.jsx` — radar/spider chart
- Create: `frontend/src/components/company/InsiderChart.jsx` — bar chart by month
- Create: `frontend/src/components/company/TradesTable.jsx` — shared table for insider + senate

**Data sources:**
- `GET /analyst/{ticker}`
- `GET /insider/{ticker}`
- `GET /earnings/{ticker}`
- `GET /dividends/{ticker}`
- `GET /scores/{ticker}`

**Step 1: Build page and components**
**Step 2: Commit**

```bash
git add frontend/src/pages/CompanyIntelligencePage.jsx frontend/src/components/company/
git commit -m "feat: add Company Intelligence page with analyst, insider, earnings charts"
```

---

### Task 14: Build Valuation Modelling page

**Files:**
- Create: `frontend/src/pages/CompanyValuationPage.jsx`

**This is mostly extracting existing components** from the inline analysis view in `App.jsx`:
- ConsensusCard
- ValuationCard grid (all 11 models)
- FootballField chart
- SensitivityTable
- MonteCarlo
- LBOModel
- InvestmentThesis
- PDF export button

**New addition:** FMP DCF Comparison card — shows FMP's DCF and Levered DCF values side-by-side with your calculated values.

**Data sources:**
- `GET /valuation/{ticker}` (existing)
- `GET /scores/{ticker}` (for FMP DCF values)

**Step 1: Extract existing components into the new page**
**Step 2: Add FMP DCF comparison card**
**Step 3: Commit**

```bash
git add frontend/src/pages/CompanyValuationPage.jsx
git commit -m "feat: add Valuation Modelling page with existing models + FMP DCF comparison"
```

---

## Phase 7: Cleanup & Polish

### Task 15: Update feature gating for new pages

**Files:**
- Modify: `frontend/src/context/AuthContext.jsx` — add new feature gates

**Update `isFeatureUnlocked()`** to handle:
- `"financials_quarterly"` — Free gets last 4Q only, Pro/Max gets full 5 years
- `"intelligence_full"` — Free gets Analyst + Earnings only, Pro/Max gets all
- Existing gates stay the same

**Step 1: Update auth context**
**Step 2: Add LockedFeatureCard wrapping in Intelligence page for Free tier**
**Step 3: Commit**

```bash
git add frontend/src/context/AuthContext.jsx frontend/src/pages/CompanyIntelligencePage.jsx
git commit -m "feat: update feature gating for new company pages"
```

---

### Task 16: Clean up App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

Remove the inline analysis rendering (~600+ lines) that has been extracted into CompanyPage and sub-pages. App.jsx should only contain:
- React Router routes
- Auth provider wrapper
- Global state (modals, etc.)

Target: App.jsx under 200 lines.

**Step 1: Remove extracted code**
**Step 2: Verify all routes work**
**Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "refactor: slim down App.jsx after extracting company pages"
```

---

### Task 17: Run initial data population

**Step 1: Set environment variables and run quarterly refresh first (fills financial statements + earnings)**

```bash
cd backend
FMP_KEY=your_key SUPABASE_URL=your_url SUPABASE_KEY=your_key python3 refresh_quarterly.py
```

**Step 2: Run weekly refresh (fills metrics, growth, dividends, segments)**

```bash
FMP_KEY=your_key SUPABASE_URL=your_url SUPABASE_KEY=your_key python3 refresh_weekly.py
```

**Step 3: Run daily refresh (fills analyst, insider, senate, scores)**

```bash
FMP_KEY=your_key SUPABASE_URL=your_url SUPABASE_KEY=your_key python3 refresh_daily.py
```

**Step 4: Add GitHub Secrets**

In your GitHub repo → Settings → Secrets → Actions, add:
- `FMP_KEY`
- `SUPABASE_URL`
- `SUPABASE_KEY`

---

### Task 18: Update CLAUDE.md with new architecture

**Files:**
- Modify: `CLAUDE.md`

Add documentation for:
- New Supabase tables
- New API endpoints
- GitHub Actions refresh pipeline
- Frontend routing structure
- Company page layout

**Step 1: Update CLAUDE.md**
**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with company deep dive architecture"
```

---

## Task Dependency Graph

```
Phase 1 (Schema):     [Task 1] → [Task 2]
Phase 2 (Scripts):    [Task 3] → [Task 4, 5, 6] (parallel)
Phase 3 (Actions):    [Task 7] (depends on Phase 2)
Phase 4 (Backend):    [Task 8] (depends on Phase 1)
Phase 5 (Routing):    [Task 9] (independent of backend)
Phase 6 (Pages):      [Task 10] → [Task 11] → [Task 12, 13, 14] (parallel)
Phase 7 (Polish):     [Task 15, 16] (after Phase 6) → [Task 17] → [Task 18]
```

**Phases 1-3 and Phase 5 can run in parallel.** Phase 4 needs Phase 1. Phase 6 needs Phases 4+5. Phase 7 needs everything.
