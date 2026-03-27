"""
Weekly refresh: compute risk analysis for all S&P 500 tickers.
Stores results in risk_analysis_cache table.

Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python3 refresh_risk.py
Schedule: Sunday 6am ET via GitHub Actions
"""
import os
import sys
import json
import time

import numpy as np
from supabase import create_client
from data_fetcher import fetch_price_history

# ── Supabase setup ────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", os.environ.get("SUPABASE_KEY", ""))

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_all_tickers():
    rows = supabase.table("stock_fundamentals").select("ticker").execute().data
    return [r["ticker"] for r in rows]


def _round(val, decimals=6):
    if val is None or not np.isfinite(val):
        return None
    return round(float(val), decimals)


def compute_risk(ticker: str) -> dict | None:
    """Compute risk analysis for a ticker. Returns dict or None on failure."""
    history = fetch_price_history(ticker, "5y")
    if not history:
        return None

    # fetch_price_history returns {"dates": [], "closes": [], ...}
    if isinstance(history, dict):
        closes = np.array([float(c) for c in history.get("closes", [])])
        dates = history.get("dates", [])
    else:
        closes = np.array([float(p["close"]) for p in history])
        dates = [p["date"] for p in history]

    if len(closes) < 100:
        return None

    log_returns = np.diff(np.log(closes))
    return_dates = dates[1:]

    from scipy import stats

    # QQ Plot
    (theoretical_q, sample_q), (slope, intercept, _) = stats.probplot(log_returns, dist="norm")
    qq_plot = {
        "theoretical_quantiles": [_round(v) for v in theoretical_q.tolist()],
        "sample_quantiles": [_round(v) for v in sample_q.tolist()],
        "reference_line": {"slope": _round(slope), "intercept": _round(intercept)},
    }

    # Distribution Stats
    mean_ret = float(np.mean(log_returns))
    std_ret = float(np.std(log_returns, ddof=1))
    skewness = float(stats.skew(log_returns))
    kurt = float(stats.kurtosis(log_returns))
    jb_stat, jb_pvalue = stats.jarque_bera(log_returns)

    distribution = {
        "mean": _round(mean_ret),
        "std": _round(std_ret),
        "skewness": _round(skewness),
        "kurtosis": _round(kurt),
        "jarque_bera_stat": _round(float(jb_stat)),
        "jarque_bera_pvalue": _round(float(jb_pvalue)),
        "is_normal": bool(jb_pvalue > 0.05),
    }

    # Histogram
    counts, bin_edges = np.histogram(log_returns, bins=50)
    bins = [_round(float(b)) for b in bin_edges.tolist()]
    hist_counts = [int(c) for c in counts.tolist()]
    quantile_lines = {
        "q1": _round(float(np.percentile(log_returns, 1))),
        "q5": _round(float(np.percentile(log_returns, 5))),
        "q25": _round(float(np.percentile(log_returns, 25))),
        "q75": _round(float(np.percentile(log_returns, 75))),
        "q95": _round(float(np.percentile(log_returns, 95))),
        "q99": _round(float(np.percentile(log_returns, 99))),
    }
    histogram = {"bins": bins, "counts": hist_counts, "quantile_lines": quantile_lines}

    # Rolling VaR (252-day window)
    window = 252
    rolling_var = []
    for i in range(window, len(log_returns)):
        w = log_returns[i - window:i]
        rolling_var.append({
            "date": return_dates[i],
            "var_1pct": _round(-float(np.percentile(w, 1))),
            "var_5pct": _round(-float(np.percentile(w, 5))),
        })

    # Rolling Mean (252-day window)
    rolling_mean = []
    for i in range(window, len(log_returns)):
        w = log_returns[i - window:i]
        rolling_mean.append({
            "date": return_dates[i],
            "rolling_mean": _round(float(np.mean(w))),
        })

    # VaR Summary
    var_1pct = -float(np.percentile(log_returns, 1))
    var_5pct = -float(np.percentile(log_returns, 5))
    threshold_1pct = np.percentile(log_returns, 1)
    tail_returns = log_returns[log_returns <= threshold_1pct]
    es_1pct = -float(np.mean(tail_returns)) if len(tail_returns) > 0 else var_1pct

    cum_returns = np.cumprod(1 + (np.exp(log_returns) - 1))
    running_max = np.maximum.accumulate(cum_returns)
    drawdowns = (cum_returns - running_max) / running_max
    max_drawdown = float(np.min(drawdowns))

    sharpe = (mean_ret / std_ret) * np.sqrt(252) if std_ret > 0 else 0.0
    downside_returns = log_returns[log_returns < 0]
    downside_std = float(np.std(downside_returns, ddof=1)) if len(downside_returns) > 1 else std_ret
    sortino = (mean_ret / downside_std) * np.sqrt(252) if downside_std > 0 else 0.0

    var_summary = {
        "var_1pct": _round(var_1pct),
        "var_5pct": _round(var_5pct),
        "expected_shortfall_1pct": _round(es_1pct),
        "max_drawdown": _round(max_drawdown),
        "sharpe_ratio": _round(sharpe),
        "sortino_ratio": _round(sortino),
    }

    return {
        "ticker": ticker,
        "qq_plot": qq_plot,
        "distribution": distribution,
        "histogram": histogram,
        "rolling_var": rolling_var,
        "rolling_mean": rolling_mean,
        "var_summary": var_summary,
    }


def main():
    tickers = get_all_tickers()
    total = len(tickers)
    print(f"Refreshing risk analysis for {total} tickers...")

    ok = 0
    fail = 0

    for i, ticker in enumerate(tickers):
        try:
            result = compute_risk(ticker)
            if result is None:
                print(f"  [{i+1}/{total}] {ticker} — SKIPPED (insufficient data)")
                fail += 1
                continue

            record = {
                "ticker": ticker,
                "qq_plot": json.dumps(result["qq_plot"]),
                "distribution": json.dumps(result["distribution"]),
                "histogram": json.dumps(result["histogram"]),
                "rolling_var": json.dumps(result["rolling_var"]),
                "rolling_mean": json.dumps(result["rolling_mean"]),
                "var_summary": json.dumps(result["var_summary"]),
            }

            supabase.table("risk_analysis_cache").upsert(record, on_conflict="ticker").execute()
            ok += 1
            print(f"  [{i+1}/{total}] {ticker} — OK")

        except Exception as e:
            fail += 1
            print(f"  [{i+1}/{total}] {ticker} — FAILED: {e}")

        time.sleep(1.0)  # yfinance 5y data is heavier

    print(f"\nDone: {ok} OK, {fail} failed/skipped out of {total}")


if __name__ == "__main__":
    main()
