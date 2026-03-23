"""Centralized Supabase client factory.

All modules should import from here instead of creating their own clients.
Provides lazy-initialized clients that won't crash at import time if
SUPABASE_URL is not yet set.
"""
import os
import logging

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# Lazy-initialized clients — created on first access, not at import time
_anon_client = None
_service_client = None


def get_supabase():
    """Return a Supabase client using the anon key (subject to RLS)."""
    global _anon_client
    if _anon_client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            return None
        from supabase import create_client
        _anon_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _anon_client


def get_supabase_service():
    """Return a Supabase client using the service role key (bypasses RLS).

    Falls back to anon key if service key is not set.
    """
    global _service_client
    if _service_client is None:
        key = SUPABASE_SERVICE_KEY or SUPABASE_KEY
        if not SUPABASE_URL or not key:
            return None
        from supabase import create_client
        _service_client = create_client(SUPABASE_URL, key)
    return _service_client
