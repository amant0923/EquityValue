"""
Weekly refresh: fetch corporate governance data for all S&P 500 tickers.
Stores results in governance_cache table.

Usage: FMP_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python3 refresh_governance.py
Schedule: Sunday 6am ET via GitHub Actions
"""
import os
import sys
import json
import time
from datetime import datetime, timedelta, timezone

from supabase import create_client
from fmp_client import fmp_get_list, fmp_get_first

# ── Supabase setup ────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", os.environ.get("SUPABASE_KEY", ""))

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

FMP_KEY = os.environ.get("FMP_KEY", "")

_BOARD_KEYWORDS = ("director", "board", "chairman", "chairwoman")


def _is_board_member(title: str) -> bool:
    if not title:
        return False
    lower = title.lower()
    return any(kw in lower for kw in _BOARD_KEYWORDS)


def get_all_tickers():
    rows = supabase.table("stock_fundamentals").select("ticker").execute().data
    return [r["ticker"] for r in rows]


def compute_governance(ticker: str) -> dict | None:
    """Compute governance data for a ticker. Returns dict or None."""
    params = {"apikey": FMP_KEY}

    # FMP: key executives
    raw_execs = fmp_get_list(f"key-executives/{ticker}", params)

    executives = []
    board = []
    for ex in raw_execs:
        entry = {
            "name": ex.get("name", ""),
            "title": ex.get("title", ""),
            "pay": ex.get("pay"),
            "age": ex.get("age"),
            "year_born": ex.get("yearBorn"),
            "gender": ex.get("gender", ""),
        }
        if _is_board_member(entry["title"]):
            board.append({"name": entry["name"], "title": entry["title"], "gender": entry["gender"]})
        else:
            executives.append(entry)

    # Board stats
    total_board = len(board)
    female_board = sum(1 for b in board if (b.get("gender") or "").lower() == "female")
    board_stats = {
        "total_members": total_board,
        "female_count": female_board,
        "female_pct": round(female_board / total_board * 100, 1) if total_board > 0 else 0,
    }

    # FMP: institutional holders
    raw_holders = fmp_get_list(f"institutional-holder/{ticker}", params)

    # Supabase: fundamentals
    fund_row = supabase.table("stock_fundamentals") \
        .select("market_cap, shares_outstanding, total_debt, total_cash, current_price") \
        .eq("ticker", ticker).limit(1).execute().data

    shares_outstanding = None
    market_cap = None
    total_debt_fund = None
    total_cash_fund = None

    if fund_row:
        f = fund_row[0]
        shares_outstanding = f.get("shares_outstanding")
        market_cap = f.get("market_cap")
        total_debt_fund = f.get("total_debt")
        total_cash_fund = f.get("total_cash")

    # Map institutional holders
    institutional_holders = []
    for h in raw_holders[:10]:
        shares = h.get("shares") or 0
        weight = round(shares / shares_outstanding * 100, 2) if shares_outstanding and shares_outstanding > 0 else None
        institutional_holders.append({
            "holder_name": h.get("holder", ""),
            "shares": shares,
            "weight_pct": weight,
            "change": h.get("change"),
            "date_reported": h.get("dateReported"),
        })

    # Supabase: balance sheet for capital structure
    total_equity = None
    total_debt_bs = None

    bs_rows = supabase.table("financial_statements") \
        .select("total_equity, total_debt, total_assets") \
        .eq("ticker", ticker).eq("statement_type", "balance_sheet") \
        .order("period_date", desc=True).limit(1).execute().data

    if bs_rows:
        bs = bs_rows[0]
        total_equity = bs.get("total_equity")
        total_debt_bs = bs.get("total_debt")

    total_debt = total_debt_bs if total_debt_bs is not None else total_debt_fund
    total_cash = total_cash_fund or 0

    capital_structure = {}
    if total_debt is not None and total_equity is not None:
        total_capital = (total_debt or 0) + (total_equity or 0)
        debt_pct = round(total_debt / total_capital * 100, 1) if total_capital > 0 else 0
        equity_pct = round(total_equity / total_capital * 100, 1) if total_capital > 0 else 0
        net_debt = (total_debt or 0) - total_cash
        ev = (market_cap or 0) + net_debt if market_cap else None
        capital_structure = {
            "debt_pct": debt_pct, "equity_pct": equity_pct,
            "total_debt": total_debt, "total_equity": total_equity,
            "total_capital": total_capital, "market_cap": market_cap,
            "net_debt": net_debt, "enterprise_value": ev,
        }

    # Insider sentiment (last 90 days)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%d")
    insider_rows = supabase.table("insider_trades") \
        .select("transaction_type, shares_traded") \
        .eq("ticker", ticker).gte("filing_date", cutoff).execute().data

    buys = 0
    sells = 0
    for row in insider_rows:
        shares = abs(row.get("shares_traded") or 0)
        txn = (row.get("transaction_type") or "").strip()
        if txn == "Purchase":
            buys += shares
        elif txn == "Sale":
            sells += shares

    sentiment = "bullish" if buys > sells else ("bearish" if sells > buys else "neutral")
    insider_sentiment = {"net_buys_shares": buys, "net_sells_shares": sells, "net_sentiment": sentiment}

    # Compensation summary
    pay_values = [ex["pay"] for ex in executives if ex.get("pay") and ex["pay"] > 0]
    ceo_candidates = [ex for ex in executives if "ceo" in (ex.get("title") or "").lower() or "chief executive" in (ex.get("title") or "").lower()]
    ceo_pay = ceo_candidates[0]["pay"] if ceo_candidates and ceo_candidates[0].get("pay") else None

    if pay_values:
        sorted_pay = sorted(pay_values)
        mid = len(sorted_pay) // 2
        median_exec_pay = sorted_pay[mid] if len(sorted_pay) % 2 == 1 else round((sorted_pay[mid - 1] + sorted_pay[mid]) / 2)
    else:
        median_exec_pay = None

    compensation = {"ceo_pay": ceo_pay, "median_exec_pay": median_exec_pay}

    return {
        "ticker": ticker,
        "executives": executives,
        "board": board,
        "board_stats": board_stats,
        "institutional_holders": institutional_holders,
        "insider_sentiment": insider_sentiment,
        "compensation": compensation,
        "capital_structure": capital_structure,
    }


def main():
    tickers = get_all_tickers()
    total = len(tickers)
    print(f"Refreshing governance for {total} tickers...")

    ok = 0
    fail = 0

    for i, ticker in enumerate(tickers):
        try:
            result = compute_governance(ticker)
            if result is None:
                print(f"  [{i+1}/{total}] {ticker} — SKIPPED")
                fail += 1
                continue

            record = {
                "ticker": ticker,
                "executives": json.dumps(result["executives"]),
                "board": json.dumps(result["board"]),
                "board_stats": json.dumps(result["board_stats"]),
                "institutional_holders": json.dumps(result["institutional_holders"]),
                "insider_sentiment": json.dumps(result["insider_sentiment"]),
                "compensation": json.dumps(result["compensation"]),
                "capital_structure": json.dumps(result["capital_structure"]),
            }

            supabase.table("governance_cache").upsert(record, on_conflict="ticker").execute()
            ok += 1
            print(f"  [{i+1}/{total}] {ticker} — OK")

        except Exception as e:
            fail += 1
            print(f"  [{i+1}/{total}] {ticker} — FAILED: {e}")

        time.sleep(0.5)  # FMP rate limit handled by fmp_client, add extra safety

    print(f"\nDone: {ok} OK, {fail} failed/skipped out of {total}")


if __name__ == "__main__":
    main()
