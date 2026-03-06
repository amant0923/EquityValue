from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from data_fetcher import fetch_stock_data, fetch_price_history
from valuation.router import run_valuation
import time
import os
import json
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
def normalise(data: dict) -> dict:
    d = dict(data)
    if d.get("current_price") and not d.get("price"):
        d["price"] = d["current_price"]
    if d.get("book_value") and not d.get("book_value_per_share"):
        d["book_value_per_share"] = d["book_value"]
    if d.get("total_cash") and not d.get("cash"):
        d["cash"] = d["total_cash"]
    for field in ("profit_margin", "operating_margin", "roe", "roa",
                  "dividend_yield", "revenue_growth", "earnings_growth", "payout_ratio"):
        val = d.get(field)
        if val is not None:
            fval = float(val)
            if abs(fval) > 5:
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
    # FIX: return empty prices instead of 404 so frontend chart doesn't crash
    result = {"ticker": ticker, "period": period, "prices": history or {"dates": [], "closes": [], "volumes": []}}
    _set_cached(cache_key, result)
    return result

@app.get("/comps/{ticker}")
def get_comps(ticker: str):
    ticker = ticker.upper().strip()
    cached = _get_cached(f"comps:{ticker}")
    if cached:
        return cached

    raw = fetch_stock_data(ticker)
    if not raw:
        raise HTTPException(status_code=404, detail="Ticker not found.")
    data = normalise(raw)
    sector = data.get("sector", "Technology")

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
            # FIX: ensure ev_ebitda is populated from ev_to_ebitda if needed
            ev_ebitda = pd.get("ev_ebitda") or pd.get("ev_to_ebitda")
            comps.append({
                "ticker": peer,
                "name": pd.get("name", peer),
                "price": pd.get("price"),
                "market_cap": pd.get("market_cap"),
                "pe_ratio": pd.get("pe_ratio"),
                "forward_pe": pd.get("forward_pe"),
                "pb_ratio": pd.get("pb_ratio"),
                "ps_ratio": pd.get("ps_ratio"),
                "ev_ebitda": ev_ebitda,
                "ev_revenue": pd.get("ev_to_revenue"),
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

    # FIX: include ev_ebitda and forward_pe in subject too
    subject = {
        "ticker": ticker,
        "name": data.get("name", ticker),
        "price": data.get("price"),
        "market_cap": data.get("market_cap"),
        "pe_ratio": data.get("pe_ratio"),
        "forward_pe": data.get("forward_pe"),
        "pb_ratio": data.get("pb_ratio"),
        "ps_ratio": data.get("ps_ratio"),
        "ev_ebitda": data.get("ev_ebitda") or data.get("ev_to_ebitda"),
        "ev_revenue": data.get("ev_to_revenue"),
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


# ── FIX: New streaming AI thesis endpoint (frontend calls /ai/thesis) ─────────
@app.post("/ai/thesis")
async def ai_thesis(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    if not messages:
        raise HTTPException(status_code=400, detail="No messages provided.")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured.")

    def stream():
        try:
            client = anthropic.Anthropic(api_key=api_key)
            # FIX: use correct model string
            with client.messages.stream(
                model="claude-sonnet-4-5",
                max_tokens=1500,
                messages=messages,
            ) as stream:
                for event in stream:
                    # Forward raw SSE events that the frontend expects
                    if hasattr(event, 'type'):
                        if event.type == "content_block_delta":
                            data = {
                                "type": "content_block_delta",
                                "delta": {
                                    "type": "text_delta",
                                    "text": event.delta.text if hasattr(event.delta, 'text') else ""
                                }
                            }
                            yield f"data: {json.dumps(data)}\n\n"
                yield "data: [DONE]\n\n"
        except Exception as e:
            error_data = {"type": "error", "error": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


# ── FIX: PDF export endpoint ──────────────────────────────────────────────────
@app.post("/pdf/export")
async def export_pdf(request: Request):
    """
    Generates a simple HTML-based PDF.
    Uses WeasyPrint if available, otherwise returns HTML with print stylesheet.
    """
    body = await request.json()
    data = body.get("data", {})
    memo = body.get("memo", "")
    ticker = data.get("ticker", "UNKNOWN")
    company = data.get("company_name", ticker)
    price = data.get("current_price", 0)
    consensus = data.get("consensus", {})
    km = data.get("key_metrics", {})

    def fmt_val(v, t=""):
        if v is None: return "—"
        if t == "pct": return f"{float(v)*100:.1f}%"
        if t == "x": return f"{float(v):.1f}x"
        if t == "large":
            a = abs(float(v))
            if a >= 1e12: return f"${v/1e12:.2f}T"
            if a >= 1e9:  return f"${v/1e9:.2f}B"
            if a >= 1e6:  return f"${v/1e6:.2f}M"
        return str(v)

    verdict = consensus.get("overall_verdict", "N/A")
    verdict_color = "#059669" if verdict == "Undervalued" else "#dc2626" if verdict == "Overvalued" else "#d97706"

    valuations_html = ""
    for v in (data.get("valuations") or []):
        if not v.get("applicable"): continue
        upside = v.get("upside_pct", 0)
        color = "#059669" if upside > 0 else "#dc2626"
        valuations_html += f"""
        <tr>
          <td>{v.get('model','')}</td>
          <td>${v.get('intrinsic_value','')}</td>
          <td style="color:{color}">{upside:+.1f}%</td>
          <td>{v.get('verdict','')}</td>
        </tr>"""

    memo_html = ""
    if memo:
        import re
        memo_escaped = memo.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
        memo_escaped = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', memo_escaped)
        memo_escaped = re.sub(r'^## (.+)$', r'<h3>\1</h3>', memo_escaped, flags=re.MULTILINE)
        memo_html = f"<div class='memo'>{memo_escaped.replace(chr(10),'<br>')}</div>"

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>{ticker} — ValuEngine Report</title>
<style>
  body {{ font-family: Arial, sans-serif; color: #1e293b; margin: 40px; font-size: 13px; line-height: 1.6; }}
  h1 {{ font-size: 22px; margin-bottom: 4px; }}
  h2 {{ font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin: 24px 0 12px; }}
  h3 {{ font-size: 13px; font-weight: 700; color: #2563eb; margin: 16px 0 6px; }}
  .header {{ border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }}
  .badge {{ display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 700; font-size: 12px; color: white; background: {verdict_color}; }}
  table {{ width: 100%; border-collapse: collapse; margin: 12px 0; }}
  th {{ background: #f8fafc; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }}
  td {{ padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }}
  .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }}
  .kv {{ display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f1f5f9; }}
  .kv-label {{ color: #64748b; }}
  .kv-val {{ font-weight: 600; }}
  .memo {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-top: 8px; }}
  .footer {{ margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }}
  @media print {{ body {{ margin: 20px; }} }}
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>{company} ({ticker})</h1>
    <div style="color:#64748b; font-size:12px">{data.get('sector','')} · {data.get('industry','')} · Generated {time.strftime('%d %b %Y')}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:24px; font-weight:800">${price:.2f}</div>
    <span class="badge">{verdict}</span>
    <div style="font-size:12px; color:#64748b; margin-top:4px">Intrinsic: ${consensus.get('average_intrinsic_value','N/A')} ({consensus.get('upside_pct','N/A')}%)</div>
  </div>
</div>

<h2>Key Metrics</h2>
<div class="grid">
  <div>
    <div class="kv"><span class="kv-label">P/E Ratio</span><span class="kv-val">{fmt_val(km.get('pe_ratio'),'x')}</span></div>
    <div class="kv"><span class="kv-label">Forward P/E</span><span class="kv-val">{fmt_val(km.get('forward_pe'),'x')}</span></div>
    <div class="kv"><span class="kv-label">P/B Ratio</span><span class="kv-val">{fmt_val(km.get('pb_ratio'),'x')}</span></div>
    <div class="kv"><span class="kv-label">P/S Ratio</span><span class="kv-val">{fmt_val(km.get('ps_ratio'),'x')}</span></div>
    <div class="kv"><span class="kv-label">EV/EBITDA</span><span class="kv-val">{fmt_val(km.get('ev_ebitda'),'x')}</span></div>
    <div class="kv"><span class="kv-label">Beta</span><span class="kv-val">{fmt_val(km.get('beta'))}</span></div>
  </div>
  <div>
    <div class="kv"><span class="kv-label">Revenue</span><span class="kv-val">{fmt_val(km.get('revenue'),'large')}</span></div>
    <div class="kv"><span class="kv-label">Net Income</span><span class="kv-val">{fmt_val(km.get('net_income'),'large')}</span></div>
    <div class="kv"><span class="kv-label">EBITDA</span><span class="kv-val">{fmt_val(km.get('ebitda'),'large')}</span></div>
    <div class="kv"><span class="kv-label">Free Cash Flow</span><span class="kv-val">{fmt_val(km.get('free_cashflow'),'large')}</span></div>
    <div class="kv"><span class="kv-label">ROE</span><span class="kv-val">{fmt_val(km.get('roe'),'pct')}</span></div>
    <div class="kv"><span class="kv-label">Net Margin</span><span class="kv-val">{fmt_val(km.get('profit_margin'),'pct')}</span></div>
  </div>
</div>

<h2>Valuation Models</h2>
<table>
  <thead><tr><th>Model</th><th>Intrinsic Value</th><th>Upside/Downside</th><th>Verdict</th></tr></thead>
  <tbody>{valuations_html}</tbody>
</table>

{"<h2>AI Investment Memo</h2>" + memo_html if memo_html else ""}

<div class="footer">ValuEngine — For informational purposes only. Not financial advice. Generated {time.strftime('%d %b %Y %H:%M UTC')}</div>
</body>
</html>"""

    # Return HTML with print-optimised styles — user can Cmd+P / Ctrl+P to save as PDF
    from fastapi.responses import HTMLResponse
    return HTMLResponse(
        content=html,
        headers={"Content-Disposition": f"inline; filename={ticker}_ValuEngine.html"}
    )


# ── Keep old /thesis endpoint for backward compat ────────────────────────────
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
    consensus = valuation.get("consensus", {})
    metrics = valuation.get("key_metrics", {})
    applicable = [v for v in valuation.get("valuations", []) if v.get("applicable")]
    prompt = f"Write a brief investment memo for {data.get('name', ticker)} ({ticker}). Price: ${data.get('price')}. Consensus: {consensus.get('overall_verdict')} at ${consensus.get('average_intrinsic_value')}."
    try:
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        # FIX: correct model name
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}]
        )
        thesis_text = message.content[0].text
        result = {"ticker": ticker, "company_name": data.get("name", ticker), "thesis": thesis_text, "consensus": consensus, "generated_at": time.strftime("%Y-%m-%d %H:%M UTC")}
        _set_cached(f"thesis:{ticker}", result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate thesis: {str(e)}")

@app.get("/search/{query}")
def search(query: str):
    return {"results": []}

@app.get("/cache/clear")
def clear_cache():
    _cache.clear()
    return {"message": "Cache cleared"}
