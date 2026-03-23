"""
Shared FMP API client for all data refresh scripts.
Handles rate limiting, retries, and response parsing.
"""
import os
import time
import math
import threading
import requests

FMP_KEY = os.environ.get("FMP_KEY", "")
FMP_BASE = "https://financialmodelingprep.com/stable"

if not FMP_KEY:
    raise SystemExit("Set FMP_KEY environment variable before running.")

_last_call = 0.0
_MIN_INTERVAL = 0.25  # 4 calls/sec = 240/min, safely under 300/min
_rate_lock = threading.Lock()  # Thread-safe rate limiting for concurrent pipelines

def _safe(val):
    if val is None:
        return None
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None

def fmp_get(endpoint: str, params: dict = None, retries: int = 2) -> list | dict | None:
    """Call an FMP endpoint. Returns parsed JSON (list or dict) or None on failure."""
    global _last_call
    params = params or {}
    params["apikey"] = FMP_KEY

    for attempt in range(retries + 1):
        # Thread-safe rate limit
        with _rate_lock:
            elapsed = time.time() - _last_call
            if elapsed < _MIN_INTERVAL:
                time.sleep(_MIN_INTERVAL - elapsed)
            _last_call = time.time()

        try:
            r = requests.get(
                f"{FMP_BASE}/{endpoint}",
                params=params,
                headers={"User-Agent": "EquityValuation/1.0"},
                timeout=15,
            )
            if r.status_code == 429:
                wait = 60 * (attempt + 1)
                print(f"  [rate limited, waiting {wait}s]", flush=True)
                time.sleep(wait)
                continue
            if r.status_code != 200:
                print(f"  [{endpoint}] HTTP {r.status_code}")
                return None
            return r.json()
        except Exception as e:
            print(f"  [{endpoint}] {e}")
            if attempt < retries:
                time.sleep(2)
    return None

def fmp_get_first(endpoint: str, params: dict = None) -> dict | None:
    """Call an FMP endpoint and return the first item if result is a list."""
    data = fmp_get(endpoint, params)
    if isinstance(data, list) and data:
        return data[0]
    if isinstance(data, dict):
        return data
    return None

def fmp_get_list(endpoint: str, params: dict = None) -> list:
    """Call an FMP endpoint and return the list (or empty list)."""
    data = fmp_get(endpoint, params)
    if isinstance(data, list):
        return data
    return []
