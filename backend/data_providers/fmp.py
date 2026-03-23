"""FMP (Financial Modeling Prep) data provider implementation.

Wraps the existing fmp_client.py logic behind the DataProvider interface.
Existing code that imports fmp_client directly continues to work unchanged.
"""
import os
import time
import math
import threading
import requests

from data_providers.base import DataProvider


# ── Standalone helpers (mirror fmp_client.py for self-contained use) ──────────

FMP_BASE = "https://financialmodelingprep.com/stable"
_MIN_INTERVAL = 0.25
_last_call = 0.0
_rate_lock = threading.Lock()  # Thread-safe rate limiting


def _safe(val):
    if val is None:
        return None
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None


def _fmp_get(api_key: str, endpoint: str, params: dict | None = None, retries: int = 2):
    """Call an FMP endpoint with rate limiting and retries."""
    global _last_call
    params = params or {}
    params["apikey"] = api_key

    for attempt in range(retries + 1):
        # Thread-safe rate limit — sleep outside lock to avoid blocking other threads
        with _rate_lock:
            elapsed = time.time() - _last_call
            wait = max(0, _MIN_INTERVAL - elapsed)
            _last_call = time.time() + wait  # Reserve the slot
        if wait > 0:
            time.sleep(wait)

        try:
            r = requests.get(
                f"{FMP_BASE}/{endpoint}",
                params=params,
                headers={"User-Agent": "EquityValuation/1.0"},
                timeout=15,
            )
            if r.status_code == 429:
                wait = 60 * (attempt + 1)
                print(f"  [FMPProvider rate limited, waiting {wait}s]", flush=True)
                time.sleep(wait)
                continue
            if r.status_code != 200:
                print(f"  [FMPProvider {endpoint}] HTTP {r.status_code}")
                return None
            return r.json()
        except Exception as e:
            print(f"  [FMPProvider {endpoint}] {e}")
            if attempt < retries:
                time.sleep(2)
    return None


def _fmp_get_first(api_key: str, endpoint: str, params: dict | None = None):
    data = _fmp_get(api_key, endpoint, params)
    if isinstance(data, list) and data:
        return data[0]
    if isinstance(data, dict):
        return data
    return None


def _fmp_get_list(api_key: str, endpoint: str, params: dict | None = None):
    data = _fmp_get(api_key, endpoint, params)
    return data if isinstance(data, list) else []


# ── Provider class ────────────────────────────────────────────────────────────

class FMPProvider(DataProvider):
    """Financial Modeling Prep data provider."""

    def __init__(self, api_key: str | None = None):
        self._key = api_key or os.environ.get("FMP_KEY", "")
        if not self._key:
            raise ValueError("FMP_KEY is required for FMPProvider")

    def get_fundamentals(self, ticker: str) -> dict:
        profile = _fmp_get_first(self._key, "profile", {"symbol": ticker})
        if not profile:
            return {}
        ratios = _fmp_get_first(self._key, "ratios", {"symbol": ticker}) or {}
        return {
            "ticker": ticker,
            "name": profile.get("companyName", ticker),
            "sector": profile.get("sector"),
            "industry": profile.get("industry"),
            "market_cap": _safe(profile.get("mktCap")),
            "current_price": _safe(profile.get("price")),
            "pe_ratio": _safe(ratios.get("priceEarningsRatio")),
            "pb_ratio": _safe(ratios.get("priceToBookRatio")),
            "ps_ratio": _safe(ratios.get("priceToSalesRatio")),
            "roe": _safe(ratios.get("returnOnEquity")),
            "roa": _safe(ratios.get("returnOnAssets")),
            "revenue": _safe(profile.get("revenue")),
            "ebitda": _safe(profile.get("ebitda")),
            "net_income": _safe(profile.get("netIncome")),
            "eps": _safe(profile.get("eps")),
            "beta": _safe(profile.get("beta")),
            "dividend_yield": _safe(profile.get("lastDiv")),
            "debt_to_equity": _safe(ratios.get("debtEquityRatio")),
        }

    def get_financial_statements(self, ticker: str, period: str = "annual") -> list:
        p = "annual" if period == "annual" else "quarter"
        statements = []
        for stmt_type, endpoint in [
            ("income", "income-statement"),
            ("balance", "balance-sheet-statement"),
            ("cashflow", "cash-flow-statement"),
        ]:
            rows = _fmp_get_list(self._key, endpoint, {"symbol": ticker, "period": p, "limit": 10})
            for row in rows:
                row["statement_type"] = stmt_type
                row["ticker"] = ticker
                statements.append(row)
        return statements

    def get_key_metrics(self, ticker: str) -> list:
        return _fmp_get_list(self._key, "key-metrics", {"symbol": ticker, "limit": 20})

    def get_analyst_data(self, ticker: str) -> dict:
        consensus = _fmp_get_first(self._key, "analyst-estimates", {"symbol": ticker}) or {}
        grades = _fmp_get_list(self._key, "grade", {"symbol": ticker, "limit": 10})
        targets = _fmp_get_first(self._key, "price-target-consensus", {"symbol": ticker}) or {}
        return {
            "ticker": ticker,
            "ratings": consensus,
            "price_targets": targets,
            "recent_grades": grades,
        }

    def get_insider_trades(self, ticker: str) -> list:
        return _fmp_get_list(self._key, "insider-trading", {"symbol": ticker, "limit": 50})
