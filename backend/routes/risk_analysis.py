"""Risk analysis and forecasting endpoints for a given ticker."""

from fastapi import APIRouter, HTTPException, Request, Depends
from slowapi import Limiter
from slowapi.util import get_remote_address
import numpy as np
import pandas as pd
import logging

from config import validate_ticker
from auth import get_current_user
from redis_cache import cache_get, cache_set
from data_fetcher import fetch_price_history

logger = logging.getLogger(__name__)
router = APIRouter()

try:
    from rate_limit import limiter
except Exception:
    limiter = Limiter(key_func=get_remote_address)


def _round(val, decimals=6):
    """Safely round a value, returning None for non-finite."""
    if val is None or not np.isfinite(val):
        return None
    return round(float(val), decimals)


@router.get("/risk/{ticker}")
@limiter.limit("30/minute")
async def get_risk_analysis(ticker: str, request: Request, user: dict = Depends(get_current_user)):
    ticker = validate_ticker(ticker)

    cache_key = f"risk:{ticker}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    history = fetch_price_history(ticker, "5y")
    if not history or len(history) < 100:
        raise HTTPException(status_code=404, detail="Insufficient price history for risk analysis.")

    closes = np.array([float(p["close"]) for p in history])
    dates = [p["date"] for p in history]

    # Daily log returns
    log_returns = np.diff(np.log(closes))
    return_dates = dates[1:]

    # ── QQ Plot ──────────────────────────────────────────────────────────────
    from scipy import stats

    (theoretical_q, sample_q), (slope, intercept, _) = stats.probplot(log_returns, dist="norm")
    qq_plot = {
        "theoretical_quantiles": [_round(v) for v in theoretical_q.tolist()],
        "sample_quantiles": [_round(v) for v in sample_q.tolist()],
        "reference_line": {"slope": _round(slope), "intercept": _round(intercept)},
    }

    # ── Distribution Stats ───────────────────────────────────────────────────
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

    # ── Histogram ────────────────────────────────────────────────────────────
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

    # ── Rolling VaR (252-day window) ─────────────────────────────────────────
    window = 252
    rolling_var = []
    for i in range(window, len(log_returns)):
        w = log_returns[i - window:i]
        rolling_var.append({
            "date": return_dates[i],
            "var_1pct": _round(-float(np.percentile(w, 1))),
            "var_5pct": _round(-float(np.percentile(w, 5))),
        })

    # ── Rolling Mean (252-day window) ────────────────────────────────────────
    rolling_mean = []
    for i in range(window, len(log_returns)):
        w = log_returns[i - window:i]
        rolling_mean.append({
            "date": return_dates[i],
            "rolling_mean": _round(float(np.mean(w))),
        })

    # ── VaR Summary ──────────────────────────────────────────────────────────
    var_1pct = -float(np.percentile(log_returns, 1))
    var_5pct = -float(np.percentile(log_returns, 5))
    threshold_1pct = np.percentile(log_returns, 1)
    tail_returns = log_returns[log_returns <= threshold_1pct]
    es_1pct = -float(np.mean(tail_returns)) if len(tail_returns) > 0 else var_1pct

    # Max drawdown from cumulative returns
    cum_returns = np.cumprod(1 + (np.exp(log_returns) - 1))
    running_max = np.maximum.accumulate(cum_returns)
    drawdowns = (cum_returns - running_max) / running_max
    max_drawdown = float(np.min(drawdowns))

    # Sharpe ratio (annualised)
    sharpe = (mean_ret / std_ret) * np.sqrt(252) if std_ret > 0 else 0.0

    # Sortino ratio (annualised)
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

    result = {
        "ticker": ticker,
        "qq_plot": qq_plot,
        "distribution": distribution,
        "histogram": histogram,
        "rolling_var": rolling_var,
        "rolling_mean": rolling_mean,
        "var_summary": var_summary,
    }

    cache_set(cache_key, result, ttl=3600)
    return result


@router.get("/forecast/{ticker}")
@limiter.limit("30/minute")
async def get_forecast(ticker: str, request: Request, user: dict = Depends(get_current_user)):
    ticker = validate_ticker(ticker)

    cache_key = f"forecast:{ticker}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    history = fetch_price_history(ticker, "5y")
    if not history or len(history) < 100:
        raise HTTPException(status_code=404, detail="Insufficient price history for forecasting.")

    closes = np.array([float(p["close"]) for p in history])
    dates = [p["date"] for p in history]
    log_prices = np.log(closes)
    log_returns = np.diff(log_prices)

    forecast_horizon = 504  # ~2 years of trading days

    # ── ARIMA(1,1,1) on log prices ───────────────────────────────────────────
    arima_success = False
    arima_aic = None
    arima_bic = None
    arima_forecast_log = None

    try:
        from statsmodels.tsa.arima.model import ARIMA
        model = ARIMA(log_prices, order=(1, 1, 1))
        arima_result = model.fit()
        arima_aic = float(arima_result.aic)
        arima_bic = float(arima_result.bic)
        forecast_obj = arima_result.get_forecast(steps=forecast_horizon)
        arima_forecast_log = forecast_obj.predicted_mean
        arima_conf = forecast_obj.conf_int(alpha=0.05)
        arima_success = True
        logger.info(f"ARIMA fit successful for {ticker}")
    except Exception as e:
        logger.warning(f"ARIMA failed for {ticker}: {e}. Falling back to random walk.")

    # Random walk fallback: forecast = last log price (constant)
    if not arima_success:
        last_log = log_prices[-1]
        arima_forecast_log = np.full(forecast_horizon, last_log)
        # Build simple confidence intervals using historical std
        std = float(np.std(log_returns, ddof=1))
        steps = np.arange(1, forecast_horizon + 1)
        widths = 1.96 * std * np.sqrt(steps)
        arima_conf = np.column_stack([arima_forecast_log - widths, arima_forecast_log + widths])

    # ── GARCH(1,1) on returns ────────────────────────────────────────────────
    garch_success = False
    garch_vol_forecast = None

    try:
        from arch import arch_model
        scaled_returns = log_returns * 100
        garch = arch_model(scaled_returns, vol="Garch", p=1, q=1, mean="Constant", dist="Normal")
        garch_result = garch.fit(disp="off", show_warning=False)
        garch_forecast = garch_result.forecast(horizon=forecast_horizon)
        # Variance forecast → annualised volatility
        variance_forecast = garch_forecast.variance.values[-1, :]
        garch_vol_forecast = np.sqrt(variance_forecast) / 100 * np.sqrt(252)
        garch_success = True
        logger.info(f"GARCH fit successful for {ticker}")
    except Exception as e:
        logger.warning(f"GARCH failed for {ticker}: {e}. Falling back to rolling volatility.")

    # ── Historical volatility (21-day rolling, annualised) ───────────────────
    roll_window = 21
    hist_vol = []
    for i in range(roll_window, len(log_returns)):
        w = log_returns[i - roll_window:i]
        vol = float(np.std(w, ddof=1)) * np.sqrt(252)
        hist_vol.append({"date": dates[i + 1], "volatility": _round(vol)})

    # Only last 252 days of historical vol for chart
    hist_vol_trimmed = hist_vol[-252:] if len(hist_vol) > 252 else hist_vol

    # Fallback: use last rolling vol as constant forecast
    if not garch_success:
        last_vol = hist_vol[-1]["volatility"] if hist_vol else _round(float(np.std(log_returns, ddof=1)) * np.sqrt(252))
        garch_vol_forecast = np.full(forecast_horizon, last_vol)

    # ── Build forecast dates (business days) ─────────────────────────────────
    last_date = pd.Timestamp(dates[-1])
    forecast_dates = pd.bdate_range(start=last_date + pd.Timedelta(days=1), periods=forecast_horizon)
    forecast_date_strs = [d.strftime("%Y-%m-%d") for d in forecast_dates]

    # ── Confidence bands ─────────────────────────────────────────────────────
    # If ARIMA succeeded, use its confidence intervals; overlay GARCH vol if available
    if arima_success:
        forecast_log_mean = np.array(arima_forecast_log)
        lower_95_log = np.array(arima_conf)[:, 0]
        upper_95_log = np.array(arima_conf)[:, 1]

        # If GARCH available, use GARCH-based bands instead
        if garch_success:
            daily_vol = garch_vol_forecast / np.sqrt(252)
            steps = np.arange(1, forecast_horizon + 1)
            cumulative_std = daily_vol * np.sqrt(steps)
            lower_95_log = forecast_log_mean - 1.96 * cumulative_std
            upper_95_log = forecast_log_mean + 1.96 * cumulative_std
    else:
        forecast_log_mean = np.array(arima_forecast_log)
        lower_95_log = arima_conf[:, 0]
        upper_95_log = arima_conf[:, 1]

    # Convert log prices to actual prices
    forecast_prices = np.exp(forecast_log_mean)
    lower_95_prices = np.exp(lower_95_log)
    upper_95_prices = np.exp(upper_95_log)

    price_forecast_list = []
    for i in range(forecast_horizon):
        price_forecast_list.append({
            "date": forecast_date_strs[i],
            "predicted": _round(float(forecast_prices[i])),
            "lower_95": _round(float(lower_95_prices[i])),
            "upper_95": _round(float(upper_95_prices[i])),
        })

    # ── Historical prices (last 252 days only) ──────────────────────────────
    hist_slice = history[-252:] if len(history) > 252 else history
    historical_prices = [{"date": p["date"], "price": _round(float(p["close"]))} for p in hist_slice]

    # ── Volatility forecast ──────────────────────────────────────────────────
    vol_forecast_list = []
    for i in range(forecast_horizon):
        vol_forecast_list.append({
            "date": forecast_date_strs[i],
            "predicted_vol": _round(float(garch_vol_forecast[i])),
        })

    # ── Model params ─────────────────────────────────────────────────────────
    model_params = {
        "arima_order": [1, 1, 1],
        "garch_order": [1, 1],
        "aic": _round(arima_aic) if arima_aic is not None else None,
        "bic": _round(arima_bic) if arima_bic is not None else None,
    }

    result = {
        "ticker": ticker,
        "price_forecast": {
            "historical": historical_prices,
            "forecast": price_forecast_list,
        },
        "volatility_forecast": {
            "historical": hist_vol_trimmed,
            "forecast": vol_forecast_list,
        },
        "model_params": model_params,
    }

    cache_set(cache_key, result, ttl=86400)
    return result
