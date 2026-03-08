"""
Fetch fundamental data for missing S&P 500 tickers from FMP and upsert into Supabase.
Usage:  FMP_KEY=your_key python3 fetch_missing.py
"""
import os, requests, time
from supabase import create_client

SUPABASE_URL = "https://efbtgnplotlshrwbotfp.supabase.co"
SUPABASE_KEY = "sb_publishable_x3ZqwJc8Ir3yO0tGKRncSQ_blmR27Wt"
FMP_KEY      = os.environ.get("FMP_KEY", "")
FMP_BASE     = "https://financialmodelingprep.com/api/v3"

if not FMP_KEY:
    raise SystemExit("Set FMP_KEY environment variable before running.")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

MISSING = [
    'BA', 'BAC', 'BBWI', 'BBY', 'BDX', 'BMY', 'BR', 'BRO',
    'CAT', 'CBRE', 'CDW', 'CE', 'CFR', 'CPT', 'CZR',
    'DFS', 'FANG', 'HSIC', 'RHI', 'T', 'WHR', 'XRAY',
    # Possibly delisted / renamed — will skip gracefully if no data:
    'DNB', 'IPGP', 'PEAK', 'PGRE', 'VNT',
]

def _safe(val):
    if val is None:
        return None
    try:
        f = float(val)
        import math
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None

def fetch_fmp(ticker):
    h = {"User-Agent": "ValuEngine/1.0"}
    row = {"ticker": ticker}

    # ── Profile ────────────────────────────────────────────────────────────────
    try:
        r = requests.get(f"{FMP_BASE}/profile/{ticker}", params={"apikey": FMP_KEY}, headers=h, timeout=15)
        d = r.json()
        if isinstance(d, list) and d:
            p = d[0]
            row["name"]               = p.get("companyName", ticker)
            row["sector"]             = p.get("sector", "Unknown")
            row["industry"]           = p.get("industry", "Unknown")
            row["website"]            = p.get("website", "")
            row["description"]        = p.get("description", "")
            row["current_price"]      = _safe(p.get("price"))
            row["market_cap"]         = _safe(p.get("mktCap"))
            row["enterprise_value"]   = _safe(p.get("dcf"))   # approximation
            row["beta"]               = _safe(p.get("beta"))
            row["shares_outstanding"] = _safe(p.get("sharesOutstanding"))
            row["week_52_high"]       = _safe(p.get("range", "").split("-")[-1].strip()) if p.get("range") else None
            row["week_52_low"]        = _safe(p.get("range", "").split("-")[0].strip()) if p.get("range") else None
    except Exception as e:
        print(f"  [profile error] {ticker}: {e}")

    # ── Key Metrics (TTM) ──────────────────────────────────────────────────────
    try:
        r = requests.get(f"{FMP_BASE}/key-metrics-ttm/{ticker}", params={"apikey": FMP_KEY}, headers=h, timeout=15)
        d = r.json()
        if isinstance(d, list) and d:
            m = d[0]
            row["pe_ratio"]        = _safe(m.get("peRatioTTM"))
            row["pb_ratio"]        = _safe(m.get("pbRatioTTM"))
            row["ps_ratio"]        = _safe(m.get("priceToSalesRatioTTM"))
            row["peg_ratio"]       = _safe(m.get("pegRatioTTM"))
            row["ev_to_ebitda"]    = _safe(m.get("enterpriseValueOverEBITDATTM"))
            row["ev_to_revenue"]   = _safe(m.get("evToSalesTTM") or m.get("priceToSalesRatioTTM"))
            row["eps"]             = _safe(m.get("netIncomePerShareTTM"))
            row["book_value"]      = _safe(m.get("bookValuePerShareTTM"))
            row["roe"]             = _safe(m.get("roeTTM"))
            row["roa"]             = _safe(m.get("roaTTM"))
            row["debt_to_equity"]  = _safe(m.get("debtToEquityTTM"))
            row["current_ratio"]   = _safe(m.get("currentRatioTTM"))
            row["enterprise_value"]= _safe(m.get("enterpriseValueTTM")) or row.get("enterprise_value")
            row["payout_ratio"]    = _safe(m.get("payoutRatioTTM"))
            row["analyst_count"]   = None
    except Exception as e:
        print(f"  [key-metrics error] {ticker}: {e}")

    # ── Income Statement (TTM) ─────────────────────────────────────────────────
    try:
        r = requests.get(f"{FMP_BASE}/income-statement/{ticker}",
                         params={"apikey": FMP_KEY, "period": "annual", "limit": 1}, headers=h, timeout=15)
        d = r.json()
        if isinstance(d, list) and d:
            s = d[0]
            row["revenue"]           = _safe(s.get("revenue"))
            row["gross_profit"]      = _safe(s.get("grossProfit"))
            row["ebitda"]            = _safe(s.get("ebitda"))
            row["operating_income"]  = _safe(s.get("operatingIncome"))
            row["net_income"]        = _safe(s.get("netIncome"))
            row["eps"]               = _safe(s.get("eps")) or row.get("eps")
            rev = row.get("revenue")
            gp  = row.get("gross_profit")
            oi  = row.get("operating_income")
            ni  = row.get("net_income")
            eb  = row.get("ebitda")
            if rev and rev > 0:
                if oi is not None: row["operating_margin"] = round(oi / rev, 6)
                if ni is not None: row["profit_margin"]    = round(ni / rev, 6)
                if eb is not None: row["ebitda_margin"]    = round(eb / rev, 6)
    except Exception as e:
        print(f"  [income error] {ticker}: {e}")

    # ── Balance Sheet ──────────────────────────────────────────────────────────
    try:
        r = requests.get(f"{FMP_BASE}/balance-sheet-statement/{ticker}",
                         params={"apikey": FMP_KEY, "period": "annual", "limit": 1}, headers=h, timeout=15)
        d = r.json()
        if isinstance(d, list) and d:
            b = d[0]
            row["total_debt"]  = _safe(b.get("totalDebt") or b.get("longTermDebt"))
            row["total_cash"]  = _safe(b.get("cashAndCashEquivalents") or b.get("cashAndShortTermInvestments"))
    except Exception as e:
        print(f"  [balance-sheet error] {ticker}: {e}")

    # ── Cash Flow ──────────────────────────────────────────────────────────────
    try:
        r = requests.get(f"{FMP_BASE}/cash-flow-statement/{ticker}",
                         params={"apikey": FMP_KEY, "period": "annual", "limit": 1}, headers=h, timeout=15)
        d = r.json()
        if isinstance(d, list) and d:
            c = d[0]
            row["operating_cashflow"] = _safe(c.get("operatingCashFlow"))
            row["free_cashflow"]      = _safe(c.get("freeCashFlow"))
    except Exception as e:
        print(f"  [cashflow error] {ticker}: {e}")

    # ── Ratios (annual) ────────────────────────────────────────────────────────
    try:
        r = requests.get(f"{FMP_BASE}/ratios/{ticker}",
                         params={"apikey": FMP_KEY, "period": "annual", "limit": 1}, headers=h, timeout=15)
        d = r.json()
        if isinstance(d, list) and d:
            rt = d[0]
            row["dividend_yield"]  = _safe(rt.get("dividendYield"))
            row["dividend_rate"]   = _safe(rt.get("dividendPerShare"))
            row["payout_ratio"]    = _safe(rt.get("payoutRatio")) or row.get("payout_ratio")
            row["revenue_growth"]  = _safe(rt.get("revenueGrowth"))
            row["earnings_growth"] = _safe(rt.get("netIncomeGrowth") or rt.get("epsgrowth"))
    except Exception as e:
        print(f"  [ratios error] {ticker}: {e}")

    # ── Price Target / Analyst ─────────────────────────────────────────────────
    try:
        r = requests.get(f"{FMP_BASE}/price-target-summary/{ticker}",
                         params={"apikey": FMP_KEY}, headers=h, timeout=15)
        d = r.json()
        if isinstance(d, list) and d:
            pt = d[0]
            row["target_price"] = _safe(pt.get("targetConsensus") or pt.get("targetMean"))
            row["target_high"]  = _safe(pt.get("targetHigh"))
            row["target_low"]   = _safe(pt.get("targetLow"))
            row["recommendation"] = pt.get("recommendation") or pt.get("recommendationMean")
            row["analyst_count"]  = _safe(pt.get("numberOfAnalysts"))
        elif isinstance(d, dict):
            row["target_price"] = _safe(d.get("targetConsensus") or d.get("targetMean"))
            row["target_high"]  = _safe(d.get("targetHigh"))
            row["target_low"]   = _safe(d.get("targetLow"))
    except Exception as e:
        print(f"  [price-target error] {ticker}: {e}")

    # ── Forward PE / EPS from estimates ───────────────────────────────────────
    try:
        r = requests.get(f"{FMP_BASE}/analyst-estimates/{ticker}",
                         params={"apikey": FMP_KEY, "period": "annual", "limit": 1}, headers=h, timeout=15)
        d = r.json()
        if isinstance(d, list) and d:
            est = d[0]
            feps = _safe(est.get("estimatedEpsAvg"))
            row["forward_eps"] = feps
            price = row.get("current_price")
            if feps and price and feps > 0:
                row["forward_pe"] = round(price / feps, 2)
    except Exception as e:
        print(f"  [estimates error] {ticker}: {e}")

    return row


def upsert_to_supabase(row):
    # Remove None values to avoid overwriting good data with nulls
    clean = {k: v for k, v in row.items() if v is not None}
    try:
        supabase.table("stock_fundamentals").upsert(clean, on_conflict="ticker").execute()
        return True
    except Exception as e:
        print(f"  [supabase upsert error] {row.get('ticker')}: {e}")
        return False


def main():
    print(f"Fetching {len(MISSING)} missing tickers from FMP...\n")
    success, skipped, failed = [], [], []

    for ticker in MISSING:
        print(f"→ {ticker}", end=" ", flush=True)
        try:
            row = fetch_fmp(ticker)
            # Skip if we got no meaningful data (probably delisted)
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
        time.sleep(0.3)  # respect FMP rate limits

    print(f"\n{'='*40}")
    print(f"Done. Success: {len(success)}, Skipped: {len(skipped)}, Failed: {len(failed)}")
    if skipped: print(f"Skipped (no data): {skipped}")
    if failed:  print(f"Failed: {failed}")


if __name__ == "__main__":
    main()
