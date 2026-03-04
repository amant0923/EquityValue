
import numpy as np

SECTOR_EV_EBITDA = {
    "Technology": 27.0, "Information Technology": 27.0,
    "Healthcare": 17.0, "Health Care": 17.0,
    "Consumer Cyclical": 17.0, "Consumer Discretionary": 17.0,
    "Consumer Staples": 17.0, "Energy": 7.5, "Industrials": 16.5,
    "Materials": 14.0, "Real Estate": 21.0, "Utilities": 13.0,
    "Communication Services": 15.0, "default": 16.0,
}
SECTOR_EV_EBIT = {
    "Technology": 30.0, "Information Technology": 30.0,
    "Healthcare": 20.0, "Health Care": 20.0,
    "Consumer Cyclical": 19.0, "Consumer Discretionary": 19.0,
    "Consumer Staples": 19.0, "Energy": 9.0, "Industrials": 18.0,
    "Materials": 15.0, "Real Estate": 24.0, "Utilities": 15.0,
    "Communication Services": 17.0, "default": 18.0,
}
SECTOR_EV_SALES = {
    "Technology": 8.0, "Information Technology": 8.0,
    "Healthcare": 4.0, "Health Care": 4.0,
    "Consumer Cyclical": 1.8, "Consumer Discretionary": 1.8,
    "Consumer Staples": 1.2, "Energy": 1.5, "Industrials": 1.8,
    "Materials": 1.5, "Real Estate": 6.0, "Utilities": 3.0,
    "Communication Services": 3.5, "default": 2.5,
}
SECTOR_PE = {
    "Technology": 28, "Information Technology": 28,
    "Healthcare": 22, "Health Care": 22,
    "Consumer Cyclical": 18, "Consumer Discretionary": 18,
    "Consumer Staples": 17, "Financial Services": 13,
    "Energy": 12, "Industrials": 17, "Materials": 14,
    "Real Estate": 20, "Utilities": 17, "Communication Services": 18,
    "default": 18,
}
SECTOR_PS = {
    "Technology": 7.0, "Information Technology": 7.0,
    "Healthcare": 3.5, "Health Care": 3.5,
    "Consumer Cyclical": 1.5, "Consumer Discretionary": 1.5,
    "Consumer Staples": 1.0, "Energy": 1.2, "Industrials": 1.5,
    "Materials": 1.3, "Real Estate": 5.0, "Utilities": 2.5,
    "Communication Services": 3.0, "default": 2.0,
}
SECTOR_CAP_RATE = {
    "Technology": 0.06, "Information Technology": 0.06,
    "Healthcare": 0.07, "Health Care": 0.07,
    "Consumer Cyclical": 0.08, "Consumer Discretionary": 0.08,
    "Consumer Staples": 0.07, "Energy": 0.10, "Industrials": 0.08,
    "Materials": 0.09, "Real Estate": 0.065, "Utilities": 0.065,
    "Communication Services": 0.08, "default": 0.08,
}


def _safe(val, fallback=None):
    if val is None:
        return fallback
    try:
        f = float(val)
        return fallback if (np.isnan(f) or np.isinf(f)) else val
    except (TypeError, ValueError):
        return fallback

def _verdict(intrinsic, current):
    if intrinsic is None or current is None or current == 0:
        return "Insufficient Data"
    m = (intrinsic - current) / current
    if m > 0.15:  return "Undervalued"
    if m < -0.15: return "Overvalued"
    return "Fairly Valued"

def _pct(intrinsic, current):
    if not current: return 0
    return round((intrinsic - current) / current * 100, 1)


# ── 1. DCF ────────────────────────────────────────────────────────────────────
def dcf(data, growth_rate=None, wacc=None, terminal_growth=0.025, years=5):
    fcf    = _safe(data.get("free_cashflow"))
    shares = _safe(data.get("shares_outstanding"))
    price  = _safe(data.get("price"))
    if not fcf or not shares or fcf <= 0 or not price:
        return {"model": "DCF (Discounted Cash Flow)", "applicable": False,
                "reason": "Negative or missing Free Cash Flow",
                "description": "Projects future Free Cash Flows and discounts them back to present value using WACC.",
                "category": "Income-Based"}
    if growth_rate is None:
        raw = data.get("revenue_growth") or data.get("earnings_growth") or 0.06
        growth_rate = min(max(float(raw), 0.02), 0.20)
    if wacc is None:
        beta = float(data.get("beta") or 1.0)
        wacc = min(max(0.04 + beta * 0.05, 0.07), 0.15)
    debt = float(data.get("total_debt") or 0)
    cash = float(data.get("cash") or 0)
    proj = [fcf * (1 + growth_rate) ** i for i in range(1, years + 1)]
    disc = [cf / (1 + wacc) ** i for i, cf in enumerate(proj, 1)]
    tv   = proj[-1] * (1 + terminal_growth) / (wacc - terminal_growth)
    pv_tv = tv / (1 + wacc) ** years
    intrinsic = (sum(disc) + pv_tv - debt + cash) / shares
    return {
        "model": "DCF (Discounted Cash Flow)", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"FCF Growth Rate": f"{growth_rate:.1%}", "WACC": f"{wacc:.1%}",
                        "Terminal Growth": f"{terminal_growth:.1%}", "Projection Years": years},
        "description": "Projects future Free Cash Flows and discounts them back to present value using WACC.",
        "category": "Income-Based",
    }


# ── 2. Capitalization of Earnings ─────────────────────────────────────────────
def cap_earnings(data):
    eps    = _safe(data.get("eps"))
    sector = data.get("sector", "default")
    price  = _safe(data.get("price"))
    cap_rate = SECTOR_CAP_RATE.get(sector, SECTOR_CAP_RATE["default"])
    if not eps or eps <= 0 or not price:
        return {"model": "Capitalization of Earnings", "applicable": False,
                "reason": "Negative or missing EPS",
                "description": "Divides expected earnings by a capitalization rate — best for stable, mature companies.",
                "category": "Income-Based"}
    intrinsic = eps / cap_rate
    return {
        "model": "Capitalization of Earnings", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Trailing EPS": f"${round(eps,2)}", "Capitalization Rate": f"{cap_rate:.1%}"},
        "description": "Divides expected earnings by a capitalization rate — best for stable, mature companies.",
        "category": "Income-Based",
    }


# ── 3. DDM ────────────────────────────────────────────────────────────────────
def ddm(data, cost_of_equity=None, long_term_growth=0.04):
    div_yield = data.get("dividend_yield") or 0
    price     = _safe(data.get("price"))
    if div_yield <= 0 or not price:
        return {"model": "Gordon Growth Model (DDM)", "applicable": False,
                "reason": "Company does not pay dividends",
                "description": "Values a stock based on expected future dividends growing at a constant rate.",
                "category": "Income-Based"}
    if cost_of_equity is None:
        beta = float(data.get("beta") or 1.0)
        cost_of_equity = min(max(0.04 + beta * 0.05, 0.06), 0.14)
    if cost_of_equity <= long_term_growth:
        return {"model": "Gordon Growth Model (DDM)", "applicable": False,
                "reason": "Cost of equity must exceed long-term growth rate",
                "description": "Values a stock based on expected future dividends growing at a constant rate.",
                "category": "Income-Based"}
    annual_div = price * div_yield
    intrinsic  = (annual_div * (1 + long_term_growth)) / (cost_of_equity - long_term_growth)
    return {
        "model": "Gordon Growth Model (DDM)", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Annual Dividend": f"${round(annual_div,2)}",
                        "Cost of Equity": f"{cost_of_equity:.1%}", "Long-term Growth": f"{long_term_growth:.1%}"},
        "description": "Values a stock based on expected future dividends growing at a constant rate.",
        "category": "Income-Based",
    }


# ── 4. EV/EBITDA ──────────────────────────────────────────────────────────────
def ev_ebitda_comps(data):
    ebitda    = _safe(data.get("ebitda"))
    sector    = data.get("sector", "default")
    shares    = _safe(data.get("shares_outstanding"))
    debt      = float(data.get("total_debt") or 0)
    cash      = float(data.get("cash") or 0)
    price     = _safe(data.get("price"))
    benchmark = SECTOR_EV_EBITDA.get(sector, SECTOR_EV_EBITDA["default"])
    if not ebitda or ebitda <= 0 or not shares or not price:
        return {"model": "EV/EBITDA Comparables", "applicable": False,
                "reason": "Negative or missing EBITDA",
                "description": "Applies the sector median EV/EBITDA multiple to the company's EBITDA.",
                "category": "Market-Based"}
    intrinsic = (benchmark * ebitda - debt + cash) / shares
    return {
        "model": "EV/EBITDA Comparables", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Sector Median EV/EBITDA": benchmark, "Company EBITDA": f"${ebitda:,.0f}"},
        "description": "Applies the sector median EV/EBITDA multiple to the company's EBITDA.",
        "category": "Market-Based",
    }


# ── 5. EV/EBIT ────────────────────────────────────────────────────────────────
def ev_ebit_comps(data):
    ebitda    = _safe(data.get("ebitda"))
    revenue   = _safe(data.get("revenue"))
    sector    = data.get("sector", "default")
    shares    = _safe(data.get("shares_outstanding"))
    debt      = float(data.get("total_debt") or 0)
    cash      = float(data.get("cash") or 0)
    price     = _safe(data.get("price"))
    margin    = float(data.get("profit_margin") or 0)
    benchmark = SECTOR_EV_EBIT.get(sector, SECTOR_EV_EBIT["default"])
    # Approximate EBIT from EBITDA (use 85% of EBITDA as rough D&A proxy)
    ebit = ebitda * 0.85 if ebitda and ebitda > 0 else None
    if not ebit or ebit <= 0 or not shares or not price:
        return {"model": "EV/EBIT Comparables", "applicable": False,
                "reason": "Insufficient EBIT data",
                "description": "Applies the sector median EV/EBIT multiple — excludes D&A for better operational comparison.",
                "category": "Market-Based"}
    intrinsic = (benchmark * ebit - debt + cash) / shares
    return {
        "model": "EV/EBIT Comparables", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Sector Median EV/EBIT": benchmark, "Est. EBIT": f"${ebit:,.0f}"},
        "description": "Applies the sector median EV/EBIT multiple — excludes D&A for better operational comparison.",
        "category": "Market-Based",
    }


# ── 6. EV/Sales ───────────────────────────────────────────────────────────────
def ev_sales_comps(data):
    revenue   = _safe(data.get("revenue"))
    sector    = data.get("sector", "default")
    shares    = _safe(data.get("shares_outstanding"))
    debt      = float(data.get("total_debt") or 0)
    cash      = float(data.get("cash") or 0)
    price     = _safe(data.get("price"))
    benchmark = SECTOR_EV_SALES.get(sector, SECTOR_EV_SALES["default"])
    if not revenue or not shares or not price:
        return {"model": "EV/Sales Comparables", "applicable": False,
                "reason": "Missing revenue or shares data",
                "description": "Applies the sector median EV/Sales multiple — useful for high-growth or pre-profit companies.",
                "category": "Market-Based"}
    intrinsic = (benchmark * revenue - debt + cash) / shares
    return {
        "model": "EV/Sales Comparables", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Sector Median EV/Sales": benchmark, "Total Revenue": f"${revenue:,.0f}"},
        "description": "Applies the sector median EV/Sales multiple — useful for high-growth or pre-profit companies.",
        "category": "Market-Based",
    }


# ── 7. P/E ────────────────────────────────────────────────────────────────────
def pe_comps(data):
    eps       = _safe(data.get("eps"))
    sector    = data.get("sector", "default")
    price     = _safe(data.get("price"))
    median_pe = SECTOR_PE.get(sector, SECTOR_PE["default"])
    if not eps or eps <= 0 or not price:
        return {"model": "P/E Comparables", "applicable": False,
                "reason": "Negative or missing EPS",
                "description": "Applies the sector median P/E ratio to the company's trailing 12-month EPS.",
                "category": "Market-Based"}
    intrinsic = median_pe * eps
    return {
        "model": "P/E Comparables", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Sector Median P/E": median_pe, "Trailing EPS": f"${round(eps,2)}"},
        "description": "Applies the sector median P/E ratio to the company's trailing 12-month EPS.",
        "category": "Market-Based",
    }


# ── 8. P/S ────────────────────────────────────────────────────────────────────
def ps_comps(data):
    revenue   = _safe(data.get("revenue"))
    shares    = _safe(data.get("shares_outstanding"))
    sector    = data.get("sector", "default")
    price     = _safe(data.get("price"))
    median_ps = SECTOR_PS.get(sector, SECTOR_PS["default"])
    if not revenue or not shares or not price:
        return {"model": "P/S Comparables", "applicable": False,
                "reason": "Missing revenue or shares data",
                "description": "Applies the sector median Price/Sales multiple to revenue per share.",
                "category": "Market-Based"}
    intrinsic = median_ps * (revenue / shares)
    return {
        "model": "P/S Comparables", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Sector Median P/S": median_ps, "Revenue Per Share": f"${round(revenue/shares,2)}"},
        "description": "Applies the sector median Price/Sales multiple to revenue per share.",
        "category": "Market-Based",
    }


# ── 9. PEG Ratio ──────────────────────────────────────────────────────────────
def peg_model(data):
    eps    = _safe(data.get("eps"))
    price  = _safe(data.get("price"))
    growth = _safe(data.get("earnings_growth") or data.get("revenue_growth"))
    if not eps or eps <= 0 or not price or not growth or growth <= 0:
        return {"model": "PEG Ratio", "applicable": False,
                "reason": "Insufficient earnings or growth data",
                "description": "Relates P/E to earnings growth rate — a PEG of 1 suggests fair value.",
                "category": "Market-Based"}
    growth_pct = float(growth) * 100
    # Fair value PEG = 1, so intrinsic = EPS * growth_pct
    intrinsic = eps * min(growth_pct, 50)  # cap growth at 50% to avoid extremes
    pe_ratio  = price / eps
    peg       = pe_ratio / growth_pct if growth_pct else None
    return {
        "model": "PEG Ratio", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Trailing EPS": f"${round(eps,2)}", "Growth Rate": f"{growth:.1%}",
                        "Current P/E": round(pe_ratio, 1), "PEG Ratio": round(peg, 2) if peg else "N/A"},
        "description": "Relates P/E to earnings growth — a PEG of 1 indicates fair value relative to growth.",
        "category": "Market-Based",
    }


# ── 10. P/B ───────────────────────────────────────────────────────────────────
def pb_model(data):
    bvps  = _safe(data.get("book_value_per_share"))
    roe   = float(data.get("roe") or 0)
    price = _safe(data.get("price"))
    beta  = float(data.get("beta") or 1.0)
    coe   = min(max(0.04 + beta * 0.05, 0.06), 0.14)
    if not bvps or bvps <= 0 or not price:
        return {"model": "Price-to-Book (P/B)", "applicable": False,
                "reason": "Missing or negative book value",
                "description": "Calculates a justified P/B ratio from ROE vs cost of equity.",
                "category": "Asset-Based"}
    # Cap book value per share to avoid absurd results (e.g. BRK-B)
    if bvps > price * 50:
        return {"model": "Price-to-Book (P/B)", "applicable": False,
                "reason": "Book value per share is abnormally large — model not reliable for this stock",
                "description": "Calculates a justified P/B ratio from ROE vs cost of equity.",
                "category": "Asset-Based"}
    justified_pb = max(float(roe) / coe if coe > 0 else 1.0, 0.5)
    intrinsic    = justified_pb * bvps
    return {
        "model": "Price-to-Book (P/B)", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"ROE": f"{roe:.1%}", "Cost of Equity": f"{coe:.1%}",
                        "Justified P/B": round(justified_pb, 2), "Book Value/Share": f"${round(bvps,2)}"},
        "description": "Calculates a justified P/B ratio from ROE vs cost of equity — best for financial firms.",
        "category": "Asset-Based",
    }


# ── 11. Residual Income ───────────────────────────────────────────────────────
def residual_income(data):
    bvps  = _safe(data.get("book_value_per_share"))
    eps   = _safe(data.get("eps"))
    price = _safe(data.get("price"))
    beta  = float(data.get("beta") or 1.0)
    coe   = min(max(0.04 + beta * 0.05, 0.06), 0.14)
    if not bvps or bvps <= 0 or not eps or not price:
        return {"model": "Residual Income", "applicable": False,
                "reason": "Missing book value or EPS data",
                "description": "Values a stock as book value plus the present value of excess returns above cost of equity.",
                "category": "Income-Based"}
    if bvps > price * 50:
        return {"model": "Residual Income", "applicable": False,
                "reason": "Book value per share is abnormally large",
                "description": "Values a stock as book value plus the present value of excess returns above cost of equity.",
                "category": "Income-Based"}
    ri = eps - (coe * bvps)
    # Simple perpetuity of residual income
    intrinsic = bvps + (ri / coe) if coe > 0 else bvps
    return {
        "model": "Residual Income", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Book Value/Share": f"${round(bvps,2)}", "EPS": f"${round(eps,2)}",
                        "Cost of Equity": f"{coe:.1%}", "Residual Income/Share": f"${round(ri,2)}"},
        "description": "Values a stock as book value plus the present value of excess returns above cost of equity.",
        "category": "Income-Based",
    }
