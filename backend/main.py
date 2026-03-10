import re
from pydantic import BaseModel, field_validator
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from data_fetcher import fetch_stock_data, fetch_price_history
from valuation.router import run_valuation
from auth import get_current_user, get_user_profile
from stripe_handler import create_checkout_session, handle_webhook_event, price_id_to_plan
import stripe
import time
from datetime import datetime
import os
import anthropic
from routes.financials import router as financials_router
from routes.intelligence import router as intelligence_router
from routes.summary import router as summary_router

ALLOWED_ORIGINS = [
    "https://equityvalue.ai",
    "https://www.equityvalue.ai",
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:3000",
]

app = FastAPI(title="Stock Valuation API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(financials_router)
app.include_router(intelligence_router)
app.include_router(summary_router)

# ── Ticker validation ────────────────────────────────────────────────────────
TICKER_RE = re.compile(r"^[A-Z]{1,5}$")

def _validate_ticker(ticker: str) -> str:
    t = ticker.upper().strip()
    if not TICKER_RE.match(t):
        raise HTTPException(status_code=400, detail="Invalid ticker format.")
    return t

# ── In-memory cache (1 hour TTL, max 2000 entries) ──────────────────────────
_cache = {}
CACHE_TTL = 3600
CACHE_MAX = 2000

def _get_cached(key):
    entry = _cache.get(key)
    if entry and (time.time() - entry["ts"]) < CACHE_TTL:
        return entry["data"]
    return None

def _set_cached(key, data):
    if len(_cache) >= CACHE_MAX:
        oldest = min(_cache, key=lambda k: _cache[k]["ts"])
        del _cache[oldest]
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
    return {"message": "Equity Valuation API v2"}

@app.get("/valuation/{ticker}")
async def get_valuation(ticker: str, user: dict = Depends(get_current_user)):
    ticker = _validate_ticker(ticker)

    # Check plan limits
    try:
        profile = await get_user_profile(user["sub"])
    except Exception:
        profile = {"plan": "free", "analyses_today": 0}
    plan = profile.get("plan", "free")
    analyses_today = profile.get("analyses_today", 0)
    PLAN_LIMITS = {"free": 1, "pro": 5, "max": 999999}
    limit = PLAN_LIMITS.get(plan, 1)
    if analyses_today >= limit:
        raise HTTPException(status_code=429, detail="Daily analysis limit reached. Upgrade your plan for more.")

    cached = _get_cached(f"val:{ticker}")
    if cached:
        print(f"[cache hit] {ticker}")
        return cached
    # Restrict to S&P 500 stocks only
    try:
        from supabase import create_client
        sb = create_client(
            os.environ.get("SUPABASE_URL", "https://efbtgnplotlshrwbotfp.supabase.co"),
            os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmYnRnbnBsb3Rsc2hyd2JvdGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDEzODIsImV4cCI6MjA4ODQ3NzM4Mn0.grKm3Rh-UtXU3bIz2ajLNiVxbfTECC9cwuslZe_BY-I"),
        )
        exists = sb.table("stock_fundamentals").select("ticker").eq("ticker", ticker).limit(1).execute().data
        if not exists:
            raise HTTPException(status_code=404, detail=f"'{ticker}' is not in the S&P 500. Equity Valuation currently supports S&P 500 stocks only.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[sp500 check] {e}")
    raw = fetch_stock_data(ticker)
    if not raw or not raw.get("current_price"):
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found or no price data available.")
    data = normalise(raw)
    result = run_valuation(ticker, data)
    _set_cached(f"val:{ticker}", result)

    # Increment usage counter (best-effort, don't fail the response)
    try:
        from supabase import create_client as _sc
        from datetime import date
        _sb = _sc(
            os.environ.get("SUPABASE_URL", "https://efbtgnplotlshrwbotfp.supabase.co"),
            os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmYnRnbnBsb3Rsc2hyd2JvdGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDEzODIsImV4cCI6MjA4ODQ3NzM4Mn0.grKm3Rh-UtXU3bIz2ajLNiVxbfTECC9cwuslZe_BY-I"),
        )
        today = date.today().isoformat()
        new_count = (analyses_today + 1) if profile.get("last_analysis_date") == today else 1
        _sb.table("user_profiles").update({
            "analyses_today": new_count,
            "last_analysis_date": today,
        }).eq("id", user["sub"]).execute()
    except Exception as e:
        print(f"[usage increment] {e}")

    return result

@app.get("/history/{ticker}")
async def get_history(ticker: str, period: str = "1y", user: dict = Depends(get_current_user)):
    ticker = _validate_ticker(ticker)
    if period not in ("1mo", "3mo", "6mo", "1y", "2y", "5y"):
        raise HTTPException(status_code=400, detail="Invalid period.")
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
async def get_comps(ticker: str, user: dict = Depends(get_current_user)):
    ticker = _validate_ticker(ticker)
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
async def generate_thesis(ticker: str, user: dict = Depends(get_current_user)):
    ticker = _validate_ticker(ticker)
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
            model="claude-sonnet-4-6",
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
        raise HTTPException(status_code=500, detail="Failed to generate thesis. Please try again.")

@app.get("/search/{query}")
async def search(query: str, user: dict = Depends(get_current_user)):
    if len(query) < 1 or len(query) > 20:
        return {"results": []}
    cached = _get_cached(f"search:{query.upper()}")
    if cached:
        return cached
    try:
        from supabase import create_client
        sb = create_client(
            os.environ.get("SUPABASE_URL", "https://efbtgnplotlshrwbotfp.supabase.co"),
            os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmYnRnbnBsb3Rsc2hyd2JvdGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDEzODIsImV4cCI6MjA4ODQ3NzM4Mn0.grKm3Rh-UtXU3bIz2ajLNiVxbfTECC9cwuslZe_BY-I"),
        )
        q = query.upper()
        # Search by ticker prefix first, then by name
        by_ticker = sb.table("stock_fundamentals")\
            .select("ticker,name,sector")\
            .ilike("ticker", f"{q}%")\
            .limit(5).execute().data
        by_name = sb.table("stock_fundamentals")\
            .select("ticker,name,sector")\
            .ilike("name", f"%{query}%")\
            .limit(5).execute().data
        # Merge, deduplicate, prefer ticker matches first
        seen = set()
        results = []
        for row in (by_ticker + by_name):
            if row["ticker"] not in seen:
                seen.add(row["ticker"])
                results.append({
                    "symbol":   row["ticker"],
                    "name":     row.get("name", row["ticker"]),
                    "type":     "EQUITY",
                    "exchange": "S&P 500",
                })
        out = {"results": results[:7]}
        _set_cached(f"search:{q}", out)
        return out
    except Exception as e:
        print(f"[search] {e}")
        return {"results": []}


class ThesisRequest(BaseModel):
    messages: list

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, v):
        if not v or len(v) > 20:
            raise ValueError("messages must be 1-20 items")
        total_len = sum(len(str(m.get("content", ""))) for m in v if isinstance(m, dict))
        if total_len > 50000:
            raise ValueError("Total message content too long")
        return v

@app.post("/ai/thesis")
async def ai_thesis_stream(payload: ThesisRequest, user: dict = Depends(get_current_user)):
    from fastapi.responses import StreamingResponse
    import json
    messages = payload.messages
    if not messages:
        return {"error": "no messages"}

    client = anthropic.Anthropic()

    async def stream():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=1500,
                messages=messages
            ) as s:
                for text in s.text_stream:
                    yield f"data: {json.dumps({'type':'content_block_delta','delta':{'type':'text_delta','text':text}})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            print(f"[ai/thesis error] {e}")
            yield f"data: {json.dumps({'type':'error','error':'AI generation failed. Please try again.'})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

class PDFRequest(BaseModel):
    data: dict
    memo: str = ""
    monte_carlo: dict | None = None
    lbo: dict | None = None

    @field_validator("memo")
    @classmethod
    def validate_memo(cls, v):
        if len(v) > 100000:
            raise ValueError("Memo too long")
        return v

@app.post("/pdf/export")
async def export_pdf(payload: PDFRequest, user: dict = Depends(get_current_user)):
    from fastapi.responses import Response
    from pdf_generator import generate_pdf
    pdf_bytes = generate_pdf(
        data=payload.data,
        memo=payload.memo,
        monte_carlo=payload.monte_carlo,
        lbo=payload.lbo,
    )
    raw_ticker = payload.data.get("ticker", "report")
    safe_ticker = re.sub(r'[^A-Za-z0-9]', '', raw_ticker)[:10] or "report"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_ticker}_EquityValuation.pdf"'},
    )

@app.get("/screener")
async def screener(sector: str = None, min_pe: float = None, max_pe: float = None,
             min_roe: float = None, min_rev_growth: float = None,
             max_pb: float = None, limit: int = 200, user: dict = Depends(get_current_user)):
    """Filter S&P 500 stocks from Supabase by sector and fundamental metrics."""
    limit = min(limit, 500)
    try:
        from supabase import create_client
        sb = create_client(
            os.environ.get("SUPABASE_URL", "https://efbtgnplotlshrwbotfp.supabase.co"),
            os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmYnRnbnBsb3Rsc2hyd2JvdGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDEzODIsImV4cCI6MjA4ODQ3NzM4Mn0.grKm3Rh-UtXU3bIz2ajLNiVxbfTECC9cwuslZe_BY-I"),
        )
        query = sb.table("stock_fundamentals").select(
            "ticker,name,sector,current_price,market_cap,pe_ratio,pb_ratio,roe,revenue_growth,eps,debt_to_equity"
        )
        if sector and sector not in ("All Sectors", ""):
            query = query.eq("sector", sector)
        if min_pe is not None:
            query = query.gte("pe_ratio", min_pe)
        if max_pe is not None:
            query = query.lte("pe_ratio", max_pe)
        if min_roe is not None:
            # roe stored as decimal (0.15 = 15%)
            query = query.gte("roe", min_roe / 100)
        if min_rev_growth is not None:
            query = query.gte("revenue_growth", min_rev_growth / 100)
        if max_pb is not None:
            query = query.lte("pb_ratio", max_pb)

        rows = query.order("market_cap", desc=True).limit(limit).execute().data
        return {"results": rows, "count": len(rows)}
    except Exception as e:
        print(f"[screener] {e}")
        raise HTTPException(status_code=500, detail="Screener error. Please try again.")

@app.post("/stripe/create-checkout")
async def create_checkout(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    plan = body.get("plan", "pro")
    try:
        session = create_checkout_session(
            user_id=user["sub"],
            user_email=user.get("email", ""),
            plan=plan,
            success_url="https://equityvalue.ai?payment=success",
            cancel_url="https://equityvalue.ai?payment=cancelled",
        )
        return {"checkout_url": session.url}
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid plan selected.")
    except Exception as e:
        print(f"[stripe checkout error] {e}")
        raise HTTPException(status_code=500, detail="Could not create checkout session.")

@app.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = handle_webhook_event(payload, sig)
    except Exception as e:
        print(f"[stripe webhook sig error] {e}")
        raise HTTPException(status_code=400, detail="Webhook signature verification failed.")

    try:
        from supabase import create_client
        sb = create_client(
            os.environ.get("SUPABASE_URL", ""),
            os.environ.get("SUPABASE_KEY", ""),
        )

        if event["type"] == "checkout.session.completed":
            session_obj = event["data"]["object"]
            user_id = session_obj["metadata"]["user_id"]
            subscription = stripe.Subscription.retrieve(session_obj["subscription"])
            price_id = subscription["items"]["data"][0]["price"]["id"]
            plan = price_id_to_plan(price_id)
            sb.table("user_profiles").update({
                "plan": plan,
                "stripe_customer_id": session_obj.get("customer", ""),
            }).eq("id", user_id).execute()

        elif event["type"] == "customer.subscription.deleted":
            sub_obj = event["data"]["object"]
            customer_id = sub_obj.get("customer")
            if customer_id:
                sb.table("user_profiles").update({"plan": "free"}).eq("stripe_customer_id", customer_id).execute()

    except Exception as e:
        print(f"[stripe webhook processing error] {e}")

    return {"status": "ok"}

@app.post("/cache/clear")
async def clear_cache(user: dict = Depends(get_current_user)):
    _cache.clear()
    return {"message": "Cache cleared"}
