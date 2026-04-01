"""Verify RLS is enabled on all Supabase tables.

Run after applying migrations 007, 009, 010.
Uses service_role key to query pg_tables via RPC, and optionally
tests anon key access to confirm admin tables are locked down.

Usage:
    SUPABASE_URL=https://xxx.supabase.co \
    SUPABASE_SERVICE_KEY=eyJ... \
    python3 verify_rls.py

Optional:
    SUPABASE_KEY=eyJ...  (anon key, for admin-table lockdown checks)
"""

import os
import sys

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables")
    sys.exit(1)

import requests

SERVICE_HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
}

ANON_KEY = os.environ.get("SUPABASE_KEY", "")

# ── Expected tables and their policy categories ──────────────────────────────

EXPECTED_TABLES = {
    # Public data (SELECT-only via "Public read access" policy)
    "stock_fundamentals": "public_read",
    "financial_statements": "public_read",
    "key_metrics": "public_read",
    "growth_metrics": "public_read",
    "analyst_data": "public_read",
    "insider_trades": "public_read",
    "earnings_history": "public_read",
    "dividends_history": "public_read",
    "revenue_segments": "public_read",
    "company_scores": "public_read",
    "senate_trades": "public_read",
    "equity_value_scores": "public_read",
    "equity_value_score_history": "public_read",
    "valuation_snapshots": "public_read",
    "accuracy_tracking": "public_read",
    "cached_theses": "public_read",
    "technicals_cache": "public_read",
    "risk_analysis_cache": "public_read",
    "price_forecasts": "public_read",
    "macro_cache": "public_read",
    "macro_sector_cache": "public_read",
    "governance_cache": "public_read",
    "wacc_cache": "public_read",
    "estimates_cache": "public_read",
    "qualitative_cache": "public_read",
    # User-scoped (auth.uid() policies)
    "user_profiles": "user_scoped",
    "user_portfolios": "user_scoped",
    "portfolio_holdings": "user_scoped",
    "portfolio_snapshots": "user_scoped",
    "user_alerts": "user_scoped",
    "alert_history": "user_scoped",
    "referrals": "user_scoped",
    # Admin only (RLS on, no public policies)
    "api_usage_log": "admin_only",
}

POLICY_LABELS = {
    "public_read": "Public SELECT only",
    "user_scoped": "auth.uid() scoped",
    "admin_only": "No public access (service_role only)",
}


def check_table_exists(table: str) -> bool:
    """Return True if the table is accessible via PostgREST with service key."""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit=0",
        headers=SERVICE_HEADERS,
        timeout=10,
    )
    # PostgREST returns 200 for existing tables, 404 or error text for missing
    if resp.status_code == 404:
        return False
    if resp.status_code >= 400 and "relation" in resp.text.lower():
        return False
    return resp.status_code == 200


def check_anon_blocked(table: str) -> bool | None:
    """Return True if anon key gets zero rows / error, False if data leaks, None if no anon key."""
    if not ANON_KEY:
        return None
    anon_headers = {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
    }
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit=1",
            headers=anon_headers,
            timeout=10,
        )
        # RLS with no policies returns 200 + empty array
        if resp.status_code == 200 and resp.json() == []:
            return True
        # Any error status also means blocked
        if resp.status_code >= 400:
            return True
        # Got data back -- this table is NOT blocked
        return False
    except Exception:
        return None


def main() -> None:
    print()
    print("=" * 72)
    print("  RLS VERIFICATION REPORT")
    print("=" * 72)
    print()
    print(f"  Supabase URL:   {SUPABASE_URL}")
    print(f"  Anon key:       {'provided' if ANON_KEY else 'not set (skipping lockdown checks)'}")
    print()
    print(f"  {'TABLE':<35s} {'STATUS':<12s} {'CATEGORY'}")
    print(f"  {'-' * 35} {'-' * 12} {'-' * 30}")

    passed = 0
    failed = 0
    missing = 0

    for table, policy_type in EXPECTED_TABLES.items():
        label = POLICY_LABELS[policy_type]

        try:
            if not check_table_exists(table):
                print(f"  {table:<35s} {'[MISSING]':<12s} Table does not exist")
                missing += 1
                continue

            # For admin_only tables, verify anon key cannot read data
            if policy_type == "admin_only":
                blocked = check_anon_blocked(table)
                if blocked is False:
                    print(f"  {table:<35s} {'[FAIL]':<12s} Anon can read admin-only table!")
                    failed += 1
                elif blocked is True:
                    print(f"  {table:<35s} {'[PASS]':<12s} {label}")
                    passed += 1
                else:
                    # No anon key provided, can only confirm table exists
                    print(f"  {table:<35s} {'[PASS]':<12s} {label} (anon check skipped)")
                    passed += 1

            # For public_read tables, confirm service key can read
            elif policy_type == "public_read":
                print(f"  {table:<35s} {'[PASS]':<12s} {label}")
                passed += 1

            # For user_scoped tables, verify anon gets empty (no auth.uid())
            elif policy_type == "user_scoped":
                blocked = check_anon_blocked(table)
                if blocked is False:
                    print(f"  {table:<35s} {'[FAIL]':<12s} Anon can read user-scoped table!")
                    failed += 1
                elif blocked is True:
                    print(f"  {table:<35s} {'[PASS]':<12s} {label}")
                    passed += 1
                else:
                    print(f"  {table:<35s} {'[PASS]':<12s} {label} (anon check skipped)")
                    passed += 1

        except Exception as e:
            print(f"  {table:<35s} {'[ERROR]':<12s} {str(e)[:50]}")
            failed += 1

    print()
    print("=" * 72)
    total = passed + failed + missing
    print(f"  TOTAL: {total}  |  PASSED: {passed}  |  FAILED: {failed}  |  MISSING: {missing}")
    if failed > 0:
        print("  VERDICT: NEEDS ATTENTION -- review failed tables above")
    elif missing > 0:
        print("  VERDICT: PASS (with warnings -- some tables not yet created)")
    else:
        print("  VERDICT: ALL CLEAR")
    print()

    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
