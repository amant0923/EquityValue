import numpy as np
import warnings
import requests
import os
import time
warnings.filterwarnings("ignore")

try:
    import yfinance as yf
    USE_YFINANCE = True
except ImportError:
    USE_YFINANCE = False

FINNHUB_KEY  = os.environ.get("FINNHUB_KEY", "")
RAPIDAPI_KEY = os.environ.get("RAPIDAPI_KEY", "")

def _safe_val(val, default=None):
    if val is None: return default
    if isinstance(val, str) and val in ("None", "N/A", "-", "", "nan"): return default
    try:
        f = float(val)
        return None if (np.isnan(f) or np.isinf(f)) else f
    except (TypeError, ValueError):
        return default

# ── Finnhub ──────────────────────────────────────────────────────────────────
def fetch_finnhub(ticker: str) -> dict:
    if not FINNHUB_KEY:
        return {}
    result = {}
    base = "https://finnhub.io/api/v1"
    h = {"X-Finnhub-Token": FINNHUB_KEY}

    # Quote (price)
    try:
        r = requests.get(f"{base}/quote", params={"symbol": ticker}, headers=h, timeout=10)
        d = r.json()
        result["current_price"] = _safe_val(d.get("c"))
        result["52w_high"]      = _safe_val(d.get("h"))
        result["52w_low"]       = _safe_val(d.get("l"))
    except Exception as e:
        print(f"[finnhub quote] {e}")

    # Company profile
    try:
        r = requests.get(f"{base}/stock/profile2", params={"symbol": ticker}, headers=h, timeout=10)
        d = r.json()
        result["name"]               = d.get("name", ticker)
        result["sector"]             = d.get("finnhubIndustry", "Unknown")
        result["industry"]           = d.get("finnhubIndustry", "Unknown")
        result["market_cap"]         = _safe_val(d.get("marketCapitalization"))
        if result["market_cap"]:
            result["market_cap"] *= 1_000_000  # Finnhub returns in millions
        result["shares_outstanding"] = _safe_val(d.get("shareOutstanding"))
        if result["shares_outstanding"]:
            result["shares_outstanding"] *= 1_000_000
        result["website"]            = d.get("weburl", "")
    except Exception as e:
        print(f"[finnhub profile] {e}")

    # Basic financials (key metrics)
    try:
        r = requests.get(f"{base}/stock/metric", params={"symbol": ticker, "metric": "all"}, headers=h, timeout=10)
        d = r.json().get("metric", {})
        result["52w_high"]         = _safe_val(d.get("52WeekHigh")) or result.get("52w_high")
        result["52w_low"]          = _safe_val(d.get("52WeekLow"))  or result.get("52w_low")
        result["beta"]             = _safe_val(d.get("beta"))
        result["pe_ratio"]         = _safe_val(d.get("peBasicExclExtraTTM") or d.get("peTTM"))
        result["forward_pe"]       = _safe_val(d.get("forwardPE"))
        result["pb_ratio"]         = _safe_val(d.get("pbQuarterly") or d.get("pbAnnual"))
        result["ps_ratio"]         = _safe_val(d.get("psAnnual") or d.get("psTTM"))
        result["peg_ratio"]        = _safe_val(d.get("pegAnnual"))
        result["eps"]              = _safe_val(d.get("epsBasicExclExtraTTM") or d.get("epsTTM"))
        result["book_value"]       = _safe_val(d.get("bookValuePerShareAnnual") or d.get("bookValuePerShareQuarterly"))
        raw_yield = _safe_val(d.get("dividendYieldIndicatedAnnual"))
        result["dividend_yield"] = round(float(raw_yield) / 100, 6) if raw_yield is not None else None
        result["dividend_rate"]    = _safe_val(d.get("dividendPerShareAnnual"))
        result["payout_ratio"]     = _safe_val(d.get("payoutRatioAnnual") or d.get("payoutRatioTTM"))
        result["roe"]              = _safe_val(d.get("roeTTM") or d.get("roeRfy"))
        result["roa"]              = _safe_val(d.get("roaTTM") or d.get("roaRfy"))
        result["revenue_growth"]   = _safe_val(d.get("revenueGrowthTTMYoy") or d.get("revenueGrowth3Y"))
        result["earnings_growth"]  = _safe_val(d.get("epsGrowthTTMYoy") or d.get("epsGrowth3Y"))
        result["profit_margin"]    = _safe_val(d.get("netProfitMarginTTM") or d.get("netProfitMarginAnnual"))
        result["operating_margin"] = _safe_val(d.get("operatingMarginTTM") or d.get("operatingMarginAnnual"))
        result["current_ratio"]    = _safe_val(d.get("currentRatioQuarterly") or d.get("currentRatioAnnual"))
        result["debt_to_equity"]   = _safe_val(d.get("totalDebt/totalEquityAnnual") or d.get("longTermDebt/equityAnnual"))
        result["ev_to_ebitda"]     = _safe_val(d.get("evToEbitdaTTM") or d.get("evToEbitdaAnnual"))
        result["ev_to_revenue"]    = _safe_val(d.get("evToSalesTTM") or d.get("evToSalesAnnual"))
        result["enterprise_value"] = _safe_val(d.get("enterpriseValue"))
        if result["enterprise_value"]:
            result["enterprise_value"] *= 1_000_000
        result["revenue"]          = _safe_val(d.get("revenueTTM") or d.get("revenueAnnual"))
        if result["revenue"] and result["revenue"] < 1_000_000:
            result["revenue"] *= 1_000_000
        # EBITDA - Finnhub returns in millions for these
        ebitda_raw = _safe_val(d.get("ebitdaTTM") or d.get("ebitdaAnnual"))
        if ebitda_raw is not None:
            result["ebitda"] = ebitda_raw * 1_000_000 if abs(ebitda_raw) < 100_000 else ebitda_raw
        # FCF - Finnhub returns in millions
        fcf_raw = _safe_val(d.get("freeCashFlowTTM") or d.get("freeCashFlowAnnual"))
        if fcf_raw is not None:
            result["free_cashflow"] = fcf_raw * 1_000_000 if abs(fcf_raw) < 100_000 else fcf_raw
        # Debt - Finnhub returns in millions
        debt_raw = _safe_val(d.get("totalDebtAnnual") or d.get("totalDebtQuarterly") or d.get("netDebtAnnual"))
        if debt_raw is not None:
            result["total_debt"] = debt_raw * 1_000_000 if abs(debt_raw) < 100_000 else debt_raw
        # Net income - Finnhub returns in millions
        ni_raw = _safe_val(d.get("netIncomeAnnual") or d.get("netIncomeTTM"))
        if ni_raw is not None:
            result["net_income"] = ni_raw * 1_000_000 if abs(ni_raw) < 100_000 else ni_raw
        result["gross_profit"] = None  # not available directly from metrics
    except Exception as e:
        print(f"[finnhub metrics] {e}")

    # Financials (income statement for full numbers)
    try:
        r = requests.get(f"{base}/stock/financials-reported",
                         params={"symbol": ticker, "freq": "annual"}, headers=h, timeout=15)
        d = r.json()
        reports = d.get("data", [])
        if reports:
            rep = reports[0]
            ic = rep.get("report", {}).get("ic", [])
            bs = rep.get("report", {}).get("bs", [])
            cf = rep.get("report", {}).get("cf", [])

            def find(items, *labels):
                for item in items:
                    label = (item.get("label") or item.get("concept") or "").lower()
                    for l in labels:
                        if l.lower() in label:
                            v = _safe_val(item.get("value"))
                            if v is not None: return v
                return None

            result["revenue"]      = result.get("revenue")      or find(ic, "revenue", "net sales", "total revenue")
            result["gross_profit"] = result.get("gross_profit") or find(ic, "gross profit", "gross margin")
            result["ebitda"]       = result.get("ebitda")       or find(ic, "ebitda", "earnings before interest")
            result["net_income"]   = result.get("net_income")   or find(ic, "net income", "net earnings", "net loss")
            result["total_debt"]   = result.get("total_debt")   or find(bs, "long-term debt", "long term debt", "total debt", "notes payable")
            result["total_cash"]   = result.get("total_cash")   or find(bs, "cash and cash equivalents", "cash and short", "cash")
            result["operating_cashflow"] = find(cf, "operating activities", "operating cash", "net cash from operating")
            result["free_cashflow"] = result.get("free_cashflow") or find(cf, "free cash flow", "free cashflow")
            if not result.get("free_cashflow"):
                op    = result.get("operating_cashflow")
                capex = find(cf, "capital expenditure", "purchase of property", "acquisition of property", "payments for acquisition")
                if op and capex:
                    result["free_cashflow"] = op - abs(capex)

    except Exception as e:
        print(f"[finnhub financials] {e}")

    # ── Fallback calculations from what we have ──────────────────────────────
    # Calculate EBITDA from margins if still missing
    if not result.get("ebitda"):
        rev = result.get("revenue")
        op_margin = result.get("operating_margin")
        ni = result.get("net_income")
        if rev and op_margin and abs(float(op_margin)) <= 1.0:
            result["ebitda"] = rev * float(op_margin) * 1.1
        elif ni:
            result["ebitda"] = ni * 1.4

    # Calculate FCF if still missing
    if not result.get("free_cashflow"):
        op = result.get("operating_cashflow")
        ni = result.get("net_income")
        if op:
            result["free_cashflow"] = op * 0.85
        elif ni:
            result["free_cashflow"] = ni

    # Analyst recommendations & target price
    try:
        r = requests.get(f"{base}/stock/price-target", params={"symbol": ticker}, headers=h, timeout=10)
        d = r.json()
        result["target_price"] = _safe_val(d.get("targetMean"))
        result["target_high"]  = _safe_val(d.get("targetHigh"))
        result["target_low"]   = _safe_val(d.get("targetLow"))
    except Exception as e:
        print(f"[finnhub target] {e}")

    try:
        r = requests.get(f"{base}/stock/recommendation", params={"symbol": ticker}, headers=h, timeout=10)
        d = r.json()
        if isinstance(d, list) and d:
            latest = d[0]
            total = sum([latest.get("strongBuy",0), latest.get("buy",0),
                        latest.get("hold",0), latest.get("sell",0), latest.get("strongSell",0)])
            buy   = latest.get("strongBuy",0) + latest.get("buy",0)
            if total > 0:
                result["recommendation"] = "buy" if buy/total > 0.5 else "hold"
                result["analyst_count"]  = total
    except Exception as e:
        print(f"[finnhub rec] {e}")

    return result

# ── RapidAPI fallback for price ───────────────────────────────────────────────
def fetch_rapidapi(ticker: str) -> dict:
    if not RAPIDAPI_KEY:
        return {}
    result = {}
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "yahoo-finance15.p.rapidapi.com",
    }
    try:
        r = requests.get(
            "https://yahoo-finance15.p.rapidapi.com/api/v1/markets/stock/quotes",
            headers=headers, params={"ticker": ticker}, timeout=15,
        )
        body = r.json().get("body", [{}])
        info = body[0] if isinstance(body, list) and body else body
        result["current_price"]  = _safe_val(info.get("regularMarketPrice"))
        result["forward_eps"]    = _safe_val(info.get("epsForward"))
        result["52w_high"]       = _safe_val(info.get("fiftyTwoWeekHigh"))
        result["52w_low"]        = _safe_val(info.get("fiftyTwoWeekLow"))
    except Exception as e:
        print(f"[rapidapi] {e}")
    return result

# ── yfinance fallback ─────────────────────────────────────────────────────────
def fetch_yfinance(ticker: str) -> dict:
    if not USE_YFINANCE:
        return {}
    result = {}
    try:
        t    = yf.Ticker(ticker)
        info = t.info or {}
        result["current_price"]    = _safe_val(info.get("currentPrice") or info.get("regularMarketPrice"))
        result["forward_eps"]      = _safe_val(info.get("forwardEps"))
        result["forward_pe"]       = _safe_val(info.get("forwardPE"))
        result["description"]      = info.get("longBusinessSummary", "")
        result["sector"]           = info.get("sector", "Unknown")
        result["industry"]         = info.get("industry", "Unknown")
        result["ev_to_ebitda"]     = _safe_val(info.get("enterpriseToEbitda"))
        result["ev_to_revenue"]    = _safe_val(info.get("enterpriseToRevenue"))
        result["ebitda"]           = _safe_val(info.get("ebitda"))
        result["gross_profit"]     = _safe_val(info.get("grossProfits"))
        result["total_debt"]       = _safe_val(info.get("totalDebt"))
        result["total_cash"]       = _safe_val(info.get("totalCash"))
        result["enterprise_value"] = _safe_val(info.get("enterpriseValue"))
        result["target_price"]     = _safe_val(info.get("targetMeanPrice"))
        result["target_high"]      = _safe_val(info.get("targetHighPrice"))
        result["target_low"]       = _safe_val(info.get("targetLowPrice"))
        result["recommendation"]   = info.get("recommendationKey")
        result["analyst_count"]    = _safe_val(info.get("numberOfAnalystOpinions"))
        result["peg_ratio"]        = _safe_val(info.get("pegRatio"))
        result["revenue_growth"]   = _safe_val(info.get("revenueGrowth"))
        result["earnings_growth"]  = _safe_val(info.get("earningsGrowth"))
        result["operating_margin"] = _safe_val(info.get("operatingMargins"))
        result["profit_margin"]    = _safe_val(info.get("profitMargins"))
        result["roe"]              = _safe_val(info.get("returnOnEquity"))
        result["roa"]              = _safe_val(info.get("returnOnAssets"))
        result["dividend_yield"]   = _safe_val(info.get("dividendYield"))
        result["dividend_rate"]    = _safe_val(info.get("dividendRate"))
        result["payout_ratio"]     = _safe_val(info.get("payoutRatio"))
        result["debt_to_equity"]   = _safe_val(info.get("debtToEquity"))
        result["current_ratio"]    = _safe_val(info.get("currentRatio"))
        result["free_cashflow"]    = _safe_val(info.get("freeCashflow"))
        result["book_value"]       = _safe_val(info.get("bookValue"))
        result["shares_outstanding"] = _safe_val(info.get("sharesOutstanding"))
        result["52w_high"]         = _safe_val(info.get("fiftyTwoWeekHigh"))
        result["52w_low"]          = _safe_val(info.get("fiftyTwoWeekLow"))
    except Exception as e:
        print(f"[yfinance] {e}")
    return result

def merge(primary: dict, fallback: dict) -> dict:
    merged = dict(fallback)
    for k, v in primary.items():
        if v is not None:
            merged[k] = v
    return merged

def fetch_stock_data(ticker: str) -> dict:
    ticker = ticker.upper().strip()

    fh_data    = fetch_finnhub(ticker)
    rapid_data = fetch_rapidapi(ticker)
    yf_data    = fetch_yfinance(ticker)

    # Finnhub is primary for price/metrics, yfinance fills gaps
    # Start with yfinance as base, then overlay Finnhub (which wins for fields it has)
    data = merge(fh_data, merge(rapid_data, yf_data))
    
    # For fields Finnhub free tier doesn't provide, explicitly use yfinance values
    yf_priority = ["ev_to_ebitda", "ev_to_revenue", "ebitda", "gross_profit",
                   "total_debt", "total_cash", "enterprise_value", "peg_ratio",
                   "forward_pe", "target_price", "target_high", "target_low",
                   "recommendation", "analyst_count", "free_cashflow",
                   "revenue_growth", "earnings_growth", "operating_margin",
                   "profit_margin", "roe", "roa", "dividend_yield", "dividend_rate",
                   "payout_ratio", "debt_to_equity", "current_ratio", "book_value",
                   "shares_outstanding", "52w_high", "52w_low"]
    for field in yf_priority:
        if data.get(field) is None and yf_data.get(field) is not None:
            data[field] = yf_data[field]
    data["ticker"] = ticker

    price  = data.get("current_price")
    eps    = data.get("eps")
    bv     = data.get("book_value")
    shares = data.get("shares_outstanding")

    if data.get("pe_ratio") is None and price and eps and eps > 0:
        data["pe_ratio"] = round(price / eps, 2)
    if data.get("pb_ratio") is None and price and bv and bv > 0:
        data["pb_ratio"] = round(price / bv, 2)
    if data.get("market_cap") is None and price and shares:
        data["market_cap"] = price * shares
    if data.get("enterprise_value") is None:
        mc   = data.get("market_cap")
        debt = data.get("total_debt")
        cash = data.get("total_cash")
        if mc and debt is not None and cash is not None:
            data["enterprise_value"] = mc + debt - cash

    return data

def fetch_price_history(ticker: str, period: str = "1y") -> dict:
    ticker = ticker.upper()

    # Finnhub candles
    if FINNHUB_KEY:
        try:
            from datetime import datetime, timedelta
            days = {"1d":1,"5d":5,"1mo":30,"3mo":90,"6mo":180,"1y":365,"2y":730,"5y":1825}
            now   = int(time.time())
            start = int((datetime.now() - timedelta(days=days.get(period, 365))).timestamp())
            r = requests.get(
                "https://finnhub.io/api/v1/stock/candle",
                params={"symbol": ticker, "resolution": "D", "from": start, "to": now},
                headers={"X-Finnhub-Token": FINNHUB_KEY},
                timeout=15,
            )
            d = r.json()
            if d.get("s") == "ok":
                from datetime import datetime as dt
                dates  = [dt.utcfromtimestamp(ts).strftime("%Y-%m-%d") for ts in d["t"]]
                closes = [round(float(c), 2) for c in d["c"]]
                volumes = [int(v) for v in d.get("v", [0]*len(closes))]
                return {"dates": dates, "closes": closes, "volumes": volumes}
        except Exception as e:
            print(f"[finnhub candles] {e}")

    # yfinance fallback
    if USE_YFINANCE:
        try:
            hist = yf.Ticker(ticker).history(period=period)
            if hist is not None and not hist.empty:
                return {
                    "dates":   [str(d.date()) for d in hist.index],
                    "closes":  [round(float(c), 2) for c in hist["Close"]],
                    "volumes": [int(v) for v in hist["Volume"]],
                }
        except Exception: pass

    return {}
