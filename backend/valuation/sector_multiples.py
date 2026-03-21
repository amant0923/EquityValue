"""Dynamic sector multiples from Supabase + live Treasury yield from FMP.

Both are cached for 24 hours. Falls back to hardcoded values on failure.
"""
import time
import statistics
from supabase import create_client

# Lazy-import fmp_get_first so missing FMP_KEY doesn't crash at import time.
# Tests patch this name in this module's namespace.
try:
    from fmp_client import fmp_get_first
except SystemExit:
    fmp_get_first = None  # type: ignore[assignment]

# ── Supabase client (reuse service key pattern from portfolio.py) ──────
from config import SUPABASE_URL as _SUPABASE_URL, SUPABASE_KEY as _SUPABASE_KEY, SUPABASE_SERVICE_KEY as _SUPABASE_SERVICE_KEY
_sb = create_client(_SUPABASE_URL, _SUPABASE_SERVICE_KEY or _SUPABASE_KEY)

# ── Cache TTL (24 hours) ───────────────────────────────────────────────
_CACHE_TTL = 86400
_multiples_cache = {"data": None, "ts": 0}
_rfr_cache = {"data": None, "ts": 0}

# ── Hardcoded fallback ─────────────────────────────────────────────────
HARDCODED_FALLBACK = {
    "Technology": {"ev_ebitda": 27.0, "ev_ebit": 30.0, "ev_sales": 8.0, "pe": 28, "ps": 7.0, "pb": 8.0, "fcf_yield": 0.030, "cap_rate": 0.06, "median_growth": 0.10},
    "Information Technology": {"ev_ebitda": 27.0, "ev_ebit": 30.0, "ev_sales": 8.0, "pe": 28, "ps": 7.0, "pb": 8.0, "fcf_yield": 0.030, "cap_rate": 0.06, "median_growth": 0.10},
    "Healthcare": {"ev_ebitda": 17.0, "ev_ebit": 20.0, "ev_sales": 4.0, "pe": 22, "ps": 3.5, "pb": 4.0, "fcf_yield": 0.040, "cap_rate": 0.07, "median_growth": 0.08},
    "Health Care": {"ev_ebitda": 17.0, "ev_ebit": 20.0, "ev_sales": 4.0, "pe": 22, "ps": 3.5, "pb": 4.0, "fcf_yield": 0.040, "cap_rate": 0.07, "median_growth": 0.08},
    "Consumer Discretionary": {"ev_ebitda": 17.0, "ev_ebit": 19.0, "ev_sales": 1.8, "pe": 18, "ps": 1.5, "pb": 3.5, "fcf_yield": 0.045, "cap_rate": 0.08, "median_growth": 0.07},
    "Consumer Cyclical": {"ev_ebitda": 17.0, "ev_ebit": 19.0, "ev_sales": 1.8, "pe": 18, "ps": 1.5, "pb": 3.5, "fcf_yield": 0.045, "cap_rate": 0.08, "median_growth": 0.07},
    "Consumer Staples": {"ev_ebitda": 17.0, "ev_ebit": 19.0, "ev_sales": 1.2, "pe": 17, "ps": 1.0, "pb": 5.0, "fcf_yield": 0.040, "cap_rate": 0.07, "median_growth": 0.04},
    "Energy": {"ev_ebitda": 7.5, "ev_ebit": 9.0, "ev_sales": 1.5, "pe": 12, "ps": 1.2, "pb": 1.8, "fcf_yield": 0.080, "cap_rate": 0.10, "median_growth": 0.03},
    "Industrials": {"ev_ebitda": 16.5, "ev_ebit": 18.0, "ev_sales": 1.8, "pe": 17, "ps": 1.5, "pb": 4.0, "fcf_yield": 0.045, "cap_rate": 0.08, "median_growth": 0.06},
    "Materials": {"ev_ebitda": 14.0, "ev_ebit": 15.0, "ev_sales": 1.5, "pe": 14, "ps": 1.3, "pb": 2.5, "fcf_yield": 0.050, "cap_rate": 0.09, "median_growth": 0.04},
    "Real Estate": {"ev_ebitda": 21.0, "ev_ebit": 24.0, "ev_sales": 6.0, "pe": 20, "ps": 5.0, "pb": 2.0, "fcf_yield": 0.050, "cap_rate": 0.065, "median_growth": 0.04},
    "Utilities": {"ev_ebitda": 13.0, "ev_ebit": 15.0, "ev_sales": 3.0, "pe": 17, "ps": 2.5, "pb": 2.0, "fcf_yield": 0.055, "cap_rate": 0.065, "median_growth": 0.03},
    "Communication Services": {"ev_ebitda": 15.0, "ev_ebit": 17.0, "ev_sales": 3.5, "pe": 18, "ps": 3.0, "pb": 3.0, "fcf_yield": 0.045, "cap_rate": 0.08, "median_growth": 0.06},
    "Financial Services": {"ev_ebitda": 12.0, "ev_ebit": 14.0, "ev_sales": 3.0, "pe": 13, "ps": 2.5, "pb": 1.5, "fcf_yield": 0.060, "cap_rate": 0.08, "median_growth": 0.05},
    "Financials": {"ev_ebitda": 12.0, "ev_ebit": 14.0, "ev_sales": 3.0, "pe": 13, "ps": 2.5, "pb": 1.5, "fcf_yield": 0.060, "cap_rate": 0.08, "median_growth": 0.05},
    "default": {"ev_ebitda": 16.0, "ev_ebit": 18.0, "ev_sales": 2.5, "pe": 18, "ps": 2.0, "pb": 3.0, "fcf_yield": 0.045, "cap_rate": 0.08, "median_growth": 0.06},
}

# ── Industry-level overrides ─────────────────────────────────────────
# These override sector medians for industries where the sector-level
# multiple is wildly inappropriate (e.g. Healthcare MCOs at 0.2x P/S
# vs Healthcare pharma at 5x P/S).  Keys are substrings matched
# case-insensitively against the company's `industry` field.
INDUSTRY_OVERRIDES = {
    # Healthcare managed care / insurance — massive revenue, razor-thin margins
    "healthcare plans":             {"ps": 0.35, "ev_sales": 0.40, "pe": 15, "ev_ebitda": 10, "ev_ebit": 12, "fcf_yield": 0.065},
    "managed health care":          {"ps": 0.35, "ev_sales": 0.40, "pe": 15, "ev_ebitda": 10, "ev_ebit": 12, "fcf_yield": 0.065},
    # Healthcare distribution / pharmacy — high revenue, ~1-2% margins
    "health care distributors":     {"ps": 0.20, "ev_sales": 0.25, "pe": 14, "ev_ebitda": 10, "ev_ebit": 12, "fcf_yield": 0.060},
    "medical distribution":         {"ps": 0.20, "ev_sales": 0.25, "pe": 14, "ev_ebitda": 10, "ev_ebit": 12, "fcf_yield": 0.060},
    "pharmaceutical retailers":     {"ps": 0.10, "ev_sales": 0.15, "pe": 10, "ev_ebitda": 6,  "ev_ebit": 8,  "fcf_yield": 0.070},
    # WBA/CVS-style: classified as "Medical - Pharmaceuticals" but really retail pharmacy
    "medical pharmaceuticals":      {"ps": 0.10, "ev_sales": 0.15, "pe": 10, "ev_ebitda": 6,  "ev_ebit": 8,  "fcf_yield": 0.070},
    "drug manufacturers":           {"ps": 4.5,  "ev_sales": 4.5},
    "biotechnology":                {"ps": 5.0,  "ev_sales": 5.5},
    # Auto manufacturers — massive captive finance debt
    "auto manufacturers":           {"ev_ebitda": 6, "ev_ebit": 8, "ev_sales": 0.4, "ps": 0.4, "pe": 8},
    # Financial — insurance vs banks vs asset management
    "insurance diversified":        {"pb": 2.0, "pe": 12, "ev_ebitda": 8, "fcf_yield": 0.070},
    "insurance property":           {"pb": 2.0, "pe": 12, "ev_ebitda": 8, "fcf_yield": 0.070},
    "insurance life":               {"pb": 1.2, "pe": 10, "ev_ebitda": 7, "fcf_yield": 0.075},
    "insurance reinsurance":        {"pb": 2.0, "pe": 14, "ev_ebitda": 8, "fcf_yield": 0.065},
    "insurance brokers":            {"pb": 6.0, "pe": 25, "ev_ebitda": 16, "fcf_yield": 0.035},
    "asset management":             {"pb": 4.0, "pe": 18, "ev_ebitda": 12, "fcf_yield": 0.050},
    "financial credit services":    {"pb": 2.5, "pe": 10, "ev_ebitda": 7, "fcf_yield": 0.080},
    # Grocery / food distribution — low-margin, high-revenue
    "grocery stores":               {"ps": 0.30, "ev_sales": 0.35},
    "food distribution":            {"ps": 0.15, "ev_sales": 0.20},
    "discount stores":              {"ps": 0.8,  "ev_sales": 0.9},
    # Communication / cable — stable cash flow, moderate multiples
    "telecommunications services":  {"ps": 1.5,  "ev_sales": 2.0, "ev_ebitda": 7, "ev_ebit": 9},
    # Utilities — capital intensive, lower multiples
    "regulated electric":           {"ev_ebitda": 10, "ev_ebit": 12, "ps": 2.0, "ev_sales": 3.0},
    "utilities regulated":          {"ev_ebitda": 10, "ev_ebit": 12, "ps": 2.0, "ev_sales": 3.0},
    # Hardware / communication equipment — lower than software
    "communication equipment":      {"ps": 1.5, "ev_sales": 1.8, "pe": 14, "ev_ebitda": 10, "ev_ebit": 12, "fcf_yield": 0.055},
    # Healthcare facilities — not pharma/biotech margins
    "medical care facilities":      {"ps": 0.8, "ev_sales": 1.0, "ev_ebitda": 10, "ev_ebit": 12},
    "hospitals":                    {"ps": 0.8, "ev_sales": 1.0, "ev_ebitda": 10, "ev_ebit": 12},
    # Airlines — cyclical, low-margin
    "airlines":                     {"ps": 0.5, "ev_sales": 0.6, "ev_ebitda": 5, "ev_ebit": 7, "pe": 8},
    # Oil & gas — cyclical, moderate multiples
    "oil gas exploration":          {"ev_ebitda": 5, "ev_ebit": 7, "ps": 1.5, "ev_sales": 2.0, "fcf_yield": 0.090, "pe": 10},
    "oil gas integrated":           {"ev_ebitda": 5, "ev_ebit": 7, "ps": 1.0, "ev_sales": 1.5, "fcf_yield": 0.085, "pe": 10},
    # REITs — see updated entries below with fcf_yield
    # Packaging — low margin
    "packaging containers":         {"ps": 1.0, "ev_sales": 1.5, "ev_ebitda": 9, "ev_ebit": 11},
    # Specialty retail — moderate
    "specialty retail":             {"ps": 1.2, "ev_sales": 1.5, "pe": 14, "fcf_yield": 0.055},
    # Chemicals — cyclical, moderate multiples
    "chemicals":                    {"ev_ebitda": 10, "ev_ebit": 12, "ps": 1.5, "ev_sales": 2.0, "pe": 14, "fcf_yield": 0.055},
    "specialty chemicals":          {"ev_ebitda": 12, "ev_ebit": 14, "ps": 2.0, "ev_sales": 2.5, "pe": 16, "fcf_yield": 0.045},
    # Agricultural — highly cyclical, low multiples
    "agricultural inputs":          {"ev_ebitda": 8, "ev_ebit": 10, "ps": 1.0, "ev_sales": 1.5, "pe": 12, "fcf_yield": 0.065},
    "farm products":                {"ev_ebitda": 8, "ev_ebit": 10, "ps": 0.4, "ev_sales": 0.5, "pe": 11, "fcf_yield": 0.070},
    "agricultural farm products":   {"ev_ebitda": 8, "ev_ebit": 10, "ps": 0.4, "ev_sales": 0.5, "pe": 11, "fcf_yield": 0.070},
    # Packaged foods — stable but low growth
    "packaged foods":               {"ev_ebitda": 12, "ev_ebit": 14, "ps": 1.5, "ev_sales": 2.0, "pe": 15, "fcf_yield": 0.050},
    # Beverages — moderate
    "beverages alcoholic":          {"ev_ebitda": 10, "ev_ebit": 12, "ps": 2.0, "ev_sales": 2.5, "pe": 14, "fcf_yield": 0.050},
    "beverages brewers":            {"ev_ebitda": 10, "ev_ebit": 12, "ps": 2.0, "ev_sales": 2.5, "pe": 14, "fcf_yield": 0.050},
    # Gambling / resorts — leveraged, moderate growth
    "gambling":                     {"ev_ebitda": 9, "ev_ebit": 11, "ps": 1.5, "ev_sales": 2.0, "pe": 15, "fcf_yield": 0.055},
    "resorts casinos":              {"ev_ebitda": 9, "ev_ebit": 11, "ps": 1.5, "ev_sales": 2.0, "pe": 15, "fcf_yield": 0.055},
    # Freight & logistics — moderate
    "freight logistics":            {"ev_ebitda": 10, "ev_ebit": 12, "ps": 0.8, "ev_sales": 1.0, "pe": 14, "fcf_yield": 0.055},
    "integrated freight":           {"ev_ebitda": 10, "ev_ebit": 12, "ps": 0.8, "ev_sales": 1.0, "pe": 14, "fcf_yield": 0.055},
    # Medical devices — higher than hospitals, lower than pharma
    "medical devices":              {"ev_ebitda": 18, "ev_ebit": 20, "ps": 5.0, "ev_sales": 5.5, "pe": 25, "fcf_yield": 0.035},
    "medical instruments":          {"ev_ebitda": 18, "ev_ebit": 20, "ps": 5.0, "ev_sales": 5.5, "pe": 25, "fcf_yield": 0.035},
    # Computer hardware — add missing fcf_yield
    "computer hardware":            {"ps": 1.5, "ev_sales": 1.8, "pe": 14, "ev_ebitda": 10, "ev_ebit": 12, "fcf_yield": 0.055},
    # REIT — add fcf_yield
    "reit office":                  {"ev_ebitda": 14, "ps": 4.0, "ev_sales": 5.0, "fcf_yield": 0.065},
    "reit residential":             {"ev_ebitda": 20, "ps": 8.0, "ev_sales": 9.0, "fcf_yield": 0.045},
    "reit industrial":              {"ev_ebitda": 22, "ps": 10.0, "ev_sales": 11.0, "fcf_yield": 0.040},
}


def _normalize_industry(industry):
    """Normalize industry string: lowercase, remove hyphens/ampersands/extra spaces."""
    return industry.lower().replace(" - ", " ").replace("-", " ").replace(" & ", " ").replace("&", " ").strip()


def get_industry_override(industry, key):
    """Return an industry-level override for a specific multiple, or None."""
    if not industry:
        return None
    norm = _normalize_industry(industry)
    for pattern, overrides in INDUSTRY_OVERRIDES.items():
        # Match if either string contains the other (after normalization)
        if pattern in norm or norm in pattern:
            return overrides.get(key)
    return None


def _safe_median(values):
    """Compute median of non-None, positive values. Returns None if empty."""
    clean = [float(v) for v in values if v is not None and float(v) > 0]
    return statistics.median(clean) if len(clean) >= 3 else None


def _compute_sector_multiples(rows):
    """Given list of stock dicts, compute per-sector median multiples."""
    from collections import defaultdict
    buckets = defaultdict(list)
    for r in rows:
        sector = r.get("sector")
        if sector:
            buckets[sector].append(r)

    result = {}
    all_pe, all_ev_ebitda, all_ps, all_pb, all_fcf_y, all_growth = [], [], [], [], [], []

    for sector, stocks in buckets.items():
        pe_vals = [s["pe_ratio"] for s in stocks]
        ev_ebitda_vals = [s["ev_to_ebitda"] for s in stocks]
        ps_vals = [s.get("ps_ratio") for s in stocks]
        pb_vals = [s.get("pb_ratio") for s in stocks]
        fcf_yields = []
        for s in stocks:
            fcf = s.get("free_cashflow")
            mc = s.get("market_cap")
            if fcf and mc and mc > 0:
                fcf_yields.append(fcf / mc)
        growth_vals = [s.get("revenue_growth") for s in stocks]

        fb = HARDCODED_FALLBACK.get(sector, HARDCODED_FALLBACK["default"])
        result[sector] = {
            "ev_ebitda": _safe_median(ev_ebitda_vals) or fb["ev_ebitda"],
            "ev_ebit": (_safe_median(ev_ebitda_vals) or fb["ev_ebitda"]) * 1.1,
            "ev_sales": _safe_median([s.get("ev_to_revenue") or s.get("ps_ratio") for s in stocks]) or fb["ev_sales"],
            "pe": _safe_median(pe_vals) or fb["pe"],
            "ps": _safe_median(ps_vals) or fb["ps"],
            "pb": _safe_median(pb_vals) or fb["pb"],
            "fcf_yield": _safe_median(fcf_yields) or fb["fcf_yield"],
            "cap_rate": fb["cap_rate"],
            "median_growth": _safe_median(growth_vals) or fb["median_growth"],
        }

        all_pe.extend(pe_vals)
        all_ev_ebitda.extend(ev_ebitda_vals)
        all_ps.extend(ps_vals)
        all_pb.extend(pb_vals)
        all_fcf_y.extend(fcf_yields)
        all_growth.extend(growth_vals)

    fb = HARDCODED_FALLBACK["default"]
    result["default"] = {
        "ev_ebitda": _safe_median(all_ev_ebitda) or fb["ev_ebitda"],
        "ev_ebit": (_safe_median(all_ev_ebitda) or fb["ev_ebitda"]) * 1.1,
        "ev_sales": fb["ev_sales"],
        "pe": _safe_median(all_pe) or fb["pe"],
        "ps": _safe_median(all_ps) or fb["ps"],
        "pb": _safe_median(all_pb) or fb["pb"],
        "fcf_yield": _safe_median(all_fcf_y) or fb["fcf_yield"],
        "cap_rate": fb["cap_rate"],
        "median_growth": _safe_median(all_growth) or fb["median_growth"],
    }
    return result


def get_sector_multiples():
    """Return sector multiples dict, cached 24hrs. Falls back to hardcoded."""
    now = time.time()
    if _multiples_cache["data"] and (now - _multiples_cache["ts"]) < _CACHE_TTL:
        return _multiples_cache["data"]
    try:
        resp = _sb.table("stock_fundamentals").select(
            "sector, pe_ratio, ev_to_ebitda, ps_ratio, pb_ratio, "
            "free_cashflow, market_cap, revenue_growth, ev_to_revenue"
        ).not_.is_("sector", "null").not_.is_("pe_ratio", "null").execute()
        rows = resp.data or []
        if len(rows) >= 50:
            result = _compute_sector_multiples(rows)
            _multiples_cache["data"] = result
            _multiples_cache["ts"] = now
            return result
    except Exception:
        pass
    _multiples_cache["data"] = HARDCODED_FALLBACK
    _multiples_cache["ts"] = now
    return HARDCODED_FALLBACK


def get_risk_free_rate():
    """Fetch US 10Y Treasury yield from FMP, cached 24hrs. Fallback 4.3%."""
    now = time.time()
    if _rfr_cache["data"] is not None and (now - _rfr_cache["ts"]) < _CACHE_TTL:
        return _rfr_cache["data"]
    try:
        if fmp_get_first is None:
            raise ValueError("FMP client not available")
        data = fmp_get_first("treasury-rates", {"limit": 1})
        if data and "year10" in data:
            rate = float(data["year10"]) / 100.0
            if 0.005 <= rate <= 0.15:
                _rfr_cache["data"] = rate
                _rfr_cache["ts"] = now
                return rate
    except Exception:
        pass
    _rfr_cache["data"] = 0.043
    _rfr_cache["ts"] = now
    return 0.043


def get_sector(sector, multiples=None):
    """Get multiples for a sector, with fallback to default."""
    if multiples is None:
        multiples = get_sector_multiples()
    return multiples.get(sector, multiples.get("default", HARDCODED_FALLBACK["default"]))
