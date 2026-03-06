from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from data_fetcher import fetch_stock_data, fetch_price_history
from valuation.router import run_valuation
import time
from datetime import datetime
import os
import anthropic

app = FastAPI(title="Stock Valuation API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ── In-memory cache (1 hour TTL) ─────────────────────────────────────────────
_cache = {}
CACHE_TTL = 3600

def _get_cached(key):
    entry = _cache.get(key)
    if entry and (time.time() - entry["ts"]) < CACHE_TTL:
        return entry["data"]
    return None

def _set_cached(key, data):
    _cache[key] = {"data": data, "ts": time.time()}

# ── Field normalisation ───────────────────────────────────────────────────────
# Our fetcher uses current_price / book_value / total_cash
# The models/router expect price / book_value_per_share / cash
def normalise(data: dict) -> dict:
    d = dict(data)
    # Price
    if d.get("current_price") and not d.get("price"):
        d["price"] = d["current_price"]
    # Book value per share
    if d.get("book_value") and not d.get("book_value_per_share"):
        d["book_value_per_share"] = d["book_value"]
    # Cash
    if d.get("total_cash") and not d.get("cash"):
        d["cash"] = d["total_cash"]
    # Map ev_to_ebitda -> ev_ebitda
    if not d.get("ev_ebitda"):
        d["ev_ebitda"] = d.get("ev_to_ebitda")

    # Calculate ev_ebitda from EV / EBITDA if still missing
    if not d.get("ev_ebitda"):
        ev     = d.get("enterprise_value")
        ebitda = d.get("ebitda")
        if ev and ebitda and float(ebitda) > 0:
            d["ev_ebitda"] = round(float(ev) / float(ebitda), 2)

    # Calculate ev_to_revenue from EV / Revenue if missing
    if not d.get("ev_to_revenue"):
        ev  = d.get("enterprise_value")
        rev = d.get("revenue")
        if ev and rev and float(rev) > 0:
            d["ev_to_revenue"] = round(float(ev) / float(rev), 2)

    # Calculate ebitda_margin if missing
    if not d.get("ebitda_margin"):
        ebitda = d.get("ebitda")
        rev    = d.get("revenue")
        if ebitda and rev and rev > 0:
            d["ebitda_margin"] = ebitda / rev

    # Fix percentage fields — Finnhub returns decimals (0.27) not percent (27)
    for field in ("profit_margin", "operating_margin", "roe", "roa",
                  "dividend_yield", "revenue_growth", "earnings_growth", "payout_ratio"):
        val = d.get(field)
        if val is not None:
            fval = float(val)
            if abs(fval) > 5:  # clearly already a percentage, normalise to decimal
                d[field] = fval / 100
    return d

@app.get("/")
def root():
    return {"message": "ValuEngine API v2"}

@app.get("/valuation/{ticker}")
def get_valuation(ticker: str):
    ticker = ticker.upper().strip()
    cached = _get_cached(f"val:{ticker}")
    if cached:
        print(f"[cache hit] {ticker}")
        return cached
    raw = fetch_stock_data(ticker)
    if not raw or not raw.get("current_price"):
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found or no price data available.")
    data = normalise(raw)
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

@app.get("/comps/{ticker}")
def get_comps(ticker: str):
    ticker = ticker.upper().strip()
    cached = _get_cached(f"comps:{ticker}")
    if cached:
        return cached

    # Get the main stock data first
    raw = fetch_stock_data(ticker)
    if not raw:
        raise HTTPException(status_code=404, detail="Ticker not found.")
    data = normalise(raw)
    sector = data.get("sector", "Technology")

    # Sector peer tickers
    SECTOR_PEERS = {
        "Technology": ["MSFT", "GOOGL", "META", "NVDA", "AMZN"],
        "Information Technology": ["MSFT", "GOOGL", "META", "NVDA", "AMZN"],
        "Consumer Electronics": ["MSFT", "GOOGL", "META", "NVDA", "SAMSUNG"],
        "Healthcare": ["JNJ", "UNH", "PFE", "ABBV", "MRK"],
        "Health Care": ["JNJ", "UNH", "PFE", "ABBV", "MRK"],
        "Financial Services": ["JPM", "BAC", "WFC", "GS", "MS"],
        "Consumer Cyclical": ["AMZN", "TSLA", "HD", "MCD", "NKE"],
        "Consumer Discretionary": ["AMZN", "TSLA", "HD", "MCD", "NKE"],
        "Consumer Staples": ["PG", "KO", "PEP", "WMT", "COST"],
        "Energy": ["XOM", "CVX", "COP", "SLB", "EOG"],
        "Industrials": ["HON", "UPS", "CAT", "BA", "GE"],
        "Communication Services": ["GOOGL", "META", "NFLX", "DIS", "T"],
        "Utilities": ["NEE", "DUK", "SO", "D", "AEP"],
        "Real Estate": ["AMT", "PLD", "CCI", "EQIX", "PSA"],
        "Materials": ["LIN", "APD", "ECL", "NEM", "FCX"],
    }
    peers = [t for t in SECTOR_PEERS.get(sector, ["MSFT", "GOOGL", "META", "NVDA", "AMZN"]) if t != ticker][:5]

    comps = []
    for peer in peers:
        try:
            peer_raw = fetch_stock_data(peer)
            if not peer_raw or not peer_raw.get("current_price"):
                continue
            pd = normalise(peer_raw)
            comps.append({
                "ticker": peer,
                "name": pd.get("name", peer),
                "price": pd.get("price"),
                "market_cap": pd.get("market_cap"),
                "pe_ratio": pd.get("pe_ratio"),
                "pb_ratio": pd.get("pb_ratio"),
                "ps_ratio": pd.get("ps_ratio"),
                "ev_ebitda": pd.get("ev_ebitda") or pd.get("ev_to_ebitda"),
                "ev_revenue": pd.get("ev_to_revenue") or pd.get("ev_revenue"),
                "ebitda_margin": pd.get("ebitda_margin"),
                "forward_pe": pd.get("forward_pe"),
                "revenue_growth": pd.get("revenue_growth"),
                "profit_margin": pd.get("profit_margin"),
                "roe": pd.get("roe"),
                "beta": pd.get("beta"),
                "dividend_yield": pd.get("dividend_yield"),
                "eps": pd.get("eps"),
            })
        except Exception as e:
            print(f"[comps] error fetching {peer}: {e}")
            continue

    # Include the subject company
    subject = {
        "ticker": ticker,
        "name": data.get("name", ticker),
        "price": data.get("price"),
        "market_cap": data.get("market_cap"),
        "pe_ratio": data.get("pe_ratio"),
        "pb_ratio": data.get("pb_ratio"),
        "ps_ratio": data.get("ps_ratio"),
        "ev_ebitda": data.get("ev_ebitda") or data.get("ev_to_ebitda"),
        "ev_revenue": data.get("ev_to_revenue") or data.get("ev_revenue"),
        "ebitda_margin": data.get("ebitda_margin"),
        "forward_pe": data.get("forward_pe"),
        "revenue_growth": data.get("revenue_growth"),
        "profit_margin": data.get("profit_margin"),
        "roe": data.get("roe"),
        "beta": data.get("beta"),
        "dividend_yield": data.get("dividend_yield"),
        "eps": data.get("eps"),
        "is_subject": True,
    }

    result = {"ticker": ticker, "sector": sector, "subject": subject, "peers": comps}
    _set_cached(f"comps:{ticker}", result)
    return result

@app.post("/thesis/{ticker}")
def generate_thesis(ticker: str):
    ticker = ticker.upper().strip()
    cached = _get_cached(f"thesis:{ticker}")
    if cached:
        return cached

    raw = fetch_stock_data(ticker)
    if not raw or not raw.get("current_price"):
        raise HTTPException(status_code=404, detail="Ticker not found.")
    data = normalise(raw)
    valuation = run_valuation(ticker, data)

    # Build context for Claude
    consensus = valuation.get("consensus", {})
    metrics = valuation.get("key_metrics", {})
    applicable = [v for v in valuation.get("valuations", []) if v.get("applicable")]

    today = datetime.utcnow().strftime('%d %B %Y')
    prompt = f"""You are a senior equity research analyst at a top-tier investment bank.
Today's date is {today}. Use this exact date in the memo header — do not use any other date.
Write a concise but comprehensive investment memo for {data.get('name', ticker)} ({ticker}).

COMPANY DATA:
- Sector: {data.get('sector', 'N/A')} | Industry: {data.get('industry', 'N/A')}
- Current Price: ${data.get('price', 'N/A')}
- Market Cap: {f"${data['market_cap']:,.0f}" if data.get('market_cap') else 'N/A'}
- Revenue: {f"${data['revenue']:,.0f}" if data.get('revenue') else 'N/A'}
- EBITDA: {f"${data['ebitda']:,.0f}" if data.get('ebitda') else 'N/A'}
- Net Income: {f"${data['net_income']:,.0f}" if data.get('net_income') else 'N/A'}
- Free Cash Flow: {f"${data['free_cashflow']:,.0f}" if data.get('free_cashflow') else 'N/A'}

KEY METRICS:
- P/E: {metrics.get('pe_ratio', 'N/A')} | Forward P/E: {data.get('forward_pe', 'N/A')}
- EV/EBITDA: {metrics.get('ev_ebitda', 'N/A')} | P/S: {metrics.get('ps_ratio', 'N/A')}
- ROE: {metrics.get('roe', 'N/A')} | Profit Margin: {metrics.get('profit_margin', 'N/A')}
- Revenue Growth: {metrics.get('revenue_growth', 'N/A')} | Beta: {metrics.get('beta', 'N/A')}
- Debt/Equity: {data.get('debt_to_equity', 'N/A')}

VALUATION MODELS APPLIED:
{chr(10).join([f"- {v['model']}: ${v['intrinsic_value']} ({v['verdict']}, {v['upside_pct']}% upside)" for v in applicable])}

CONSENSUS: {consensus.get('overall_verdict', 'N/A')} at ${consensus.get('average_intrinsic_value', 'N/A')} ({consensus.get('upside_pct', 'N/A')}% vs current)

Write the memo in this exact structure:
## Investment Thesis
[2-3 sentence summary of the overall investment case]

## Bull Case
[3 key reasons the stock could outperform — be specific with numbers]

## Bear Case  
[3 key risks that could cause underperformance — be specific]

## Valuation Assessment
[Analysis of the valuation models applied and what they collectively suggest]

## Recommendation
[Clear BUY / HOLD / SELL with price target and key catalysts to watch]

Be direct, analytical, and use specific financial data. Write like a professional analyst, not a chatbot."""

    try:
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        message = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}]
        )
        thesis_text = message.content[0].text
        result = {
            "ticker": ticker,
            "company_name": data.get("name", ticker),
            "thesis": thesis_text,
            "consensus": consensus,
            "generated_at": time.strftime("%Y-%m-%d %H:%M UTC"),
        }
        _set_cached(f"thesis:{ticker}", result)
        return result
    except Exception as e:
        print(f"[thesis error] {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate thesis: {str(e)}")

@app.get("/search/{query}")
def search(query: str):
    if len(query) < 1:
        return {"results": []}
    cached = _get_cached(f"search:{query.upper()}")
    if cached:
        return cached
    try:
        import yfinance as yf
        result = yf.Search(query, max_results=7)
        quotes = result.quotes if hasattr(result, "quotes") else []
        results = []
        for q in quotes:
            symbol = q.get("symbol", "")
            name   = q.get("longname") or q.get("shortname") or symbol
            etype  = q.get("quoteType", "")
            exch   = q.get("exchDisp") or q.get("exchange", "")
            if symbol and etype in ("EQUITY", "ETF"):
                results.append({"symbol": symbol, "name": name, "type": etype, "exchange": exch})
        out = {"results": results[:7]}
        _set_cached(f"search:{query.upper()}", out)
        return out
    except Exception as e:
        print(f"[search] {e}")
        return {"results": []}


class ThesisRequest(BaseModel):
    messages: list

@app.post("/ai/thesis")
async def ai_thesis_stream(payload: ThesisRequest):
    from fastapi.responses import StreamingResponse
    import anthropic, json
    messages = payload.messages
    if not messages:
        return {"error": "no messages"}

    client = anthropic.Anthropic()

    async def stream():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-5",
                max_tokens=1500,
                messages=messages
            ) as s:
                for text in s.text_stream:
                    yield f"data: {json.dumps({'type':'content_block_delta','delta':{'type':'text_delta','text':text}})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            print(f"[ai/thesis error] {e}")
            yield f"data: {json.dumps({'type':'error','error':str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.get("/cache/clear")
def clear_cache():
    _cache.clear()
    return {"message": "Cache cleared"}
