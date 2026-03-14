"""Extract EVS input signals from existing valuation + data_fetcher outputs.

Bridges run_valuation() output and fetch_stock_data() output into the
flat dict format that compute_evs() expects.
"""


def extract_evs_inputs(stock_data: dict, valuation_result: dict, scores: dict = None) -> dict:
    """Convert existing data structures to EVS input format."""
    consensus = valuation_result.get("consensus", {})
    signals = valuation_result.get("signals", {})

    consensus_upside = consensus.get("upside_pct", 0.0)

    target = stock_data.get("target_price") or stock_data.get("target_mean")
    price = stock_data.get("price") or stock_data.get("current_price") or 0
    analyst_upside = 0.0
    if target and price and price > 0:
        analyst_upside = (float(target) - float(price)) / float(price) * 100

    model_iv = consensus.get("intrinsic_value", price)
    divergence = 0.0
    if target and model_iv and model_iv > 0:
        divergence = abs(float(target) - float(model_iv)) / float(model_iv) * 100

    high52 = stock_data.get("52w_high") or 0
    low52 = stock_data.get("52w_low") or 0
    price_range = 0.5
    if high52 and low52 and high52 > low52 and price > 0:
        price_range = (float(price) - float(low52)) / (float(high52) - float(low52))

    smoothing = 0.0
    es = signals.get("earnings_smoothing", {})
    if isinstance(es, dict):
        trailing = es.get("trailing_eps", 0)
        avg = es.get("avg_3yr_eps", 0)
        if avg and avg > 0:
            smoothing = abs(trailing - avg) / avg

    return {
        "consensus_upside_pct": consensus_upside,
        "altman_z_score": scores.get("altman_z_score") if scores else None,
        "piotroski_score": scores.get("piotroski_score") if scores else None,
        "debt_to_equity": stock_data.get("debt_to_equity"),
        "profit_margin": stock_data.get("profit_margin"),
        "analyst_target_upside_pct": analyst_upside,
        "model_analyst_divergence_pct": divergence,
        "revenue_growth": stock_data.get("revenue_growth"),
        "eps_growth": stock_data.get("earnings_growth"),
        "fcf_growth": stock_data.get("fcf_growth"),
        "price_range_52w": price_range,
        "earnings_smoothing_divergence": smoothing,
        "investment_quality": signals.get("investment_quality", "neutral"),
    }
