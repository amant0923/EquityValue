"""
Create cache tables for pre-computed analysis data.

Usage:
    SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python3 backend/migrations/create_cache_tables.py

These tables store pre-computed results from scheduled GitHub Actions scripts,
so API routes can serve data instantly via a single SELECT.
"""
import os
import sys
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", os.environ.get("SUPABASE_KEY", ""))

if not SUPABASE_URL or not SUPABASE_KEY:
    print("FATAL: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.", file=sys.stderr)
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── SQL for all cache tables ──────────────────────────────────────────────────

TABLES_SQL = [
    # 1. Technical indicators
    """
    CREATE TABLE IF NOT EXISTS technicals_cache (
        ticker          TEXT PRIMARY KEY,
        period          TEXT DEFAULT '1y',
        price           JSONB,
        rsi             JSONB,
        sma             JSONB,
        ema             JSONB,
        macd            JSONB,
        bollinger       JSONB,
        supertrend      JSONB,
        pivot_points    JSONB,
        fibonacci       JSONB,
        support_resistance JSONB,
        volume          JSONB,
        signals         JSONB,
        performance     JSONB,
        computed_at     TIMESTAMPTZ DEFAULT now()
    );
    """,

    # 2. Risk analysis
    """
    CREATE TABLE IF NOT EXISTS risk_analysis_cache (
        ticker          TEXT PRIMARY KEY,
        qq_plot         JSONB,
        distribution    JSONB,
        histogram       JSONB,
        rolling_var     JSONB,
        rolling_mean    JSONB,
        var_summary     JSONB,
        computed_at     TIMESTAMPTZ DEFAULT now()
    );
    """,

    # 3. Price forecasts (ARIMA-GARCH)
    """
    CREATE TABLE IF NOT EXISTS price_forecasts (
        ticker              TEXT PRIMARY KEY,
        price_forecast      JSONB,
        volatility_forecast JSONB,
        model_params        JSONB,
        computed_at         TIMESTAMPTZ DEFAULT now()
    );
    """,

    # 4. Macro overview (single row)
    """
    CREATE TABLE IF NOT EXISTS macro_cache (
        id                      TEXT PRIMARY KEY DEFAULT 'global',
        gdp                     JSONB,
        inflation               JSONB,
        interest_rates          JSONB,
        consumer_confidence     JSONB,
        unemployment            JSONB,
        current                 JSONB,
        computed_at             TIMESTAMPTZ DEFAULT now()
    );
    """,

    # 5. Macro sector data
    """
    CREATE TABLE IF NOT EXISTS macro_sector_cache (
        sector          TEXT PRIMARY KEY,
        indicators      JSONB,
        computed_at     TIMESTAMPTZ DEFAULT now()
    );
    """,

    # 6. Corporate governance
    """
    CREATE TABLE IF NOT EXISTS governance_cache (
        ticker              TEXT PRIMARY KEY,
        executives          JSONB,
        board               JSONB,
        board_stats         JSONB,
        institutional_holders JSONB,
        insider_sentiment   JSONB,
        compensation        JSONB,
        capital_structure   JSONB,
        computed_at         TIMESTAMPTZ DEFAULT now()
    );
    """,

    # 7. WACC
    """
    CREATE TABLE IF NOT EXISTS wacc_cache (
        ticker              TEXT PRIMARY KEY,
        wacc                FLOAT,
        components          JSONB,
        capital_structure   JSONB,
        computed_at         TIMESTAMPTZ DEFAULT now()
    );
    """,

    # 8. Forward estimates
    """
    CREATE TABLE IF NOT EXISTS estimates_cache (
        ticker          TEXT PRIMARY KEY,
        estimates       JSONB,
        computed_at     TIMESTAMPTZ DEFAULT now()
    );
    """,

    # 9. Qualitative (SWOT + PESTLE)
    """
    CREATE TABLE IF NOT EXISTS qualitative_cache (
        ticker                  TEXT PRIMARY KEY,
        swot                    JSONB,
        pestle                  JSONB,
        swot_generated_at       TIMESTAMPTZ,
        pestle_generated_at     TIMESTAMPTZ
    );
    """,
]


def main():
    print("Creating cache tables...")
    for i, sql in enumerate(TABLES_SQL, 1):
        # Extract table name for logging
        table_name = sql.split("CREATE TABLE IF NOT EXISTS")[1].split("(")[0].strip()
        try:
            sb.postgrest.session.headers.update({"Content-Type": "application/json"})
            sb.rpc("exec_sql", {"query": sql.strip()}).execute()
            print(f"  [{i}/{len(TABLES_SQL)}] {table_name} — OK")
        except Exception as e:
            # Try raw SQL via the REST endpoint as fallback
            print(f"  [{i}/{len(TABLES_SQL)}] {table_name} — RPC failed ({e}), trying direct...")
            try:
                # Use Supabase SQL editor endpoint
                import requests
                resp = requests.post(
                    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
                    headers={
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={"query": sql.strip()},
                )
                if resp.status_code < 300:
                    print(f"           {table_name} — OK (via REST)")
                else:
                    print(f"           {table_name} — FAILED: {resp.status_code} {resp.text[:200]}")
            except Exception as e2:
                print(f"           {table_name} — FAILED: {e2}")

    print("\nDone. If RPC failed, run the SQL manually in Supabase SQL Editor:")
    print("  https://supabase.com/dashboard → SQL Editor → paste each CREATE TABLE statement")
    print("\nSQL statements for manual execution:")
    print("=" * 60)
    for sql in TABLES_SQL:
        print(sql.strip())
        print()


if __name__ == "__main__":
    main()
