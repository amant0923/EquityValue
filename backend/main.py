from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pdf_generator import generate_pdf
from fastapi.middleware.cors import CORSMiddleware
from data_fetcher import fetch_stock_data, fetch_price_history
from valuation.router import run_valuation

app = FastAPI(title="Stock Valuation API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "ValuEngine API v2"}

@app.get("/valuation/{ticker}")
def get_valuation(ticker: str):
    ticker = ticker.upper().strip()
    data = fetch_stock_data(ticker)
    # FIX: field is "current_price" not "price"
    if not data or not data.get("current_price"):
        raise HTTPException(
            status_code=404,
            detail=f"Ticker '{ticker}' not found or no price data available.",
        )
    return run_valuation(ticker, data)

@app.get("/history/{ticker}")
def get_history(ticker: str, period: str = "1y"):
    ticker = ticker.upper().strip()
    history = fetch_price_history(ticker, period)
    if not history:
        raise HTTPException(status_code=404, detail="No price history available.")
    return {"ticker": ticker, "period": period, "prices": history}

@app.get("/search/{query}")
def search(query: str):
    """Simple ticker search using Yahoo Finance autocomplete."""
    import requests
    try:
        r = requests.get(
            "https://query2.finance.yahoo.com/v1/finance/search",
            params={"q": query, "quotesCount": 10, "newsCount": 0},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=8,
        )
        quotes = r.json().get("quotes", [])
        results = [
            {
                "ticker": q.get("symbol", ""),
                "name": q.get("longname") or q.get("shortname", ""),
                "exchange": q.get("exchDisp", ""),
                "type": q.get("quoteType", ""),
            }
            for q in quotes
            if q.get("symbol")
        ]
    except Exception:
        results = []
    return {"results": results}

# Sector peer map — representative liquid peers per sector
SECTOR_PEERS = {
    "Technology":             ["MSFT","AAPL","GOOGL","META","NVDA","AMD","INTC","CRM","ADBE","ORCL"],
    "Information Technology": ["MSFT","AAPL","GOOGL","META","NVDA","AMD","INTC","CRM","ADBE","ORCL"],
    "Healthcare":             ["JNJ","UNH","PFE","ABBV","MRK","LLY","TMO","ABT","DHR","BMY"],
    "Health Care":            ["JNJ","UNH","PFE","ABBV","MRK","LLY","TMO","ABT","DHR","BMY"],
    "Financial Services":     ["JPM","BAC","WFC","GS","MS","C","BLK","AXP","USB","PNC"],
    "Consumer Cyclical":      ["AMZN","TSLA","HD","MCD","NKE","SBUX","TGT","LOW","BKNG","GM"],
    "Consumer Discretionary": ["AMZN","TSLA","HD","MCD","NKE","SBUX","TGT","LOW","BKNG","GM"],
    "Consumer Staples":       ["PG","KO","PEP","WMT","COST","PM","MO","CL","GIS","K"],
    "Energy":                 ["XOM","CVX","COP","SLB","EOG","PXD","MPC","VLO","OXY","HAL"],
    "Industrials":            ["BA","HON","UPS","CAT","GE","LMT","RTX","DE","MMM","ETN"],
    "Materials":              ["LIN","APD","SHW","FCX","NEM","NUE","ALB","CE","IFF","PPG"],
    "Real Estate":            ["PLD","AMT","EQIX","CCI","PSA","O","WELL","DLR","AVB","EQR"],
    "Utilities":              ["NEE","DUK","SO","D","AEP","EXC","SRE","XEL","ED","ES"],
    "Communication Services": ["GOOGL","META","NFLX","DIS","CMCSA","T","VZ","TMUS","WBD","SNAP"],
    "default":                ["AAPL","MSFT","GOOGL","AMZN","META"],
}

@app.get("/comps/{ticker}")
def get_comps(ticker: str):
    """Fetch comparable company data for sector peers."""
    ticker = ticker.upper().strip()
    base = fetch_stock_data(ticker)
    if not base or not base.get("current_price"):
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found.")
    
    sector = base.get("sector", "default")
    peers_all = SECTOR_PEERS.get(sector, SECTOR_PEERS["default"])
    # Exclude the ticker itself, take up to 6 peers
    peers = [p for p in peers_all if p != ticker][:6]
    
    import concurrent.futures
    def fetch_peer(t):
        try:
            d = fetch_stock_data(t)
            if not d or not d.get("current_price"):
                return None
            km = d
            ev = km.get("enterprise_value")
            ebitda = km.get("ebitda")
            revenue = km.get("revenue")
            return {
                "ticker":        t,
                "name":          km.get("name", t),
                "market_cap":    km.get("market_cap"),
                "current_price": km.get("current_price"),
                "pe_ratio":      km.get("pe_ratio"),
                "forward_pe":    km.get("forward_pe"),
                "ev_ebitda":     km.get("ev_to_ebitda") or (ev/ebitda if ev and ebitda and ebitda > 0 else None),
                "ev_revenue":    km.get("ev_to_revenue") or (ev/revenue if ev and revenue and revenue > 0 else None),
                "ps_ratio":      km.get("ps_ratio"),
                "pb_ratio":      km.get("pb_ratio"),
                "revenue_growth":km.get("revenue_growth"),
                "ebitda_margin": (ebitda/revenue) if ebitda and revenue and revenue > 0 else None,
                "profit_margin": km.get("profit_margin"),
                "roe":           km.get("roe"),
                "beta":          km.get("beta"),
                "dividend_yield":km.get("dividend_yield"),
            }
        except Exception:
            return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        peer_data = list(ex.map(fetch_peer, peers))
    
    peer_data = [p for p in peer_data if p is not None]
    
    # Build subject company row
    base_ev = base.get("enterprise_value")
    base_ebitda = base.get("ebitda")
    base_revenue = base.get("revenue")
    subject = {
        "ticker":        ticker,
        "name":          base.get("name", ticker),
        "market_cap":    base.get("market_cap"),
        "current_price": base.get("current_price"),
        "pe_ratio":      base.get("pe_ratio"),
        "forward_pe":    base.get("forward_pe"),
        "ev_ebitda":     base.get("ev_to_ebitda") or (base_ev/base_ebitda if base_ev and base_ebitda and base_ebitda > 0 else None),
        "ev_revenue":    base.get("ev_to_revenue") or (base_ev/base_revenue if base_ev and base_revenue and base_revenue > 0 else None),
        "ps_ratio":      base.get("ps_ratio"),
        "pb_ratio":      base.get("pb_ratio"),
        "revenue_growth":base.get("revenue_growth"),
        "ebitda_margin": (base_ebitda/base_revenue) if base_ebitda and base_revenue and base_revenue > 0 else None,
        "profit_margin": base.get("profit_margin"),
        "roe":           base.get("roe"),
        "beta":          base.get("beta"),
        "dividend_yield":base.get("dividend_yield"),
        "is_subject":    True,
    }

    return {
        "ticker": ticker,
        "sector": sector,
        "subject": subject,
        "peers":   peer_data,
    }

@app.post("/ai/thesis")
async def generate_thesis(payload: dict):
    """Proxy to Anthropic API — keeps API key server-side."""
    import os, httpx
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set on server.")

    from fastapi.responses import StreamingResponse

    async def stream():
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST",
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 1500,
                    "stream": True,
                    "messages": payload.get("messages", []),
                },
            ) as response:
                async for chunk in response.aiter_bytes():
                    yield chunk

    return StreamingResponse(stream(), media_type="text/event-stream")

@app.post("/pdf/export")
def export_pdf(payload: dict):
    """Generate PDF from full result data + optional AI memo, Monte Carlo and LBO passed from frontend."""
    import datetime
    data         = payload.get("data", {})
    memo         = payload.get("memo", "")
    monte_carlo  = payload.get("monte_carlo")
    lbo          = payload.get("lbo")
    ticker       = (data.get("ticker") or "REPORT").upper()

    if not data:
        raise HTTPException(status_code=400, detail="No data provided.")

    pdf_bytes = generate_pdf(data, memo=memo, monte_carlo=monte_carlo, lbo=lbo)
    filename  = f"{ticker}_ValuEngine_{datetime.datetime.now().strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

