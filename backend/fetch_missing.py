"""
Fetch fundamental data for missing S&P 500 tickers from FMP and upsert into Supabase.
Usage:  FMP_KEY=your_key python3 fetch_missing.py
"""
import os, requests, time, math
from supabase import create_client
from config import require_env

SUPABASE_URL = require_env("SUPABASE_URL")
SUPABASE_KEY = require_env("SUPABASE_KEY")
FMP_KEY      = os.environ.get("FMP_KEY", "")
FMP_BASE     = "https://financialmodelingprep.com/stable"

if not FMP_KEY:
    raise SystemExit("Set FMP_KEY environment variable before running.")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

MISSING = [
    'BA', 'BAC', 'BBWI', 'BBY', 'BDX', 'BMY', 'BR', 'BRO',
    'CAT', 'CBRE', 'CDW', 'CE', 'CFR', 'CPT', 'CZR',
    'DFS', 'FANG', 'HSIC', 'RHI', 'T', 'WHR', 'XRAY',
    # Possibly delisted/renamed — skipped automatically if no data:
    'DNB', 'IPGP', 'PEAK', 'PGRE', 'VNT',
]

def _safe(val):
    if val is None:
        return None
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None

def fetch_fmp(ticker):
    h   = {"User-Agent": "EquityValuation/1.0"}
    p   = {"symbol": ticker, "apikey": FMP_KEY}
    row = {"ticker": ticker}

    # ── Profile ────────────────────────────────────────────────────────────────
    try:
        d = requests.get(f"{FMP_BASE}/profile", params=p, headers=h, timeout=15).json()
        if isinstance(d, list) and d:
            pr = d[0]
            row["name"]               = pr.get("companyName", ticker)
            row["sector"]             = pr.get("sector", "Unknown")
            row["industry"]           = pr.get("industry", "Unknown")
            row["website"]            = pr.get("website", "")
            row["description"]        = pr.get("description", "")
            row["current_price"]      = _safe(pr.get("price"))
            row["market_cap"]         = _safe(pr.get("marketCap"))
            row["beta"]               = _safe(pr.get("beta"))
            row["shares_outstanding"] = _safe(pr.get("sharesOutstanding"))
            rng = pr.get("range", "")
            if rng and "-" in rng:
                parts = rng.split("-")
                row["week_52_low"]  = _safe(parts[0].strip())
                row["week_52_high"] = _safe(parts[-1].strip())
    except Exception as e:
        print(f"  [profile] {e}")

    # ── Key Metrics TTM ────────────────────────────────────────────────────────
    try:
        d = requests.get(f"{FMP_BASE}/key-metrics-ttm", params=p, headers=h, timeout=15).json()
        if isinstance(d, list) and d:
            m = d[0]
            row["pe_ratio"]         = _safe(m.get("peRatioTTM"))
            row["pb_ratio"]         = _safe(m.get("pbRatioTTM"))
            row["ps_ratio"]         = _safe(m.get("priceToSalesRatioTTM"))
            row["peg_ratio"]        = _safe(m.get("pegRatioTTM"))
            row["ev_to_ebitda"]     = _safe(m.get("evToEBITDATTM"))
            row["ev_to_revenue"]    = _safe(m.get("evToSalesTTM"))
            row["book_value"]       = _safe(m.get("bookValuePerShareTTM"))
            row["roe"]              = _safe(m.get("roeTTM") or m.get("returnOnEquityTTM"))
            row["roa"]              = _safe(m.get("roaTTM") or m.get("returnOnAssetsTTM"))
            row["debt_to_equity"]   = _safe(m.get("debtToEquityTTM"))
            row["current_ratio"]    = _safe(m.get("currentRatioTTM"))
            row["enterprise_value"] = _safe(m.get("enterpriseValueTTM"))
            row["payout_ratio"]     = _safe(m.get("payoutRatioTTM"))
    except Exception as e:
        print(f"  [key-metrics] {e}")

    # ── Income Statement ───────────────────────────────────────────────────────
    try:
        d = requests.get(f"{FMP_BASE}/income-statement", params={**p, "limit": 1}, headers=h, timeout=15).json()
        if isinstance(d, list) and d:
            s = d[0]
            row["revenue"]          = _safe(s.get("revenue"))
            row["gross_profit"]     = _safe(s.get("grossProfit"))
            row["ebitda"]           = _safe(s.get("ebitda"))
            row["operating_income"] = _safe(s.get("operatingIncome"))
            row["net_income"]       = _safe(s.get("netIncome"))
            row["eps"]              = _safe(s.get("eps"))
            rev = row.get("revenue")
            if rev and rev > 0:
                oi = row.get("operating_income")
                ni = row.get("net_income")
                eb = row.get("ebitda")
                if oi is not None: row["operating_margin"] = round(oi / rev, 6)
                if ni is not None: row["profit_margin"]    = round(ni / rev, 6)
                if eb is not None: row["ebitda_margin"]    = round(eb / rev, 6)
    except Exception as e:
        print(f"  [income] {e}")

    # ── Balance Sheet ──────────────────────────────────────────────────────────
    try:
        d = requests.get(f"{FMP_BASE}/balance-sheet-statement", params={**p, "limit": 1}, headers=h, timeout=15).json()
        if isinstance(d, list) and d:
            b = d[0]
            row["total_debt"] = _safe(b.get("totalDebt") or b.get("longTermDebt"))
            row["total_cash"] = _safe(b.get("cashAndShortTermInvestments") or b.get("cashAndCashEquivalents"))
    except Exception as e:
        print(f"  [balance-sheet] {e}")

    # ── Cash Flow ──────────────────────────────────────────────────────────────
    try:
        d = requests.get(f"{FMP_BASE}/cash-flow-statement", params={**p, "limit": 1}, headers=h, timeout=15).json()
        if isinstance(d, list) and d:
            c = d[0]
            row["operating_cashflow"] = _safe(c.get("operatingCashFlow"))
            row["free_cashflow"]      = _safe(c.get("freeCashFlow"))
    except Exception as e:
        print(f"  [cashflow] {e}")

    # ── Ratios ─────────────────────────────────────────────────────────────────
    try:
        d = requests.get(f"{FMP_BASE}/ratios", params={**p, "limit": 1}, headers=h, timeout=15).json()
        if isinstance(d, list) and d:
            rt = d[0]
            row["dividend_yield"]  = _safe(rt.get("dividendYield"))
            row["dividend_rate"]   = _safe(rt.get("dividendPerShare"))
            row["payout_ratio"]    = _safe(rt.get("payoutRatio")) or row.get("payout_ratio")
            row["revenue_growth"]  = _safe(rt.get("revenueGrowth"))
            row["earnings_growth"] = _safe(rt.get("netIncomeGrowth") or rt.get("epsgrowth"))
    except Exception as e:
        print(f"  [ratios] {e}")

    # ── Price Target ───────────────────────────────────────────────────────────
    try:
        d = requests.get(f"{FMP_BASE}/price-target-summary", params=p, headers=h, timeout=15).json()
        if isinstance(d, list) and d:
            pt = d[0]
            row["target_price"]   = _safe(pt.get("lastYearAvgPriceTarget") or pt.get("allTimeAvgPriceTarget"))
            row["target_high"]    = _safe(pt.get("lastYearMaxPriceTarget") or pt.get("allTimeMaxPriceTarget"))
            row["target_low"]     = _safe(pt.get("lastYearMinPriceTarget") or pt.get("allTimeMinPriceTarget"))
            row["analyst_count"]  = _safe(pt.get("lastYearCount") or pt.get("allTimeCount"))
    except Exception as e:
        print(f"  [price-target] {e}")

    # ── Analyst Estimates (forward EPS / PE) ───────────────────────────────────
    try:
        d = requests.get(f"{FMP_BASE}/analyst-estimates", params={**p, "limit": 1}, headers=h, timeout=15).json()
        if isinstance(d, list) and d:
            est  = d[0]
            feps = _safe(est.get("estimatedEpsAvg"))
            row["forward_eps"] = feps
            price = row.get("current_price")
            if feps and price and feps > 0:
                row["forward_pe"] = round(price / feps, 2)
    except Exception as e:
        print(f"  [estimates] {e}")

    return row


def upsert_to_supabase(row):
    clean = {k: v for k, v in row.items() if v is not None}
    try:
        supabase.table("stock_fundamentals").upsert(clean, on_conflict="ticker").execute()
        return True
    except Exception as e:
        print(f"  [supabase upsert] {row.get('ticker')}: {e}")
        return False


def main():
    print(f"Fetching {len(MISSING)} missing tickers from FMP...\n")
    success, skipped, failed = [], [], []

    for ticker in MISSING:
        print(f"→ {ticker}", end=" ", flush=True)
        try:
            row = fetch_fmp(ticker)
            if not row.get("name") and not row.get("current_price"):
                print("(no data — skipping)")
                skipped.append(ticker)
                continue
            ok = upsert_to_supabase(row)
            if ok:
                print("✓")
                success.append(ticker)
            else:
                print("✗ upsert failed")
                failed.append(ticker)
        except Exception as e:
            print(f"✗ {e}")
            failed.append(ticker)
        time.sleep(0.25)

    print(f"\n{'='*40}")
    print(f"Done. Success: {len(success)}, Skipped: {len(skipped)}, Failed: {len(failed)}")
    if skipped: print(f"Skipped (no data / delisted): {skipped}")
    if failed:  print(f"Failed: {failed}")


if __name__ == "__main__":
    main()
