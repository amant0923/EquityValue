"""Data retention cleanup — deletes old rows from high-volume tables.

Run weekly via GitHub Actions (cleanup-retention.yml).
Uses service_role key to bypass RLS.
"""
import os
import sys
from datetime import datetime, timedelta

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables")
    sys.exit(1)

from supabase import create_client

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

RETENTION = {
    "api_usage_log": {"days": 90, "date_column": "timestamp"},
    "equity_value_score_history": {"days": 365, "date_column": "computed_at"},
    "valuation_snapshots": {"days": 365, "date_column": "snapshot_date"},
    "accuracy_tracking": {"days": 365, "date_column": "snapshot_date"},
    "alert_history": {"days": 180, "date_column": "triggered_at"},
}

print(f"\nData Retention Cleanup — {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
print("=" * 55)

for table, config in RETENTION.items():
    cutoff = (datetime.utcnow() - timedelta(days=config["days"])).isoformat()
    try:
        result = sb.table(table).delete().lt(config["date_column"], cutoff).execute()
        count = len(result.data) if result.data else 0
        print(f"  {table:35s} deleted {count:>5d} rows (>{config['days']}d)")
    except Exception as e:
        print(f"  {table:35s} ERROR: {str(e)[:60]}")

print("=" * 55)
print("Done.\n")
