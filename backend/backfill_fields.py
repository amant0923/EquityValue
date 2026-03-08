"""
Backfill missing fields for all tickers in stock_fundamentals.
Fetches only fields that are currently NULL — does not overwrite existing data.
Usage: FMP_KEY=your_key python3 backfill_fields.py
"""
import os, requests, time, math, json
from supabase import create_client

SUPABASE_URL = "https://efbtgnplotlshrwbotfp.supabase.co"
SUPABASE_KEY = "sb_publishable_x3ZqwJc8Ir3yO0tGKRncSQ_blmR27Wt"
FMP_KEY      = os.environ.get("FMP_KEY", "")
FMP_BASE     = "https://financialmodelingprep.com/stable"

if not FMP_KEY:
    raise SystemExit("Set FMP_KEY environment variable before running.")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def _safe(val):
    if val is None: return None
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None

def get(endpoint, params):
    try:
        r = requests.get(
            f"{FMP_BASE}/{endpoint}",
            params={"apikey": FMP_KEY, **params},
            headers={"User-Agent": "ValuEngine/1.0"},
            timeout=15
        )
        if r.status_code == 429:
            print(" [rate limited, waiting 60s]", end="", flush=True)
            time.sleep(60)
            r = requests.get(f"{FMP_BASE}/{endpoint}",
                             params={"apikey": FMP_KEY, **params}, timeout=15)
        d = r.json()
        return d[0] if isinstance(d, list) and d else None
    except Exception:
        return None

def backfill(ticker, existing):
    """Return a dict of fields to patch. Only includes non-None values for currently-null fields."""
    patch = {}
    p = {"symbol": ticker}

    needs_market   = existing.get("market_cap") is None
    needs_shares   = existing.get("shares_outstanding") is None
    needs_pe       = existing.get("pe_ratio") is None
    needs_pb       = existing.get("pb_ratio") is None
    needs_peg      = existing.get("peg_ratio") is None
    needs_de       = existing.get("debt_to_equity") is None
    needs_roe      = existing.get("roe") is None
    needs_roa      = existing.get("roa") is None
    needs_eps      = existing.get("eps") is None
    needs_bv       = existing.get("book_value") is None
    needs_rev_g    = existing.get("revenue_growth") is None
    needs_earn_g   = existing.get("earnings_growth") is None
    needs_div_rate = existing.get("dividend_rate") is None
    needs_payout   = existing.get("payout_ratio") is None
    needs_target   = existing.get("target_price") is None
    needs_fwd_pe   = existing.get("forward_pe") is None
    needs_fwd_eps  = existing.get("forward_eps") is None

    # ── key-metrics-ttm: market_cap, roe, roa ─────────────────────────────────
    if needs_market or needs_roe or needs_roa:
        d = get("key-metrics-ttm", p)
        if d:
            if needs_market:
                v = _safe(d.get("marketCap"))
                if v: patch["market_cap"] = v
            if needs_roe:
                v = _safe(d.get("returnOnEquityTTM"))
                if v is not None: patch["roe"] = v
            if needs_roa:
                v = _safe(d.get("returnOnAssetsTTM"))
                if v is not None: patch["roa"] = v
            # Derive book_value from Graham number if available
            if needs_bv and needs_eps:
                gn  = _safe(d.get("grahamNumberTTM"))
                # will compute bvps later with eps from income statement

    # ── ratios-ttm: pe, pb, peg, debt_to_equity, dividend ─────────────────────
    if needs_pe or needs_pb or needs_peg or needs_de or needs_div_rate or needs_payout:
        d = get("ratios-ttm", p)
        if d:
            if needs_pe:
                v = _safe(d.get("priceToEarningsRatioTTM"))
                if v and v > 0: patch["pe_ratio"] = round(v, 2)
            if needs_pb:
                v = _safe(d.get("priceToBookRatioTTM"))
                if v and v > 0: patch["pb_ratio"] = round(v, 2)
            if needs_peg:
                v = _safe(d.get("priceToEarningsGrowthRatioTTM"))
                if v: patch["peg_ratio"] = round(v, 2)
            if needs_de:
                v = _safe(d.get("debtToEquityRatioTTM"))
                if v is not None: patch["debt_to_equity"] = round(v, 4)
            if needs_div_rate:
                v = _safe(d.get("dividendsPerShareTTM"))
                if v: patch["dividend_rate"] = v
            if needs_payout:
                v = _safe(d.get("payoutRatioTTM") or d.get("dividendPayoutRatioTTM"))
                if v is not None: patch["payout_ratio"] = v

    # ── income-statement: eps, shares_outstanding ──────────────────────────────
    if needs_eps or needs_shares or needs_bv:
        d = get("income-statement", {**p, "limit": 1})
        if d:
            eps_val = _safe(d.get("eps") or d.get("epsDiluted"))
            shares_val = _safe(d.get("weightedAverageShsOut") or d.get("weightedAverageShsOutDil"))
            if needs_eps and eps_val: patch["eps"] = eps_val
            if needs_shares and shares_val: patch["shares_outstanding"] = shares_val
            # Store for bv calc
            _eps_for_bv = eps_val

    # ── balance-sheet: book_value per share ────────────────────────────────────
    if needs_bv:
        d = get("balance-sheet-statement", {**p, "limit": 1})
        if d:
            equity = _safe(d.get("totalStockholdersEquity"))
            shares = patch.get("shares_outstanding") or _safe(existing.get("shares_outstanding"))
            if equity and shares and shares > 0:
                bvps = round(equity / shares, 4)
                if bvps > 0:
                    patch["book_value"] = bvps

    # ── financial-growth: revenue_growth, earnings_growth ─────────────────────
    if needs_rev_g or needs_earn_g:
        d = get("financial-growth", {**p, "limit": 1})
        if d:
            if needs_rev_g:
                v = _safe(d.get("revenueGrowth"))
                if v is not None: patch["revenue_growth"] = v
            if needs_earn_g:
                v = _safe(d.get("netIncomeGrowth") or d.get("epsgrowth"))
                if v is not None: patch["earnings_growth"] = v

    # ── price-target-summary: target_price, high, low, analyst_count ──────────
    if needs_target:
        d = get("price-target-summary", p)
        if d:
            v = _safe(d.get("lastYearAvgPriceTarget") or d.get("allTimeAvgPriceTarget"))
            if v: patch["target_price"] = v
            v = _safe(d.get("lastYearMaxPriceTarget") or d.get("allTimeMaxPriceTarget"))
            if v: patch["target_high"] = v
            v = _safe(d.get("lastYearMinPriceTarget") or d.get("allTimeMinPriceTarget"))
            if v: patch["target_low"] = v
            v = _safe(d.get("lastYearCount") or d.get("allTimeCount"))
            if v: patch["analyst_count"] = v

    # ── analyst-estimates: forward_eps, forward_pe ────────────────────────────
    if needs_fwd_eps or needs_fwd_pe:
        d = get("analyst-estimates", {**p, "limit": 1})
        if d:
            feps = _safe(d.get("estimatedEpsAvg"))
            if feps and needs_fwd_eps:
                patch["forward_eps"] = feps
            price = existing.get("current_price")
            if feps and price and feps > 0 and needs_fwd_pe:
                patch["forward_pe"] = round(float(price) / feps, 2)

    return patch


def main():
    # Fetch all tickers and their current null fields
    print("Loading all tickers from Supabase...")
    rows = supabase.table("stock_fundamentals")\
        .select("ticker,market_cap,shares_outstanding,pe_ratio,pb_ratio,peg_ratio,"
                "debt_to_equity,roe,roa,eps,book_value,revenue_growth,earnings_growth,"
                "dividend_rate,payout_ratio,target_price,forward_pe,forward_eps,current_price")\
        .execute().data
    print(f"Found {len(rows)} tickers\n")

    success, skipped, failed = 0, 0, 0

    for i, row in enumerate(rows):
        ticker = row["ticker"]
        # Skip if all key fields already filled
        null_count = sum(1 for f in ["pe_ratio","eps","market_cap","roe","roa","book_value",
                                      "revenue_growth","shares_outstanding"] if row.get(f) is None)
        if null_count == 0:
            print(f"[{i+1}/{len(rows)}] {ticker} — already complete, skipping")
            skipped += 1
            continue

        print(f"[{i+1}/{len(rows)}] {ticker} ({null_count} nulls)...", end=" ", flush=True)
        try:
            patch = backfill(ticker, row)
            if patch:
                supabase.table("stock_fundamentals")\
                    .update(patch)\
                    .eq("ticker", ticker)\
                    .execute()
                print(f"✓ patched {list(patch.keys())}")
                success += 1
            else:
                print("nothing to patch")
                skipped += 1
        except Exception as e:
            print(f"✗ {e}")
            failed += 1

        time.sleep(0.15)  # ~6-7 req/s, well within FMP limits

    print(f"\n{'='*50}")
    print(f"Done. Patched: {success}, Skipped: {skipped}, Failed: {failed}")


if __name__ == "__main__":
    main()
