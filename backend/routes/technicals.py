"""Technical analysis indicators for a given ticker.

Data is pre-computed by refresh_technicals.py and served from Supabase.
"""

from fastapi import APIRouter, HTTPException, Request, Depends
from slowapi import Limiter
from slowapi.util import get_remote_address
import numpy as np
import logging

from config import validate_ticker
from auth import get_current_user
from db import get_supabase, get_supabase_service

logger = logging.getLogger(__name__)
router = APIRouter()

try:
    from rate_limit import limiter
except Exception:
    limiter = Limiter(key_func=get_remote_address)


# ── Computation functions (used by refresh_technicals.py) ─────────────────────

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

    if rsi_last is not None:
        if rsi_last < 30:
            buy += 1
        elif rsi_last > 70:
            sell += 1
        else:
            neutral += 1

    if macd_last is not None and macd_signal_last is not None:
        if macd_last > macd_signal_last:
            buy += 1
        else:
            sell += 1

    for sma_val in [sma_20, sma_50, sma_200]:
        if sma_val is not None:
            if price > sma_val:
                buy += 1
            else:
                sell += 1

    if ema_50 is not None:
        if price > ema_50:
            buy += 1
        else:
            sell += 1

    if bb_upper is not None and bb_lower is not None:
        if price < bb_lower:
            buy += 1
        elif price > bb_upper:
            sell += 1
        else:
            neutral += 1

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


# ── API Endpoint (reads from Supabase cache) ─────────────────────────────────

@router.get("/technicals/{ticker}")
@limiter.limit("60/minute")
async def get_technicals(ticker: str, request: Request, period: str = "1y", user: dict = Depends(get_current_user)):
    ticker = validate_ticker(ticker)

    sb = get_supabase_service() or get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    row = sb.table("technicals_cache").select("*").eq("ticker", ticker).limit(1).execute().data
    if not row:
        raise HTTPException(404, "Technical data not yet computed for this ticker. Check back in a few hours.")

    return row[0]
