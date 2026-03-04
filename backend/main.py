from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from data_fetcher import fetch_stock_data, fetch_price_history
from valuation.router import run_valuation
import time

app = FastAPI(title="Stock Valuation API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Simple in-memory cache — avoids burning API quota on repeated searches
_cache = {}
CACHE_TTL = 3600  # 1 hour

def _get_cached(key):
    entry = _cache.get(key)
    if entry and (time.time() - entry["ts"]) < CACHE_TTL:
        return entry["data"]
    return None

def _set_cached(key, data):
    _cache[key] = {"data": data, "ts": time.time()}

@app.get("/")
def root(): return {"message": "ValuEngine API v2"}

@app.get("/valuation/{ticker}")
def get_valuation(ticker: str):
    ticker = ticker.upper().strip()
    cached = _get_cached(f"val:{ticker}")
    if cached:
        print(f"[cache hit] {ticker}")
        return cached
    data = fetch_stock_data(ticker)
    if not data or not data.get("current_price"):
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found or no price data available.")
    result = run_valuation(ticker, data)
    _set_cached(f"val:{ticker}", result)
    return result

@app.get("/history/{ticker}")
def get_history(ticker: str, period: str = "1y"):
    ticker = ticker.upper().strip()
    cache_key = f"hist:{ticker}:{period}"
    cached = _get_cached(cache_key)
    if cached:
        return cached
    history = fetch_price_history(ticker, period)
    if not history:
        raise HTTPException(status_code=404, detail="No price history available.")
    result = {"ticker": ticker, "period": period, "prices": history}
    _set_cached(cache_key, result)
    return result

@app.get("/search/{query}")
def search(query: str):
    from data_fetcher import fetch_stock_data
    return {"results": []}
