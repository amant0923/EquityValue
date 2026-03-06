from classifier import classify_company, COMPANY_TYPE_LABELS
from valuation.models import (
    dcf, ddm, cap_earnings,
    ev_ebitda_comps, ev_ebit_comps, ev_sales_comps,
    pe_comps, ps_comps, peg_model,
    pb_model, residual_income,
    SECTOR_EV_EBITDA, SECTOR_PE, SECTOR_PS
)
import math

MODEL_MAP = {
    "dividend":                 [ddm, dcf, cap_earnings, ev_ebitda_comps, pe_comps, ps_comps],
    "profitable_growth":        [dcf, ev_ebitda_comps, ev_ebit_comps, pe_comps, ps_comps, peg_model],
    "high_growth_unprofitable": [ev_sales_comps, ps_comps, ev_ebitda_comps, peg_model],
    "cyclical":                 [dcf, ev_ebitda_comps, ev_ebit_comps, pe_comps, cap_earnings],
    "financial":                [pb_model, pe_comps, ddm, residual_income],
}


def _normalise(data: dict) -> dict:
    """
    FIX: data_fetcher stores everything as 'current_price', 'total_cash' etc.
    All valuation models expect 'price' and 'cash'.
    Also derive 'book_value_per_share' which is never set by the fetcher.
    """
    d = dict(data)

    # Map current_price → price
    if d.get("price") is None:
        d["price"] = d.get("current_price")

    # Map total_cash → cash
    if d.get("cash") is None:
        d["cash"] = d.get("total_cash")

    # Derive book_value_per_share
    if d.get("book_value_per_share") is None:
        bv     = d.get("book_value")
        shares = d.get("shares_outstanding")
        if bv and shares and shares > 0:
            d["book_value_per_share"] = bv  # book_value from yfinance is already per-share

    # FIX: ev_ebitda field name mismatch — key_metrics uses "ev_ebitda" but fetcher stores "ev_to_ebitda"
    if d.get("ev_ebitda") is None:
        d["ev_ebitda"] = d.get("ev_to_ebitda")

    return d


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
        "model": "Graham Number",
        "applicable": True,
        "intrinsic_value": round(val, 2),
        "current_price": round(price, 2),
        "upside_pct": round(upside, 1),
        "verdict": "Undervalued" if upside > 15 else "Overvalued" if upside < -15 else "Fairly Valued",
        "assumptions": {
            "EPS": f"${round(float(eps),2)}",
            "Book Value/Share": f"${round(float(bvps),2)}",
            "Formula": "√(22.5 × EPS × BVPS)",
        },
        "description": "Benjamin Graham's classic formula — the geometric mean of 15x earnings and 1.5x book value.",
        "category": "Asset-Based",
    }


def dcf_sensitivity(data):
    fcf    = data.get("free_cashflow")
    shares = data.get("shares_outstanding")
    debt   = float(data.get("total_debt") or 0)
    cash   = float(data.get("cash") or 0)          # FIX: was data.get("cash") which was always None
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
    return {
        "waccs":   [f"{w:.0%}" for w in waccs],
        "growths": [f"{g:.0%}" for g in growths],
        "table":   table,
    }


def peer_comparison(data):
    sector  = data.get("sector", "default")
    price   = data.get("price") or 1
    eps     = data.get("eps")
    ebitda  = data.get("ebitda")
    ev      = data.get("enterprise_value")
    revenue = data.get("revenue")
    shares  = data.get("shares_outstanding") or 1
    rows    = []
    if eps and eps > 0:
        actual_pe  = round(price / float(eps), 1)
        sector_pe  = SECTOR_PE.get(sector, SECTOR_PE["default"])
        rows.append({
            "metric": "P/E Ratio",
            "company": actual_pe,
            "sector_median": sector_pe,
            "diff_pct": round((actual_pe - sector_pe) / sector_pe * 100, 1),
        })
    if ebitda and ebitda > 0 and ev:
        actual_ev = round(float(ev) / float(ebitda), 1)
        sector_ev = SECTOR_EV_EBITDA.get(sector, SECTOR_EV_EBITDA["default"])
        rows.append({
            "metric": "EV/EBITDA",
            "company": actual_ev,
            "sector_median": sector_ev,
            "diff_pct": round((actual_ev - sector_ev) / sector_ev * 100, 1),
        })
    if revenue and revenue > 0:
        actual_ps = round(price / (float(revenue) / shares), 2)
        sector_ps = SECTOR_PS.get(sector, SECTOR_PS["default"])
        rows.append({
            "metric": "P/S Ratio",
            "company": actual_ps,
            "sector_median": sector_ps,
            "diff_pct": round((actual_ps - sector_ps) / sector_ps * 100, 1),
        })
    return rows


def confidence_score(data, result):
    # FIX: check normalised field names
    fields = ["price", "eps", "ebitda", "revenue", "free_cashflow",
              "book_value_per_share", "shares_outstanding", "dividend_yield", "beta", "roe"]
    filled       = sum(1 for f in fields if data.get(f) not in (None, 0))
    pct          = filled / len(fields)
    n_applicable = len([r for r in result if r and r.get("applicable")])
    if pct >= 0.8 and n_applicable >= 3: return "High"
    if pct >= 0.5 and n_applicable >= 2: return "Medium"
    return "Low"


def run_valuation(ticker: str, data: dict) -> dict:
    # Normalise field names before passing to any model
    data = _normalise(data)

    company_type = classify_company(data)
    model_fns    = MODEL_MAP.get(company_type, [dcf, ev_ebitda_comps, pe_comps, ps_comps])
    results      = [fn(data) for fn in model_fns]
    results      = [r for r in results if r is not None]   # drop None returns

    gn = graham_number(data)
    if gn:
        results.append(gn)

    applicable = [r for r in results if r.get("applicable")]

    # Compute ValuEngine price targets using market-based models only (exclude outliers)
    OUTLIER_MODELS = {"Graham Number", "Gordon Growth Model (DDM)", "Residual Income", "Capitalization of Earnings"}
    market_pool = [r for r in applicable if r.get("model") not in OUTLIER_MODELS]
    target_pool = market_pool if market_pool else applicable
    ve_target_mean = round(sum(r["intrinsic_value"] for r in target_pool) / len(target_pool), 2) if target_pool else None
    ve_target_high = round(max(r["intrinsic_value"] for r in target_pool), 2) if target_pool else None
    ve_target_low  = round(min(r["intrinsic_value"] for r in target_pool), 2) if target_pool else None

    # Use same market-based pool for consensus (exclude outliers like DDM, Graham)
    consensus = None
    if target_pool:
        price  = data["price"]
        avg    = sum(r["intrinsic_value"] for r in target_pool) / len(target_pool)
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
        "valuations":    results,
        "dcf_sensitivity": dcf_sensitivity(data),
        "peer_comparison": peer_comparison(data),
        "confidence":    confidence_score(data, results),
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
            "ev_ebitda":      data.get("ev_ebitda"),          # FIX: was always None
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
