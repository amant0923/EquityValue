
import numpy as np


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


def _get_sector_mult(sector, sector_multiples, key):
    """Get a specific multiple for a sector from the dynamic multiples dict."""
    if sector_multiples:
        sm = sector_multiples.get(sector, sector_multiples.get("default", {}))
        val = sm.get(key)
        if val:
            return val
    from valuation.sector_multiples import HARDCODED_FALLBACK
    return HARDCODED_FALLBACK.get(sector, HARDCODED_FALLBACK["default"]).get(key)


# ── 1. DCF ──────────────────────────────────────────────────────────
def dcf(data, growth_rate=None, wacc=None, terminal_growth=None, years=5, risk_free_rate=None):
    fcf    = _safe(data.get("free_cashflow"))
    shares = _safe(data.get("shares_outstanding"))
    price  = _safe(data.get("price"))
    if not fcf or not shares or fcf <= 0 or not price:
        return {"model": "DCF (Discounted Cash Flow)", "applicable": False,
                "reason": "Negative or missing Free Cash Flow",
                "description": "Projects future Free Cash Flows and discounts them back to present value using WACC.",
                "category": "Income-Based"}
    if risk_free_rate is None:
        risk_free_rate = 0.043
    if wacc is None:
        beta = float(data.get("beta") or 1.0)
        equity_risk_premium = 0.055
        cost_of_equity = risk_free_rate + beta * equity_risk_premium
        debt = float(data.get("total_debt") or 0)
        mcap = float(data.get("market_cap") or 0)
        interest = float(data.get("interest_expense") or 0)
        if mcap > 0 and debt > 0:
            cost_of_debt = (interest / debt) if interest > 0 else risk_free_rate + 0.02
            tax_rate = 0.21
            total_capital = mcap + debt
            wacc = (mcap / total_capital) * cost_of_equity + (debt / total_capital) * cost_of_debt * (1 - tax_rate)
        else:
            wacc = cost_of_equity
        wacc = min(max(wacc, 0.06), 0.16)
    if growth_rate is None:
        roa = float(data.get("roa") or 0)
        payout = float(data.get("payout_ratio") or 0.3)
        retention = max(1.0 - payout, 0.3)
        sustainable = roa * retention if roa > 0 else 0
        rev_growth = float(data.get("revenue_growth") or 0)
        growth_rate = max(min(sustainable, rev_growth, 0.20), 0.02) if sustainable > 0 else min(max(rev_growth, 0.02), 0.20)
    if terminal_growth is None:
        terminal_growth = min(0.025, wacc - 0.015)
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


# ── 2. Capitalization of Earnings ───────────────────────────────────
def cap_earnings(data, sector_multiples=None):
    eps    = _safe(data.get("eps"))
    sector = data.get("sector", "default")
    price  = _safe(data.get("price"))
    cap_rate = _get_sector_mult(sector, sector_multiples, "cap_rate")
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


# ── 3. DDM ──────────────────────────────────────────────────────────
def ddm(data, cost_of_equity=None, long_term_growth=0.04, risk_free_rate=None):
    div_yield = data.get("dividend_yield") or 0
    price     = _safe(data.get("price"))
    if div_yield <= 0 or not price:
        return {"model": "Gordon Growth Model (DDM)", "applicable": False,
                "reason": "Company does not pay dividends",
                "description": "Values a stock based on expected future dividends growing at a constant rate.",
                "category": "Income-Based"}
    if cost_of_equity is None:
        if risk_free_rate is None:
            risk_free_rate = 0.043
        beta = float(data.get("beta") or 1.0)
        cost_of_equity = min(max(risk_free_rate + beta * 0.055, 0.06), 0.14)
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


# ── 4. EV/EBITDA ────────────────────────────────────────────────────
def ev_ebitda_comps(data, sector_multiples=None):
    ebitda    = _safe(data.get("ebitda"))
    sector    = data.get("sector", "default")
    shares    = _safe(data.get("shares_outstanding"))
    debt      = float(data.get("total_debt") or 0)
    cash      = float(data.get("cash") or 0)
    price     = _safe(data.get("price"))
    benchmark = _get_sector_mult(sector, sector_multiples, "ev_ebitda")
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


# ── 5. EV/EBIT (fixed: use operating_income first) ─────────────────
def ev_ebit_comps(data, sector_multiples=None):
    sector    = data.get("sector", "default")
    shares    = _safe(data.get("shares_outstanding"))
    debt      = float(data.get("total_debt") or 0)
    cash      = float(data.get("cash") or 0)
    price     = _safe(data.get("price"))
    benchmark = _get_sector_mult(sector, sector_multiples, "ev_ebit")
    # Priority: operating_income → ebitda - D&A → ebitda * 0.85
    ebit = _safe(data.get("operating_income"))
    if not ebit or ebit <= 0:
        ebitda = _safe(data.get("ebitda"))
        da = _safe(data.get("depreciation_amortization"))
        if ebitda and ebitda > 0 and da:
            ebit = ebitda - da
        elif ebitda and ebitda > 0:
            ebit = ebitda * 0.85
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


# ── 6. EV/Sales ─────────────────────────────────────────────────────
def ev_sales_comps(data, sector_multiples=None):
    revenue   = _safe(data.get("revenue"))
    sector    = data.get("sector", "default")
    shares    = _safe(data.get("shares_outstanding"))
    debt      = float(data.get("total_debt") or 0)
    cash      = float(data.get("cash") or 0)
    price     = _safe(data.get("price"))
    benchmark = _get_sector_mult(sector, sector_multiples, "ev_sales")
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


# ── 7. P/E (now display-only, excluded from consensus) ──────────────
def pe_comps(data, sector_multiples=None):
    eps       = _safe(data.get("eps"))
    sector    = data.get("sector", "default")
    price     = _safe(data.get("price"))
    median_pe = _get_sector_mult(sector, sector_multiples, "pe")
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


# ── 8. P/S ──────────────────────────────────────────────────────────
def ps_comps(data, sector_multiples=None):
    revenue   = _safe(data.get("revenue"))
    shares    = _safe(data.get("shares_outstanding"))
    sector    = data.get("sector", "default")
    price     = _safe(data.get("price"))
    median_ps = _get_sector_mult(sector, sector_multiples, "ps")
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


# ── 9. PEG Ratio (fixed: sector-relative formula) ──────────────────
def peg_model(data, sector_multiples=None):
    eps    = _safe(data.get("eps"))
    price  = _safe(data.get("price"))
    growth = _safe(data.get("earnings_growth") or data.get("revenue_growth"))
    sector = data.get("sector", "default")
    if not eps or eps <= 0 or not price or not growth or growth <= 0:
        return {"model": "PEG Ratio", "applicable": False,
                "reason": "Insufficient earnings or growth data",
                "description": "Relates P/E to earnings growth rate — a PEG of 1 suggests fair value.",
                "category": "Market-Based"}
    sector_pe = _get_sector_mult(sector, sector_multiples, "pe")
    sector_growth = _get_sector_mult(sector, sector_multiples, "median_growth")
    growth_ratio = min(float(growth) / sector_growth, 3.0) if sector_growth > 0 else 1.0
    fair_pe = sector_pe * growth_ratio
    fair_pe = min(max(fair_pe, 5), 60)
    intrinsic = fair_pe * eps
    pe_ratio  = price / eps
    growth_pct = float(growth) * 100
    peg = pe_ratio / growth_pct if growth_pct else None
    return {
        "model": "PEG Ratio", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Trailing EPS": f"${round(eps,2)}", "Growth Rate": f"{growth:.1%}",
                        "Sector Median P/E": sector_pe, "Fair P/E": round(fair_pe, 1),
                        "PEG Ratio": round(peg, 2) if peg else "N/A"},
        "description": "Relates P/E to earnings growth — sector-relative fair P/E adjusted by growth differential.",
        "category": "Market-Based",
    }


# ── 10. P/B (fixed: uses 3yr smoothed ROE, live risk-free rate) ────
def pb_model(data, sector_multiples=None, risk_free_rate=None):
    bvps  = _safe(data.get("book_value_per_share"))
    roe   = float(data.get("roe_3yr_avg") or data.get("roe") or 0)
    price = _safe(data.get("price"))
    beta  = float(data.get("beta") or 1.0)
    if risk_free_rate is None:
        risk_free_rate = 0.043
    coe   = min(max(risk_free_rate + beta * 0.055, 0.06), 0.14)
    if not bvps or bvps <= 0 or not price:
        return {"model": "Price-to-Book (P/B)", "applicable": False,
                "reason": "Missing or negative book value",
                "description": "Calculates a justified P/B ratio from ROE vs cost of equity.",
                "category": "Asset-Based"}
    if bvps > price * 50:
        return {"model": "Price-to-Book (P/B)", "applicable": False,
                "reason": "Book value per share is abnormally large — model not reliable for this stock",
                "description": "Calculates a justified P/B ratio from ROE vs cost of equity.",
                "category": "Asset-Based"}
    justified_pb = max(float(roe) / coe if coe > 0 else 1.0, 0.5)
    intrinsic    = justified_pb * bvps
    roe_source = "3yr avg" if data.get("roe_3yr_avg") else "trailing"
    return {
        "model": "Price-to-Book (P/B)", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"ROE": f"{roe:.1%} ({roe_source})", "Cost of Equity": f"{coe:.1%}",
                        "Justified P/B": round(justified_pb, 2), "Book Value/Share": f"${round(bvps,2)}"},
        "description": "Calculates a justified P/B ratio from ROE vs cost of equity — best for financial firms.",
        "category": "Asset-Based",
    }


# ── 11. Residual Income (fixed: uses 3yr smoothed EPS, live risk-free rate) ─
def residual_income(data, risk_free_rate=None):
    bvps  = _safe(data.get("book_value_per_share"))
    eps   = _safe(data.get("eps_3yr_avg") or data.get("eps"))
    price = _safe(data.get("price"))
    beta  = float(data.get("beta") or 1.0)
    if risk_free_rate is None:
        risk_free_rate = 0.043
    coe   = min(max(risk_free_rate + beta * 0.055, 0.06), 0.14)
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
    intrinsic = bvps + (ri / coe) if coe > 0 else bvps
    eps_source = "3yr avg" if data.get("eps_3yr_avg") else "trailing"
    return {
        "model": "Residual Income", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Book Value/Share": f"${round(bvps,2)}", "EPS": f"${round(eps,2)} ({eps_source})",
                        "Cost of Equity": f"{coe:.1%}", "Residual Income/Share": f"${round(ri,2)}"},
        "description": "Values a stock as book value plus the present value of excess returns above cost of equity.",
        "category": "Income-Based",
    }


# ── 12. FCF Yield (NEW — Yartseva: strongest predictor, weight 2.0x) ─
def fcf_yield_model(data, sector_multiples=None):
    fcf    = _safe(data.get("free_cashflow"))
    shares = _safe(data.get("shares_outstanding"))
    price  = _safe(data.get("price"))
    sector = data.get("sector", "default")
    if not fcf or fcf <= 0 or not shares or not price:
        return {"model": "FCF Yield", "applicable": False,
                "reason": "Negative or missing Free Cash Flow",
                "description": "Values a stock by comparing its FCF yield to the sector median — the strongest predictor of returns (Yartseva 2025).",
                "category": "Income-Based"}
    sector_fcf_yield = _get_sector_mult(sector, sector_multiples, "fcf_yield")
    fair_mcap = fcf / sector_fcf_yield
    intrinsic = fair_mcap / shares
    company_yield = fcf / (price * shares)
    return {
        "model": "FCF Yield", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"FCF": f"${fcf:,.0f}", "Company FCF Yield": f"{company_yield:.2%}",
                        "Sector Median FCF Yield": f"{sector_fcf_yield:.2%}"},
        "description": "Values a stock by comparing its FCF yield to the sector median — the strongest predictor of returns (Yartseva 2025).",
        "category": "Income-Based",
    }
