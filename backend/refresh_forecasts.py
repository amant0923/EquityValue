"""
Weekly refresh: compute ARIMA-GARCH price & volatility forecasts for all S&P 500 tickers.
Stores results in price_forecasts table.

Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python3 refresh_forecasts.py
Schedule: Sunday 6am ET via GitHub Actions (after refresh_risk.py)

NOTE: This is the slowest script (~15-30s per ticker). Total runtime: 2-4 hours for ~500 tickers.
GitHub Actions timeout should be set to 6 hours.
"""
import os
import sys
import json
import time
import logging

import numpy as np
import pandas as pd
from supabase import create_client
from data_fetcher import fetch_price_history

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

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


def compute_forecast(ticker: str) -> dict | None:
    """Compute ARIMA-GARCH forecast for a ticker. Returns dict or None on failure."""
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
    log_prices = np.log(closes)
    log_returns = np.diff(log_prices)

    forecast_horizon = 504  # ~2 years of trading days

    # ── ARIMA(1,1,1) on log prices ───────────────────────────────────────
    arima_success = False
    arima_aic = None
    arima_bic = None
    arima_forecast_log = None
    arima_conf = None

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
    except Exception as e:
        logger.warning(f"ARIMA failed for {ticker}: {e}. Using random walk.")

    # Random walk fallback
    if not arima_success:
        last_log = log_prices[-1]
        arima_forecast_log = np.full(forecast_horizon, last_log)
        std = float(np.std(log_returns, ddof=1))
        steps = np.arange(1, forecast_horizon + 1)
        widths = 1.96 * std * np.sqrt(steps)
        arima_conf = np.column_stack([arima_forecast_log - widths, arima_forecast_log + widths])

    # ── GARCH(1,1) on returns ────────────────────────────────────────────
    garch_success = False
    garch_vol_forecast = None

    try:
        from arch import arch_model
        scaled_returns = log_returns * 100
        garch = arch_model(scaled_returns, vol="Garch", p=1, q=1, mean="Constant", dist="Normal")
        garch_result = garch.fit(disp="off", show_warning=False)
        garch_forecast = garch_result.forecast(horizon=forecast_horizon)
        variance_forecast = garch_forecast.variance.values[-1, :]
        garch_vol_forecast = np.sqrt(variance_forecast) / 100 * np.sqrt(252)
        garch_success = True
    except Exception as e:
        logger.warning(f"GARCH failed for {ticker}: {e}. Using rolling volatility.")

    # Historical volatility (21-day rolling, annualised)
    roll_window = 21
    hist_vol = []
    for i in range(roll_window, len(log_returns)):
        w = log_returns[i - roll_window:i]
        vol = float(np.std(w, ddof=1)) * np.sqrt(252)
        hist_vol.append({"date": dates[i + 1], "volatility": _round(vol)})

    hist_vol_trimmed = hist_vol[-252:] if len(hist_vol) > 252 else hist_vol

    if not garch_success:
        last_vol = hist_vol[-1]["volatility"] if hist_vol else _round(float(np.std(log_returns, ddof=1)) * np.sqrt(252))
        garch_vol_forecast = np.full(forecast_horizon, last_vol)

    # ── Build forecast dates ─────────────────────────────────────────────
    last_date = pd.Timestamp(dates[-1])
    forecast_dates = pd.bdate_range(start=last_date + pd.Timedelta(days=1), periods=forecast_horizon)
    forecast_date_strs = [d.strftime("%Y-%m-%d") for d in forecast_dates]

    # ── Confidence bands ─────────────────────────────────────────────────
    if arima_success:
        forecast_log_mean = np.array(arima_forecast_log)
        lower_95_log = np.array(arima_conf)[:, 0]
        upper_95_log = np.array(arima_conf)[:, 1]
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

    # Convert to actual prices
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

    # Build historical prices list from the last ~252 trading days
    n_hist = len(closes)
    start_idx = max(0, n_hist - 252)
    historical_prices = [{"date": dates[i], "price": _round(float(closes[i]))} for i in range(start_idx, n_hist)]

    vol_forecast_list = []
    for i in range(forecast_horizon):
        vol_forecast_list.append({
            "date": forecast_date_strs[i],
            "predicted_vol": _round(float(garch_vol_forecast[i])),
        })

    model_params = {
        "arima_order": [1, 1, 1],
        "garch_order": [1, 1],
        "aic": _round(arima_aic) if arima_aic is not None else None,
        "bic": _round(arima_bic) if arima_bic is not None else None,
    }

    return {
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


def main():
    tickers = get_all_tickers()
    total = len(tickers)
    print(f"Refreshing price forecasts for {total} tickers...")
    print(f"NOTE: This will take 2-4 hours for ~500 tickers.")

    ok = 0
    fail = 0

    for i, ticker in enumerate(tickers):
        try:
            t0 = time.time()
            result = compute_forecast(ticker)
            elapsed = time.time() - t0

            if result is None:
                print(f"  [{i+1}/{total}] {ticker} — SKIPPED (insufficient data) [{elapsed:.1f}s]")
                fail += 1
                continue

            record = {
                "ticker": ticker,
                "price_forecast": json.dumps(result["price_forecast"]),
                "volatility_forecast": json.dumps(result["volatility_forecast"]),
                "model_params": json.dumps(result["model_params"]),
            }

            supabase.table("price_forecasts").upsert(record, on_conflict="ticker").execute()
            ok += 1
            print(f"  [{i+1}/{total}] {ticker} — OK [{elapsed:.1f}s]")

        except Exception as e:
            fail += 1
            print(f"  [{i+1}/{total}] {ticker} — FAILED: {e}")

        time.sleep(0.5)

    print(f"\nDone: {ok} OK, {fail} failed/skipped out of {total}")


if __name__ == "__main__":
    main()
