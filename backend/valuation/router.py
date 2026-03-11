from classifier import classify_company, COMPANY_TYPE_LABELS
from valuation.models import (
    dcf, ddm, cap_earnings,
    ev_ebitda_comps, ev_ebit_comps, ev_sales_comps,
    pe_comps, ps_comps, peg_model,
    pb_model, residual_income, fcf_yield_model,
)
from valuation.sector_multiples import get_sector_multiples, get_risk_free_rate, HARDCODED_FALLBACK
import math

MODEL_MAP = {
    "dividend":                 [ddm, dcf, cap_earnings, ev_ebitda_comps, pe_comps, ps_comps, fcf_yield_model],
    "profitable_growth":        [dcf, ev_ebitda_comps, ev_ebit_comps, pe_comps, ps_comps, peg_model, fcf_yield_model],
    "high_growth_unprofitable": [ev_sales_comps, ps_comps, ev_ebitda_comps, peg_model],
    "cyclical":                 [dcf, ev_ebitda_comps, ev_ebit_comps, pe_comps, cap_earnings, fcf_yield_model],
    "financial":                [pb_model, pe_comps, ddm, residual_income, fcf_yield_model],
}

# Models excluded from consensus (display only)
OUTLIER_MODELS = {"Graham Number", "Gordon Growth Model (DDM)", "Residual Income",
                  "Capitalization of Earnings", "P/E Comparables"}

# Empirical weights for consensus (Yartseva 2025 + Delao et al. 2024)
MODEL_WEIGHTS = {
    "FCF Yield": 2.0,
    "EV/EBITDA Comparables": 1.5,
    "DCF (Discounted Cash Flow)": 1.5,
    "Price-to-Book (P/B)": 1.3,
    "EV/EBIT Comparables": 1.0,
    "EV/Sales Comparables": 1.0,
    "P/S Comparables": 1.0,
    "PEG Ratio": 0.8,
}

# Dispatcher: which extra kwargs each model function accepts
_SECTOR_MODELS = {ev_ebitda_comps, ev_ebit_comps, ev_sales_comps, pe_comps, ps_comps,
                  peg_model, cap_earnings, fcf_yield_model, pb_model}
_RFR_MODELS = {dcf, ddm, pb_model, residual_income}
# pb_model is in both sets — _call_model handles the intersection


def _normalise(data: dict) -> dict:
    d = dict(data)
    if d.get("price") is None:
        d["price"] = d.get("current_price")
    if d.get("cash") is None:
        d["cash"] = d.get("total_cash")
    if d.get("book_value_per_share") is None:
        bv     = d.get("book_value")
        shares = d.get("shares_outstanding")
        if bv and shares and shares > 0:
            d["book_value_per_share"] = bv
    if d.get("ev_ebitda") is None:
        d["ev_ebitda"] = d.get("ev_to_ebitda")
    return d


def _call_model(fn, data, sector_multiples, risk_free_rate):
    """Call a model function with the right kwargs based on its signature."""
    if fn in _SECTOR_MODELS and fn in _RFR_MODELS:
        return fn(data, sector_multiples=sector_multiples, risk_free_rate=risk_free_rate)
    elif fn in _SECTOR_MODELS:
        return fn(data, sector_multiples)
    elif fn in _RFR_MODELS:
        return fn(data, risk_free_rate=risk_free_rate)
    else:
        return fn(data)


def graham_number(data):
    eps   = data.get("eps")
    bvps  = data.get("book_value_per_share")
    price = data.get("price")
    if not eps or eps <= 0 or not bvps or bvps <= 0 or not price:
        return None
    if bvps > price * 50:
        return None
    val    = math.sqrt(22.5 * float(eps) * float(bvps))
    upside = (val - price) / price * 100
    return {
        "model": "Graham Number", "applicable": True,
        "intrinsic_value": round(val, 2), "current_price": round(price, 2),
        "upside_pct": round(upside, 1),
        "verdict": "Undervalued" if upside > 15 else "Overvalued" if upside < -15 else "Fairly Valued",
        "assumptions": {"EPS": f"${round(float(eps),2)}", "Book Value/Share": f"${round(float(bvps),2)}",
                        "Formula": "sqrt(22.5 * EPS * BVPS)"},
        "description": "Benjamin Graham's classic formula -- the geometric mean of 15x earnings and 1.5x book value.",
        "category": "Asset-Based",
    }


def dcf_sensitivity(data):
    fcf    = data.get("free_cashflow")
    shares = data.get("shares_outstanding")
    debt   = float(data.get("total_debt") or 0)
    cash   = float(data.get("cash") or 0)
    if not fcf or not shares or fcf <= 0:
        return None
    waccs   = [0.07, 0.09, 0.11]
    growths = [0.03, 0.06, 0.10]
    table   = []
    for g in growths:
        row = []
        for w in waccs:
            proj  = [fcf * (1 + g) ** i for i in range(1, 6)]
            disc  = [cf / (1 + w) ** i for i, cf in enumerate(proj, 1)]
            tv    = proj[-1] * 1.025 / (w - 0.025)
            pv_tv = tv / (1 + w) ** 5
            val   = (sum(disc) + pv_tv - debt + cash) / shares
            row.append(round(val, 2))
        table.append(row)
    return {"waccs": [f"{w:.0%}" for w in waccs], "growths": [f"{g:.0%}" for g in growths], "table": table}


def reverse_dcf(data, risk_free_rate=None):
    """Calculate the implied growth rate the market is pricing in.

    Instead of saying 'TSLA is 95% overvalued', this answers:
    'The market expects 35% annual FCF growth for the next 10 years.'
    Much more useful for extreme premium stocks.
    """
    fcf    = data.get("free_cashflow")
    shares = data.get("shares_outstanding")
    price  = data.get("price")
    debt   = float(data.get("total_debt") or 0)
    cash   = float(data.get("cash") or 0)
    if not fcf or not shares or not price or shares <= 0 or price <= 0:
        return None
    # For negative FCF companies, use revenue-based proxy
    if fcf <= 0:
        revenue = data.get("revenue")
        if not revenue or revenue <= 0:
            return None
        # Assume target FCF margin of 15% at maturity
        fcf = revenue * 0.05  # current implied FCF at 5% margin
        fcf_note = "Estimated from 5% of revenue (company has negative FCF)"
    else:
        fcf_note = None

    rfr = risk_free_rate or 0.043
    wacc = max(rfr + 0.045, 0.08)  # equity risk premium ~4.5%
    terminal_growth = 0.025
    market_cap = price * shares
    enterprise_value = market_cap + debt - cash

    # Binary search for implied growth rate
    lo, hi = -0.10, 1.0  # -10% to 100% growth
    for _ in range(80):
        mid = (lo + hi) / 2
        # Project FCF for 10 years at this growth rate
        proj_fcf = [fcf * (1 + mid) ** i for i in range(1, 11)]
        disc_fcf = [cf / (1 + wacc) ** i for i, cf in enumerate(proj_fcf, 1)]
        # Terminal value
        terminal_fcf = proj_fcf[-1] * (1 + terminal_growth)
        tv = terminal_fcf / (wacc - terminal_growth)
        pv_tv = tv / (1 + wacc) ** 10
        implied_ev = sum(disc_fcf) + pv_tv
        if implied_ev < enterprise_value:
            lo = mid
        else:
            hi = mid

    implied_growth = (lo + hi) / 2

    # Compute what FCF would be in year 10 at this rate
    year10_fcf = fcf * (1 + implied_growth) ** 10
    year10_margin_note = None
    revenue = data.get("revenue")
    if revenue and revenue > 0:
        year10_revenue = revenue * (1 + implied_growth * 0.7) ** 10  # revenue grows slower
        year10_margin = year10_fcf / year10_revenue if year10_revenue > 0 else None
        if year10_margin and year10_margin > 0.40:
            year10_margin_note = f"Implies {round(year10_margin * 100)}% FCF margin in year 10 — would be historically exceptional"

    result = {
        "implied_growth_rate": round(implied_growth * 100, 1),
        "wacc_used": round(wacc * 100, 1),
        "terminal_growth": round(terminal_growth * 100, 1),
        "current_fcf": round(fcf, 0),
        "year10_fcf": round(year10_fcf, 0),
        "projection_years": 10,
    }
    if fcf_note:
        result["fcf_note"] = fcf_note
    if year10_margin_note:
        result["margin_note"] = year10_margin_note

    # Reasonableness assessment
    if implied_growth > 0.40:
        result["assessment"] = "Extremely aggressive — very few companies sustain >40% FCF growth for a decade"
    elif implied_growth > 0.25:
        result["assessment"] = "Aggressive — requires sustained high growth execution"
    elif implied_growth > 0.15:
        result["assessment"] = "Optimistic but achievable for a strong grower"
    elif implied_growth > 0.05:
        result["assessment"] = "Reasonable — market expects moderate growth"
    elif implied_growth > 0:
        result["assessment"] = "Conservative — market expects minimal growth"
    else:
        result["assessment"] = "Market is pricing in negative growth or FCF decline"

    return result


def peer_comparison(data, sector_multiples=None):
    sector  = data.get("sector", "default")
    price   = data.get("price") or 1
    eps     = data.get("eps")
    ebitda  = data.get("ebitda")
    ev      = data.get("enterprise_value")
    revenue = data.get("revenue")
    shares  = data.get("shares_outstanding") or 1
    sm = (sector_multiples or HARDCODED_FALLBACK).get(sector, (sector_multiples or HARDCODED_FALLBACK).get("default", {}))
    rows = []
    if eps and eps > 0:
        actual_pe = round(price / float(eps), 1)
        sector_pe = sm.get("pe", 18)
        rows.append({"metric": "P/E Ratio", "company": actual_pe, "sector_median": sector_pe,
                      "diff_pct": round((actual_pe - sector_pe) / sector_pe * 100, 1)})
    if ebitda and ebitda > 0 and ev:
        actual_ev = round(float(ev) / float(ebitda), 1)
        sector_ev = sm.get("ev_ebitda", 16)
        rows.append({"metric": "EV/EBITDA", "company": actual_ev, "sector_median": sector_ev,
                      "diff_pct": round((actual_ev - sector_ev) / sector_ev * 100, 1)})
    if revenue and revenue > 0:
        actual_ps = round(price / (float(revenue) / shares), 2)
        sector_ps = sm.get("ps", 2)
        rows.append({"metric": "P/S Ratio", "company": actual_ps, "sector_median": sector_ps,
                      "diff_pct": round((actual_ps - sector_ps) / sector_ps * 100, 1)})
    return rows


def _compute_signals(data, consensus, sector_multiples):
    """Compute contextual risk/opportunity signals."""
    signals = {}
    price = data.get("price") or 0
    high52 = data.get("52w_high") or 0
    low52 = data.get("52w_low") or 0

    # Price range signal (Change 16)
    if high52 and low52 and high52 > low52 and price > 0:
        price_range = (price - low52) / (high52 - low52)
        signals["price_range"] = round(price_range, 3)
        if price_range > 0.9:
            signals["price_range_warning"] = "Trading near 52-week high -- elevated reversal risk"

    # Investment quality (Change 15)
    total_assets = data.get("total_assets")
    total_assets_prev = data.get("total_assets_prev")
    ebitda_cur = data.get("ebitda")
    ebitda_prev = data.get("ebitda_prev")
    if total_assets and total_assets_prev and total_assets_prev > 0 and ebitda_cur and ebitda_prev and ebitda_prev > 0:
        asset_growth = (total_assets - total_assets_prev) / total_assets_prev
        ebitda_growth = (ebitda_cur - ebitda_prev) / ebitda_prev
        signals["asset_growth"] = round(asset_growth, 3)
        signals["ebitda_growth"] = round(ebitda_growth, 3)
        if asset_growth > ebitda_growth and asset_growth > 0.05:
            signals["investment_quality"] = "negative"
        else:
            signals["investment_quality"] = "neutral"

    # Earnings yield signal (Change 9)
    eps = data.get("eps")
    if eps and price and price > 0:
        company_ey = eps / price
        sector = data.get("sector", "default")
        sm = sector_multiples.get(sector, sector_multiples.get("default", {}))
        sector_pe = sm.get("pe", 18)
        sector_ey = 1.0 / sector_pe if sector_pe > 0 else 0.055
        signals["earnings_yield"] = round(company_ey, 4)
        signals["sector_earnings_yield"] = round(sector_ey, 4)
        if company_ey > sector_ey * 1.3:
            signals["earnings_yield_signal"] = "above_sector"
        elif company_ey < sector_ey * 0.7:
            signals["earnings_yield_signal"] = "below_sector"

    # Smoothed earnings flag (Change 18)
    eps_3yr = data.get("eps_3yr_avg")
    if eps and eps_3yr and eps_3yr > 0:
        divergence = abs(eps - eps_3yr) / eps_3yr
        if divergence > 0.30:
            direction = "elevated" if eps > eps_3yr else "depressed"
            signals["earnings_smoothing"] = {
                "trailing_eps": round(eps, 2), "avg_3yr_eps": round(eps_3yr, 2), "status": direction,
            }

    # Mispricing persistence note (Change 17)
    if consensus and abs(consensus.get("upside_pct", 0)) > 25:
        signals["mispricing_note"] = "Mispricings of this magnitude typically take 3-5+ years to fully correct"

    # Extreme premium detection — warn when P/E > 5x sector median
    pe = data.get("pe_ratio")
    if not pe and data.get("eps") and data["eps"] > 0 and data.get("price"):
        pe = data["price"] / data["eps"]
    if pe and pe > 0:
        sector = data.get("sector", "default")
        sm = sector_multiples.get(sector, sector_multiples.get("default", {}))
        sector_pe = sm.get("pe", 18)
        if sector_pe and sector_pe > 0:
            pe_ratio_to_sector = pe / sector_pe
            if pe_ratio_to_sector > 5:
                signals["extreme_premium"] = {
                    "company_pe": round(pe, 1),
                    "sector_pe": round(sector_pe, 1),
                    "multiple": round(pe_ratio_to_sector, 1),
                    "message": f"This stock trades at {round(pe_ratio_to_sector, 1)}x its sector median P/E ({round(pe, 1)}x vs {round(sector_pe, 1)}x). Traditional valuation models may not fully capture the growth expectations or speculative premium embedded in the price."
                }

    return signals


def confidence_score(data, result, signals=None, analyst_blended=None):
    fields = ["price", "eps", "ebitda", "revenue", "free_cashflow",
              "book_value_per_share", "shares_outstanding", "dividend_yield", "beta", "roe"]
    filled = sum(1 for f in fields if data.get(f) not in (None, 0))
    pct = filled / len(fields)
    n_applicable = len([r for r in result if r and r.get("applicable")])

    if pct >= 0.8 and n_applicable >= 3:
        score = "High"
    elif pct >= 0.5 and n_applicable >= 2:
        score = "Medium"
    else:
        score = "Low"

    if signals:
        # Downgrade for negative investment quality
        if signals.get("investment_quality") == "negative":
            score = {"High": "Medium", "Medium": "Low"}.get(score, score)
        # Downgrade for near 52w high
        if signals.get("price_range", 0) > 0.9:
            score = {"High": "Medium", "Medium": "Low"}.get(score, score)

    # Upgrade if analyst target and model consensus agree within 10% (Change 22)
    if analyst_blended and analyst_blended.get("divergence_pct", 100) <= 10:
        score = {"Low": "Medium", "Medium": "High"}.get(score, score)

    # Upgrade if earnings yield signal aligns with consensus direction (Change 22)
    if signals and signals.get("earnings_yield_signal"):
        ey_signal = signals["earnings_yield_signal"]
        if analyst_blended:
            consensus_upside = analyst_blended.get("model_consensus", 0) - data.get("price", 0)
        else:
            consensus_upside = 0
        # "above_sector" EY + undervalued consensus = aligned bullish
        # "below_sector" EY + overvalued consensus = aligned bearish
        if (ey_signal == "above_sector" and consensus_upside > 0) or \
           (ey_signal == "below_sector" and consensus_upside < 0):
            score = {"Low": "Medium", "Medium": "High"}.get(score, score)

    return score


def run_valuation(ticker: str, data: dict) -> dict:
    data = _normalise(data)
    if not data.get("price"):
        return {"ticker": ticker, "error": "No price data available", "consensus": None,
                "valuations": [], "confidence": "Low", "signals": {}}
    sector_multiples = get_sector_multiples()
    risk_free_rate = get_risk_free_rate()

    company_type = classify_company(data)
    model_fns    = MODEL_MAP.get(company_type, [dcf, ev_ebitda_comps, pe_comps, ps_comps])
    results      = [_call_model(fn, data, sector_multiples, risk_free_rate) for fn in model_fns]
    results      = [r for r in results if r is not None]

    gn = graham_number(data)
    if gn:
        results.append(gn)

    applicable = [r for r in results if r.get("applicable")]

    # Compute price targets using non-outlier models
    market_pool = [r for r in applicable if r.get("model") not in OUTLIER_MODELS]
    target_pool = market_pool if market_pool else applicable
    ve_target_mean = round(sum(r["intrinsic_value"] for r in target_pool) / len(target_pool), 2) if target_pool else None
    ve_target_high = round(max(r["intrinsic_value"] for r in target_pool), 2) if target_pool else None
    ve_target_low  = round(min(r["intrinsic_value"] for r in target_pool), 2) if target_pool else None

    # Weighted consensus (replaces simple average)
    consensus = None
    analyst_blended = None
    if target_pool:
        price = data["price"]
        weighted_sum = 0
        weight_total = 0
        for r in target_pool:
            w = MODEL_WEIGHTS.get(r["model"], 1.0)
            weighted_sum += r["intrinsic_value"] * w
            weight_total += w
        avg = weighted_sum / weight_total if weight_total > 0 else 0

        # Analyst blending
        analyst_target = data.get("target_price")
        if analyst_target and float(analyst_target) > 0 and avg > 0:
            analyst_target = float(analyst_target)
            divergence = abs(analyst_target - avg) / avg
            # Higher weight when divergent: analysts often have info models lack
            # (catalysts, management changes, sector shifts) — Delao et al. 2024
            analyst_weight = 0.6 if divergence > 0.10 else 0.3
            blended = analyst_weight * analyst_target + (1 - analyst_weight) * avg
            analyst_blended = {
                "blended_value": round(blended, 2),
                "analyst_target": round(analyst_target, 2),
                "model_consensus": round(avg, 2),
                "analyst_weight": analyst_weight,
                "divergence_pct": round(divergence * 100, 1),
            }
            avg = blended

        margin = (avg - price) / price
        consensus = {
            "average_intrinsic_value": round(avg, 2),
            "current_price": round(price, 2),
            "upside_pct": round(margin * 100, 1),
            "overall_verdict": (
                "Undervalued" if margin > 0.15 else
                "Overvalued"  if margin < -0.15 else
                "Fairly Valued"
            ),
            "models_used": len(target_pool),
        }

    # Contextual signals
    signals = _compute_signals(data, consensus, sector_multiples)

    return {
        "ticker":        ticker,
        "company_name":  data.get("name", ticker),
        "sector":        data.get("sector", "Unknown"),
        "industry":      data.get("industry", "Unknown"),
        "company_type":  COMPANY_TYPE_LABELS.get(company_type, company_type),
        "current_price": data["price"],
        "market_cap":    data.get("market_cap"),
        "description":   data.get("description", ""),
        "website":       data.get("website", ""),
        "consensus":     consensus,
        "analyst_blended": analyst_blended,
        "signals":       signals,
        "valuations":    results,
        "dcf_sensitivity": dcf_sensitivity(data),
        "reverse_dcf":   reverse_dcf(data, risk_free_rate),
        "peer_comparison": peer_comparison(data, sector_multiples),
        "confidence":    confidence_score(data, results, signals, analyst_blended),
        "analyst": {
            "target_mean":          ve_target_mean,
            "target_high":          ve_target_high,
            "target_low":           ve_target_low,
            "target_median":        ve_target_mean,
            "recommendation":       data.get("recommendation"),
            "recommendation_mean":  data.get("recommendation_mean"),
            "analyst_count":        data.get("analyst_count"),
            "current_price":        data.get("price"),
        },
        "key_metrics": {
            "pe_ratio":       data.get("pe_ratio"),
            "forward_pe":     data.get("forward_pe"),
            "pb_ratio":       data.get("pb_ratio"),
            "ps_ratio":       data.get("ps_ratio"),
            "peg_ratio":      data.get("peg_ratio"),
            "ev_ebitda":      data.get("ev_ebitda"),
            "ev_to_revenue":  data.get("ev_to_revenue"),
            "dividend_yield": data.get("dividend_yield"),
            "dividend_rate":  data.get("dividend_rate"),
            "payout_ratio":   data.get("payout_ratio"),
            "beta":           data.get("beta"),
            "roe":            data.get("roe"),
            "roa":            data.get("roa"),
            "profit_margin":  data.get("profit_margin"),
            "operating_margin": data.get("operating_margin"),
            "revenue_growth": data.get("revenue_growth"),
            "earnings_growth":data.get("earnings_growth"),
            "eps":            data.get("eps"),
            "forward_eps":    data.get("forward_eps"),
            "debt_to_equity": data.get("debt_to_equity"),
            "current_ratio":  data.get("current_ratio"),
            "52w_high":       data.get("52w_high"),
            "52w_low":        data.get("52w_low"),
            "target_price":   data.get("target_price"),
            "recommendation": data.get("recommendation"),
            "revenue":        data.get("revenue"),
            "ebitda":         data.get("ebitda"),
            "net_income":     data.get("net_income"),
            "free_cashflow":  data.get("free_cashflow"),
            "total_debt":     data.get("total_debt"),
            "total_cash":     data.get("total_cash"),
            "book_value_per_share": data.get("book_value_per_share"),
            "shares_outstanding":   data.get("shares_outstanding"),
            "enterprise_value":     data.get("enterprise_value"),
        },
    }
