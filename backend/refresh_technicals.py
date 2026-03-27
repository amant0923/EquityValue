"""
Daily refresh: compute technical indicators for all S&P 500 tickers.
Stores results in technicals_cache table for instant API serving.

Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python3 refresh_technicals.py
Schedule: Mon-Fri 7am ET via GitHub Actions
"""
import os
import sys
import json
import time

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


# ── Import computation functions from routes/technicals.py ────────────────────

from routes.technicals import (
    _compute_rsi, _compute_sma, _compute_ema, _compute_macd,
    _compute_bollinger, _compute_supertrend, _compute_pivot_points,
    _compute_fibonacci, _compute_support_resistance, _generate_signals,
    _compute_performance,
)
import numpy as np


def compute_technicals(ticker: str, period: str = "1y") -> dict | None:
    """Compute all technical indicators for a ticker. Returns dict or None on failure."""
    history = fetch_price_history(ticker, period)
    if not history:
        return None

    # fetch_price_history returns {"dates": [], "closes": [], "volumes": []}
    if isinstance(history, dict):
        dates = history.get("dates", [])
        closes = [float(c) for c in history.get("closes", [])]
        highs = [float(h) for h in history.get("highs", closes)]
        lows = [float(l) for l in history.get("lows", closes)]
        volumes = [int(v) for v in history.get("volumes", [0] * len(closes))]
    else:
        # Legacy list-of-dicts format
        dates = [p["date"] for p in history]
        closes = [float(p["close"]) for p in history]
        highs = [float(p.get("high", p["close"])) for p in history]
        lows = [float(p.get("low", p["close"])) for p in history]
        volumes = [int(p.get("volume", 0)) for p in history]

    if len(closes) < 50:
        return None
    n = len(closes)

    # RSI (14)
    rsi_vals = _compute_rsi(closes, 14)
    rsi_offset = n - len(rsi_vals)
    rsi_data = [{"date": dates[rsi_offset + i], "value": round(v, 2)} for i, v in enumerate(rsi_vals)]

    # SMA (20, 50, 100, 200)
    sma_data = {}
    for p in [20, 50, 100, 200]:
        vals = _compute_sma(closes, p)
        offset = n - len(vals)
        sma_data[str(p)] = [{"date": dates[offset + i], "value": round(v, 4)} for i, v in enumerate(vals)]

    # EMA (5, 21, 50, 100, 200)
    ema_data = {}
    for p in [5, 21, 50, 100, 200]:
        vals = _compute_ema(closes, p)
        offset = n - len(vals)
        ema_data[str(p)] = [{"date": dates[offset + i], "value": round(v, 4)} for i, v in enumerate(vals)]

    # MACD (12, 26, 9)
    macd_line, signal_line, histogram = _compute_macd(closes, 12, 26, 9)
    macd_offset = n - len(macd_line)
    sig_offset = len(macd_line) - len(signal_line)
    hist_offset = len(macd_line) - len(histogram)
    macd_data = []
    for i in range(len(macd_line)):
        entry = {"date": dates[macd_offset + i], "macd": round(macd_line[i], 4)}
        si = i - sig_offset
        hi = i - hist_offset
        entry["signal"] = round(signal_line[si], 4) if 0 <= si < len(signal_line) else None
        entry["histogram"] = round(histogram[hi], 4) if 0 <= hi < len(histogram) else None
        macd_data.append(entry)

    # Bollinger Bands (20, 2)
    bb_upper, bb_middle, bb_lower = _compute_bollinger(closes, 20, 2)
    bb_offset = n - len(bb_upper)
    bb_data = [{"date": dates[bb_offset + i], "upper": round(bb_upper[i], 4), "middle": round(bb_middle[i], 4), "lower": round(bb_lower[i], 4)} for i in range(len(bb_upper))]

    # Supertrend (10, 3)
    st_vals, st_dirs = _compute_supertrend(highs, lows, closes, 10, 3)
    st_start = n - len(st_vals)
    st_data = [{"date": dates[st_start + i], "supertrend": round(st_vals[i], 4), "direction": st_dirs[i]} for i in range(len(st_vals))]

    # Pivot Points (last day)
    pivots = _compute_pivot_points(highs[-1], lows[-1], closes[-1])

    # Fibonacci Retracement (52-week high/low)
    period_high = max(highs[-252:]) if len(highs) >= 252 else max(highs)
    period_low = min(lows[-252:]) if len(lows) >= 252 else min(lows)
    fib = _compute_fibonacci(period_high, period_low)

    # Support/Resistance
    sr = _compute_support_resistance(closes, highs, lows)

    # Volume
    volume_data = [{"date": dates[i], "volume": volumes[i]} for i in range(n)]

    # Signal Summary
    rsi_last = rsi_vals[-1] if rsi_vals else None
    macd_last = macd_line[-1] if macd_line else None
    macd_sig_last = signal_line[-1] if signal_line else None
    sma_20_last = _compute_sma(closes, 20)[-1] if len(closes) >= 20 else None
    sma_50_last = _compute_sma(closes, 50)[-1] if len(closes) >= 50 else None
    sma_200_last = _compute_sma(closes, 200)[-1] if len(closes) >= 200 else None
    ema_50_last = _compute_ema(closes, 50)[-1] if len(closes) >= 50 else None
    bb_up_last = bb_upper[-1] if bb_upper else None
    bb_lo_last = bb_lower[-1] if bb_lower else None
    st_dir_last = st_dirs[-1] if st_dirs else None

    signals = _generate_signals(
        rsi_last, macd_last, macd_sig_last, closes[-1],
        sma_20_last, sma_50_last, sma_200_last, ema_50_last,
        bb_up_last, bb_lo_last, st_dir_last,
    )

    # Performance Returns — build list-of-dicts format expected by _compute_performance
    price_dicts = [{"date": dates[i], "close": closes[i]} for i in range(n)]
    performance = _compute_performance(price_dicts)

    # Price data for charts
    price_data = [{"date": dates[i], "open": closes[i], "high": highs[i], "low": lows[i], "close": closes[i]} for i in range(n)]

    return {
        "ticker": ticker,
        "period": period,
        "price": price_data,
        "rsi": rsi_data,
        "sma": sma_data,
        "ema": ema_data,
        "macd": macd_data,
        "bollinger": bb_data,
        "supertrend": st_data,
        "pivot_points": pivots,
        "fibonacci": fib,
        "support_resistance": sr,
        "volume": volume_data,
        "signals": signals,
        "performance": performance,
    }


def main():
    tickers = get_all_tickers()
    total = len(tickers)
    print(f"Refreshing technicals for {total} tickers...")

    ok = 0
    fail = 0

    for i, ticker in enumerate(tickers):
        try:
            result = compute_technicals(ticker, "1y")
            if result is None:
                print(f"  [{i+1}/{total}] {ticker} — SKIPPED (insufficient data)")
                fail += 1
                continue

            # Pass dicts/lists directly — Supabase client handles JSONB serialization
            record = {
                "ticker": ticker,
                "period": "1y",
                "price": result["price"],
                "rsi": result["rsi"],
                "sma": result["sma"],
                "ema": result["ema"],
                "macd": result["macd"],
                "bollinger": result["bollinger"],
                "supertrend": result["supertrend"],
                "pivot_points": result["pivot_points"],
                "fibonacci": result["fibonacci"],
                "support_resistance": result["support_resistance"],
                "volume": result["volume"],
                "signals": result["signals"],
                "performance": result["performance"],
            }

            supabase.table("technicals_cache").upsert(record, on_conflict="ticker").execute()
            ok += 1
            print(f"  [{i+1}/{total}] {ticker} — OK")

        except Exception as e:
            fail += 1
            print(f"  [{i+1}/{total}] {ticker} — FAILED: {e}")

        time.sleep(0.5)  # Be kind to yfinance

    print(f"\nDone: {ok} OK, {fail} failed/skipped out of {total}")


if __name__ == "__main__":
    main()
