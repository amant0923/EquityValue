"""Equity Value Score (EVS) — proprietary 1-100 composite scoring algorithm.

Components (weights):
  - Valuation (35%): Consensus model upside
  - Financial Health (20%): Altman Z, Piotroski, leverage, margins
  - Analyst Alignment (15%): Model-analyst agreement
  - Growth Quality (15%): Revenue, EPS, FCF growth
  - Risk Signals (15%): 52w range, earnings smoothing, investment quality
"""


def _clamp(val, lo=0.0, hi=100.0):
    return max(lo, min(hi, val))


def _valuation_score(data: dict) -> float:
    """35% weight. Maps consensus upside % to 0-100 sub-score."""
    upside = data.get("consensus_upside_pct", 0.0)
    raw = _clamp((upside + 50) / 100 * 100, 0, 100)
    return round(raw, 1)


def _health_score(data: dict) -> float:
    """20% weight. Altman Z + Piotroski + leverage + margin."""
    z = data.get("altman_z_score")
    piotroski = data.get("piotroski_score")
    dte = data.get("debt_to_equity", 1.0)
    margin = data.get("profit_margin", 0.0)

    z_sub = 0
    if z is not None:
        if z > 3.0:
            z_sub = 100
        elif z > 1.8:
            z_sub = (z - 1.8) / 1.2 * 100
    else:
        z_sub = 50

    p_sub = (piotroski / 9 * 100) if piotroski is not None else 50
    dte_sub = _clamp(100 - (dte / 3 * 100), 0, 100) if dte is not None else 50
    m_sub = _clamp((margin + 0.10) / 0.30 * 100, 0, 100) if margin is not None else 50

    combined = z_sub * 0.30 + p_sub * 0.30 + dte_sub * 0.20 + m_sub * 0.20
    return round(combined, 1)


def _analyst_score(data: dict) -> float:
    """15% weight. Agreement between models and analysts."""
    analyst_upside = data.get("analyst_target_upside_pct", 0.0)
    divergence = abs(data.get("model_analyst_divergence_pct", 50.0))
    upside_sub = _clamp((analyst_upside + 30) / 60 * 100, 0, 100)
    alignment_sub = _clamp(100 - (divergence / 50 * 100), 0, 100)
    combined = upside_sub * 0.50 + alignment_sub * 0.50
    return round(combined, 1)


def _growth_score(data: dict) -> float:
    """15% weight. Revenue, EPS, FCF growth quality."""
    rev = data.get("revenue_growth", 0.0) or 0.0
    eps = data.get("eps_growth", 0.0) or 0.0
    fcf = data.get("fcf_growth", 0.0) or 0.0

    def _growth_sub(g):
        return _clamp((g + 0.20) / 0.50 * 100, 0, 100)

    combined = _growth_sub(rev) * 0.40 + _growth_sub(eps) * 0.35 + _growth_sub(fcf) * 0.25
    return round(combined, 1)


def _risk_score(data: dict) -> float:
    """15% weight. Higher = less risk = better. Inverted risk signals."""
    price_range = data.get("price_range_52w", 0.5)
    smoothing = data.get("earnings_smoothing_divergence", 0.0)
    iq = data.get("investment_quality", "neutral")
    range_sub = _clamp((1.0 - price_range) * 100, 0, 100)
    smooth_sub = _clamp(100 - (smoothing / 0.40 * 100), 0, 100)
    iq_sub = 30 if iq == "negative" else 70
    combined = range_sub * 0.40 + smooth_sub * 0.35 + iq_sub * 0.25
    return round(combined, 1)


def _verdict(score: int) -> str:
    if score >= 80:
        return "Strong Buy"
    if score >= 60:
        return "Buy"
    if score >= 40:
        return "Hold"
    if score >= 20:
        return "Sell"
    return "Strong Sell"


def compute_evs(data: dict) -> dict:
    """Compute the Equity Value Score (1-100) from input signals."""
    valuation = _valuation_score(data)
    health = _health_score(data)
    analyst = _analyst_score(data)
    growth = _growth_score(data)
    risk = _risk_score(data)

    weighted = (
        valuation * 0.35 +
        health * 0.20 +
        analyst * 0.15 +
        growth * 0.15 +
        risk * 0.15
    )
    score = int(round(_clamp(weighted, 0, 100)))

    return {
        "score": score,
        "verdict": _verdict(score),
        "components": {
            "valuation": valuation,
            "health": health,
            "analyst": analyst,
            "growth": growth,
            "risk": risk,
        },
    }
