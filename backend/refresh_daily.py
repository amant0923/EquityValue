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
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", os.environ.get("SUPABASE_KEY", ""))

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit(
        "SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_KEY) must be set. "
        "Add them as GitHub Actions secrets or export in your shell."
    )

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def _validate_record(record: dict, required_fields: list[str]) -> bool:
    """Check that required fields exist and are non-null."""
    for field in required_fields:
        if record.get(field) is None:
            return False
    return True


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
    # Skip if we got no meaningful data from FMP
    if len(clean) <= 2:  # only ticker + updated_date
        return False
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
        if shares and shares <= 0:
            continue  # Skip nonsensical negative/zero share trades
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
    # Skip if we got no score data
    if len(clean) <= 2:  # only ticker + updated_date
        return False
    supabase.table("company_scores").upsert(clean, on_conflict="ticker").execute()
    return True


def main():
    import sys
    tickers = get_all_tickers()
    total = len(tickers)
    print(f"Daily refresh for {total} tickers\n")

    success, fail = 0, 0
    for i, ticker in enumerate(tickers):
        print(f"[{i+1}/{total}] {ticker}...", end=" ", flush=True)
        try:
            refresh_analyst(ticker)
            ins = refresh_insider(ticker)
            sen = refresh_senate(ticker)
            refresh_scores(ticker)
            print(f"✓ insider:{ins} senate:{sen}")
            success += 1
        except Exception as e:
            print(f"✗ {e}")
            fail += 1

    print(f"\nResults: {success} succeeded, {fail} failed out of {total}")
    if total > 0 and fail > total * 0.5:
        print("ERROR: >50% failure rate")
        sys.exit(1)
    if fail > 0:
        print(f"WARNING: {fail} tickers failed")
    print("Done.")


if __name__ == "__main__":
    main()
