"""Daily portfolio snapshot job.
Runs Mon-Fri after market close via GitHub Actions.
Uses service_role key to bypass RLS and read all users' portfolios.
"""
import os
from datetime import date, datetime
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def is_weekend():
    return datetime.utcnow().weekday() >= 5


def fetch_bulk_prices(tickers: list[str]) -> dict[str, float]:
    """Fetch closing prices from stock_fundamentals table."""
    result = sb.table("stock_fundamentals") \
        .select("ticker, current_price") \
        .in_("ticker", tickers) \
        .execute().data or []
    return {r["ticker"]: float(r["current_price"]) for r in result if r.get("current_price")}


def main():
    if is_weekend():
        print("Weekend — skipping snapshot.")
        return

    today = date.today().isoformat()
    print(f"Portfolio snapshot for {today}")

    # Fetch all holdings across all portfolios
    holdings = sb.table("portfolio_holdings") \
        .select("portfolio_id, ticker, shares, avg_price") \
        .execute().data or []

    if not holdings:
        print("No holdings found — nothing to snapshot.")
        return

    # Unique tickers
    tickers = list(set(h["ticker"] for h in holdings))
    print(f"Fetching prices for {len(tickers)} tickers...")
    prices = fetch_bulk_prices(tickers)
    print(f"Got prices for {len(prices)} tickers.")

    # Group holdings by portfolio
    portfolios: dict[str, list] = {}
    for h in holdings:
        portfolios.setdefault(h["portfolio_id"], []).append(h)

    # Compute snapshots
    snapshots = []
    for pid, holdings_list in portfolios.items():
        total_value = 0.0
        total_cost = 0.0
        for h in holdings_list:
            price = prices.get(h["ticker"], 0)
            shares = float(h["shares"])
            total_value += shares * price
            total_cost += shares * float(h["avg_price"])

        snapshots.append({
            "portfolio_id": pid,
            "snapshot_date": today,
            "total_value": round(total_value, 2),
            "total_cost": round(total_cost, 2),
        })

    # Upsert snapshots
    print(f"Upserting {len(snapshots)} snapshots...")
    sb.table("portfolio_snapshots") \
        .upsert(snapshots, on_conflict="portfolio_id,snapshot_date") \
        .execute()

    print(f"Done. Snapshotted {len(snapshots)} portfolios.")


if __name__ == "__main__":
    main()
