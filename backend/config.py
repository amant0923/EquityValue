"""Centralized configuration — all secrets loaded from environment variables."""
import os
import sys

# ── Required environment variables ──────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")
FINNHUB_KEY = os.environ.get("FINNHUB_KEY", "")
FMP_KEY = os.environ.get("FMP_KEY", "")
ADMIN_TOKEN_SECRET = os.environ.get("ADMIN_TOKEN_SECRET", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")


# Analysis rate limits per plan
PLAN_LIMITS = {"trial": 3, "expired": 0, "pro": 50, "lifetime": 999999}


def require_env(name: str) -> str:
    """Return env var value or exit with an error if not set."""
    val = os.environ.get(name, "")
    if not val:
        print(f"FATAL: Required environment variable {name} is not set. Exiting.", file=sys.stderr)
        sys.exit(1)
    return val


# ── Ticker validation ─────────────────────────────────────────────────────────
import re

TICKER_PATTERN = re.compile(r'^[A-Z]{1,5}(\.[A-Z]{1,2})?$')

def validate_ticker(ticker: str) -> str:
    """Validate and normalize a stock ticker symbol."""
    ticker = ticker.upper().strip()
    if not TICKER_PATTERN.match(ticker):
        from fastapi import HTTPException
        raise HTTPException(400, "Invalid ticker format")
    return ticker
