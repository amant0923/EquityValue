"""Centralized Supabase client factory.

All modules should import from here instead of creating their own clients.
Provides lazy-initialized clients that won't crash at import time if
SUPABASE_URL is not yet set. Thread-safe via double-checked locking.
"""
import os
import logging
import threading

logger = logging.getLogger(__name__)

# Lazy-initialized clients — created on first access, not at import time
_anon_client = None
_service_client = None
_lock = threading.Lock()


def get_supabase():
    """Return a Supabase client using the anon key (subject to RLS)."""
    global _anon_client
    if _anon_client is None:
        with _lock:
            if _anon_client is None:
                url = os.environ.get("SUPABASE_URL", "")
                key = os.environ.get("SUPABASE_KEY", "")
                if not url or not key:
                    return None
                from supabase import create_client
                _anon_client = create_client(url, key)
    return _anon_client


def get_supabase_service():
    """Return a Supabase client using the service role key (bypasses RLS).

    Falls back to anon key if service key is not set.
    """
    global _service_client
    if _service_client is None:
        with _lock:
            if _service_client is None:
                url = os.environ.get("SUPABASE_URL", "")
                key = os.environ.get("SUPABASE_SERVICE_KEY", "") or os.environ.get("SUPABASE_KEY", "")
                if not url or not key:
                    return None
                from supabase import create_client
                _service_client = create_client(url, key)
    return _service_client


def parse_json_strings(row: dict) -> dict:
    """Parse any double-encoded JSON string fields in a Supabase row.

    Refresh scripts stored dicts/lists with json.dumps() into JSONB columns,
    causing double-encoding. This parses them back to native Python objects.
    """
    import json
    for key, val in row.items():
        if isinstance(val, str) and val and val[0] in ('{', '['):
            try:
                row[key] = json.loads(val)
            except (ValueError, TypeError):
                pass
    return row
