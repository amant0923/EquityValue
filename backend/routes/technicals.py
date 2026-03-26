"""Technical analysis indicators for a given ticker."""

from fastapi import APIRouter, HTTPException, Request, Depends
from slowapi import Limiter
from slowapi.util import get_remote_address
import numpy as np
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


def _compute_sma(closes, period):
    if len(closes) < period:
        return []
    result = []
    for i in range(period - 1, len(closes)):
        result.append(float(np.mean(closes[i - period + 1:i + 1])))
    return result


def _compute_ema(closes, period):
    if len(closes) < period:
        return []
    ema = [float(np.mean(closes[:period]))]
    k = 2.0 / (period + 1)
    for i in range(period, len(closes)):
        ema.append(ema[-1] * (1 - k) + closes[i] * k)
    return ema


def _compute_rsi(closes, period=14):
    if len(closes) < period + 1:
        return []
    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    avg_gain = float(np.mean(gains[:period]))
    avg_loss = float(np.mean(losses[:period]))
    rsi_values = []
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        if avg_loss == 0:
            rsi_values.append(100.0)
        else:
            rs = avg_gain / avg_loss
            rsi_values.append(100.0 - 100.0 / (1.0 + rs))
    return rsi_values


def _compute_macd(closes, fast=12, slow=26, signal_period=9):
    ema_fast = _compute_ema(closes, fast)
    ema_slow = _compute_ema(closes, slow)
    if not ema_fast or not ema_slow:
        return [], [], []
    offset = slow - fast
    macd_line = [ema_fast[i + offset] - ema_slow[i] for i in range(len(ema_slow))]
    if len(macd_line) < signal_period:
        return macd_line, [], []
    signal_line = _compute_ema(macd_line, signal_period)
    sig_offset = signal_period - 1
    histogram = [macd_line[i + sig_offset] - signal_line[i] for i in range(len(signal_line))]
    return macd_line, signal_line, histogram


def _compute_bollinger(closes, period=20, std_dev=2):
    if len(closes) < period:
        return [], [], []
    upper, middle, lower = [], [], []
    for i in range(period - 1, len(closes)):
        window = closes[i - period + 1:i + 1]
        m = float(np.mean(window))
        s = float(np.std(window, ddof=0))
        middle.append(m)
        upper.append(m + std_dev * s)
        lower.append(m - std_dev * s)
    return upper, middle, lower


def _compute_supertrend(highs, lows, closes, period=10, multiplier=3):
    if len(closes) < period:
        return [], []
    atr_values = []
    for i in range(1, len(closes)):
        tr = max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1]))
        atr_values.append(tr)
    # Compute ATR using SMA
    if len(atr_values) < period:
        return [], []
    atr = []
    atr_sum = sum(atr_values[:period])
    atr.append(atr_sum / period)
    for i in range(period, len(atr_values)):
        atr.append((atr[-1] * (period - 1) + atr_values[i]) / period)

    supertrend = []
    direction = []
    start = period
    for idx in range(len(atr)):
        ci = start + idx
        if ci >= len(closes):
            break
        hl2 = (highs[ci] + lows[ci]) / 2.0
        upper_band = hl2 + multiplier * atr[idx]
        lower_band = hl2 - multiplier * atr[idx]
        if idx == 0:
            st = upper_band if closes[ci] <= upper_band else lower_band
            d = -1 if closes[ci] <= upper_band else 1
        else:
            prev_st = supertrend[-1]
            prev_d = direction[-1]
            if prev_d == 1:
                lower_band = max(lower_band, prev_st)
                if closes[ci] < lower_band:
                    st = upper_band
                    d = -1
                else:
                    st = lower_band
                    d = 1
            else:
                upper_band = min(upper_band, prev_st)
                if closes[ci] > upper_band:
                    st = lower_band
                    d = 1
                else:
                    st = upper_band
                    d = -1
        supertrend.append(round(st, 4))
        direction.append(d)
    return supertrend, direction


def _compute_pivot_points(high, low, close):
    pivot = (high + low + close) / 3.0
    r1 = 2 * pivot - low
    s1 = 2 * pivot - high
    r2 = pivot + (high - low)
    s2 = pivot - (high - low)
    r3 = high + 2 * (pivot - low)
    s3 = low - 2 * (high - pivot)
    return {
        "pivot": round(pivot, 4), "r1": round(r1, 4), "r2": round(r2, 4), "r3": round(r3, 4),
        "s1": round(s1, 4), "s2": round(s2, 4), "s3": round(s3, 4),
    }


def _compute_fibonacci(high, low):
    diff = high - low
    levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
    prices = [round(high - l * diff, 4) for l in levels]
    return {"levels": levels, "prices": prices}


def _compute_support_resistance(closes, highs, lows, window=20):
    supports = []
    resistances = []
    for i in range(window, len(closes) - window):
        if lows[i] == min(lows[i - window:i + window + 1]):
            supports.append(lows[i])
        if highs[i] == max(highs[i - window:i + window + 1]):
            resistances.append(highs[i])
    # Cluster nearby levels and pick top 3
    def cluster(levels, threshold_pct=0.02):
        if not levels:
            return []
        levels = sorted(levels)
        clusters = [[levels[0]]]
        for l in levels[1:]:
            if abs(l - clusters[-1][-1]) / max(clusters[-1][-1], 0.01) < threshold_pct:
                clusters[-1].append(l)
            else:
                clusters.append([l])
        averaged = [round(np.mean(c), 4) for c in clusters]
        sizes = {round(np.mean(c), 4): len(c) for c in clusters}
        return sorted(averaged, key=lambda x: -sizes.get(x, 0))

    return {
        "support": sorted(cluster(supports))[:3],
        "resistance": sorted(cluster(resistances), reverse=True)[:3],
    }


def _generate_signals(rsi_last, macd_last, macd_signal_last, price, sma_20, sma_50, sma_200, ema_50, bb_upper, bb_lower, supertrend_dir):
    buy = 0
    sell = 0
    neutral = 0

    # RSI
    if rsi_last is not None:
        if rsi_last < 30:
            buy += 1
        elif rsi_last > 70:
            sell += 1
        else:
            neutral += 1

    # MACD
    if macd_last is not None and macd_signal_last is not None:
        if macd_last > macd_signal_last:
            buy += 1
        else:
            sell += 1

    # SMA crossovers
    for sma_val in [sma_20, sma_50, sma_200]:
        if sma_val is not None:
            if price > sma_val:
                buy += 1
            else:
                sell += 1

    # EMA 50
    if ema_50 is not None:
        if price > ema_50:
            buy += 1
        else:
            sell += 1

    # Bollinger
    if bb_upper is not None and bb_lower is not None:
        if price < bb_lower:
            buy += 1
        elif price > bb_upper:
            sell += 1
        else:
            neutral += 1

    # Supertrend
    if supertrend_dir is not None:
        if supertrend_dir == 1:
            buy += 1
        else:
            sell += 1

    total = buy + sell + neutral
    if total == 0:
        overall = "Neutral"
    elif buy > sell + neutral:
        overall = "Strong Buy" if buy >= total * 0.7 else "Buy"
    elif sell > buy + neutral:
        overall = "Strong Sell" if sell >= total * 0.7 else "Sell"
    else:
        overall = "Neutral"

    return {"buy_count": buy, "sell_count": sell, "neutral_count": neutral, "overall": overall}


def _compute_performance(prices):
    """Compute period returns from price history list [{date, close}]."""
    if not prices or len(prices) < 2:
        return {}
    current = prices[-1]["close"]
    result = {}
    trading_days = {"1M": 21, "3M": 63, "6M": 126, "1Y": 252, "3Y": 756, "5Y": 1260}
    for label, days in trading_days.items():
        if len(prices) > days:
            past = prices[-(days + 1)]["close"]
            if past and past > 0:
                result[label] = round((current - past) / past * 100, 2)
    return result


@router.get("/technicals/{ticker}")
@limiter.limit("30/minute")
async def get_technicals(ticker: str, request: Request, period: str = "1y", user: dict = Depends(get_current_user)):
    ticker = validate_ticker(ticker)
    if period not in ("6mo", "1y", "2y", "5y"):
        raise HTTPException(status_code=400, detail="Invalid period. Use 6mo, 1y, 2y, or 5y.")

    cache_key = f"tech:{ticker}:{period}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    history = fetch_price_history(ticker, period)
    if not history or len(history) < 50:
        raise HTTPException(status_code=404, detail="Insufficient price history for technical analysis.")

    dates = [p["date"] for p in history]
    closes = [float(p["close"]) for p in history]
    highs = [float(p.get("high", p["close"])) for p in history]
    lows = [float(p.get("low", p["close"])) for p in history]
    volumes = [int(p.get("volume", 0)) for p in history]

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

    # Performance Returns
    performance = _compute_performance(history)

    # Price data for charts
    price_data = [{"date": dates[i], "open": float(history[i].get("open", closes[i])), "high": highs[i], "low": lows[i], "close": closes[i]} for i in range(n)]

    result = {
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

    cache_set(cache_key, result, ttl=3600)
    return result
