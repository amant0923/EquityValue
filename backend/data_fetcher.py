import numpy as np
import warnings
import requests
import os
import json
warnings.filterwarnings("ignore")

try:
    import yfinance as yf
    USE_YFINANCE = True
except ImportError:
    USE_YFINANCE = False

RAPIDAPI_KEY = os.environ.get("RAPIDAPI_KEY", "")

HEADERS_YF = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
}

def _safe_val(val, default=None):
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return default
    try:
        f = float(val)
        return None if np.isnan(f) else f
    except (TypeError, ValueError):
        return default

# ── RapidAPI Yahoo Finance ───────────────────────────────────────────────────
def fetch_rapidapi(ticker: str) -> dict:
    """Fetch via RapidAPI Yahoo Finance — reliable from cloud servers."""
    if not RAPIDAPI_KEY:
        return {}
    result = {}
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "yahoo-finance15.p.rapidapi.com",
    }
    try:
        r = requests.get(
            f"https://yahoo-finance15.p.rapidapi.com/api/v1/markets/stock/quotes",
            headers=headers,
            params={"ticker": ticker},
            timeout=15,
        )
        d = r.json()
        body = d.get("body", [{}])
        if isinstance(body, list) and body:
            info = body[0]
        elif isinstance(body, dict):
            info = body
        else:
            info = {}

        result["current_price"]    = _safe_val(info.get("regularMarketPrice"))
        result["name"]             = info.get("longName") or info.get("shortName") or ticker
        result["market_cap"]       = _safe_val(info.get("marketCap"))
        result["pe_ratio"]         = _safe_val(info.get("trailingPE"))
        result["forward_pe"]       = _safe_val(info.get("forwardPE"))
        result["eps"]              = _safe_val(info.get("epsTrailingTwelveMonths"))
        result["forward_eps"]      = _safe_val(info.get("epsForward"))
        result["52w_high"]         = _safe_val(info.get("fiftyTwoWeekHigh"))
        result["52w_low"]          = _safe_val(info.get("fiftyTwoWeekLow"))
        result["dividend_yield"]   = _safe_val(info.get("dividendYield"))
        result["shares_outstanding"] = _safe_val(info.get("sharesOutstanding"))
        result["book_value"]       = _safe_val(info.get("bookValue"))
        result["pb_ratio"]         = _safe_val(info.get("priceToBook"))
        result["beta"]             = _safe_val(info.get("beta"))
    except Exception as e:
        print(f"[rapidapi quotes error] {e}")

    # Also fetch financials
    try:
        r2 = requests.get(
            f"https://yahoo-finance15.p.rapidapi.com/api/v1/markets/stock/modules",
            headers=headers,
            params={"ticker": ticker, "module": "financial-data,asset-profile,default-key-statistics,summary-detail"},
            timeout=15,
        )
        d2 = r2.json()
        body2 = d2.get("body", {})

        fd = body2.get("financialData", {})
        ap = body2.get("assetProfile", {})
        ks = body2.get("defaultKeyStatistics", {})
        sd = body2.get("summaryDetail", {})

        def raw(d, k):
            v = d.get(k, {})
            return v.get("raw") if isinstance(v, dict) else v

        result["sector"]          = ap.get("sector", "Unknown")
        result["industry"]        = ap.get("industry", "Unknown")
        result["description"]     = ap.get("longBusinessSummary", "")
        result["revenue"]         = _safe_val(raw(fd, "totalRevenue"))
        result["ebitda"]          = _safe_val(raw(fd, "ebitda"))
        result["net_income"]      = _safe_val(raw(fd, "netIncomeToCommon"))
        result["gross_profit"]    = _safe_val(raw(fd, "grossProfits"))
        result["free_cashflow"]   = _safe_val(raw(fd, "freeCashflow"))
        result["operating_cashflow"] = _safe_val(raw(fd, "operatingCashflow"))
        result["total_debt"]      = _safe_val(raw(fd, "totalDebt"))
        result["total_cash"]      = _safe_val(raw(fd, "totalCash"))
        result["revenue_growth"]  = _safe_val(raw(fd, "revenueGrowth"))
        result["earnings_growth"] = _safe_val(raw(fd, "earningsGrowth"))
        result["profit_margin"]   = _safe_val(raw(fd, "profitMargins"))
        result["operating_margin"]= _safe_val(raw(fd, "operatingMargins"))
        result["roe"]             = _safe_val(raw(fd, "returnOnEquity"))
        result["roa"]             = _safe_val(raw(fd, "returnOnAssets"))
        result["debt_to_equity"]  = _safe_val(raw(fd, "debtToEquity"))
        result["current_ratio"]   = _safe_val(raw(fd, "currentRatio"))
        result["target_price"]    = _safe_val(raw(fd, "targetMeanPrice"))
        result["recommendation"]  = fd.get("recommendationKey", "")
        result["enterprise_value"]= _safe_val(raw(ks, "enterpriseValue"))
        result["ev_to_ebitda"]    = _safe_val(raw(ks, "enterpriseToEbitda"))
        result["ev_to_revenue"]   = _safe_val(raw(ks, "enterpriseToRevenue"))
        result["peg_ratio"]       = _safe_val(raw(ks, "pegRatio"))
        result["ps_ratio"]        = _safe_val(raw(ks, "priceToSalesTrailing12Months"))
        result["payout_ratio"]    = _safe_val(raw(sd, "payoutRatio"))
        result["dividend_rate"]   = _safe_val(raw(sd, "dividendRate"))
    except Exception as e:
        print(f"[rapidapi modules error] {e}")

    return result

# ── Direct Yahoo fallback ────────────────────────────────────────────────────
def fetch_yahoo_direct(ticker: str) -> dict:
    result = {}
    try:
        r = requests.get(
            f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1d",
            headers=HEADERS_YF, timeout=10,
        )
        meta = r.json()["chart"]["result"][0]["meta"]
        result["current_price"] = _safe_val(meta.get("regularMarketPrice"))
        result["name"] = meta.get("longName") or meta.get("shortName") or ticker
    except Exception as e:
        print(f"[yahoo direct error] {e}")

    try:
        modules = "summaryDetail,defaultKeyStatistics,financialData,assetProfile"
        r2 = requests.get(
            f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{ticker}?modules={modules}",
            headers=HEADERS_YF, timeout=15,
        )
        qs = r2.json().get("quoteSummary", {}).get("result", [{}])[0]
        sd = qs.get("summaryDetail", {})
        ks = qs.get("defaultKeyStatistics", {})
        fd = qs.get("financialData", {})
        ap = qs.get("assetProfile", {})

        def raw(d, k):
            v = d.get(k, {})
            return v.get("raw") if isinstance(v, dict) else v

        result["sector"]      = ap.get("sector", "Unknown")
        result["industry"]    = ap.get("industry", "Unknown")
        result["description"] = ap.get("longBusinessSummary", "")
        result["market_cap"]  = _safe_val(raw(sd, "marketCap"))
        result["pe_ratio"]    = _safe_val(raw(sd, "trailingPE"))
        result["forward_pe"]  = _safe_val(raw(ks, "forwardPE"))
        result["pb_ratio"]    = _safe_val(raw(ks, "priceToBook"))
        result["eps"]         = _safe_val(raw(ks, "trailingEps"))
        result["forward_eps"] = _safe_val(raw(ks, "forwardEps"))
        result["beta"]        = _safe_val(raw(sd, "beta"))
        result["52w_high"]    = _safe_val(raw(sd, "fiftyTwoWeekHigh"))
        result["52w_low"]     = _safe_val(raw(sd, "fiftyTwoWeekLow"))
        result["revenue"]     = _safe_val(raw(fd, "totalRevenue"))
        result["ebitda"]      = _safe_val(raw(fd, "ebitda"))
        result["free_cashflow"] = _safe_val(raw(fd, "freeCashflow"))
        result["total_debt"]  = _safe_val(raw(fd, "totalDebt"))
        result["total_cash"]  = _safe_val(raw(fd, "totalCash"))
        result["profit_margin"] = _safe_val(raw(fd, "profitMargins"))
        result["roe"]         = _safe_val(raw(fd, "returnOnEquity"))
        result["roa"]         = _safe_val(raw(fd, "returnOnAssets"))
        result["debt_to_equity"] = _safe_val(raw(fd, "debtToEquity"))
        result["enterprise_value"] = _safe_val(raw(ks, "enterpriseValue"))
        result["ev_to_ebitda"] = _safe_val(raw(ks, "enterpriseToEbitda"))
        result["recommendation"] = fd.get("recommendationKey", "")
        result["target_price"] = _safe_val(raw(fd, "targetMeanPrice"))
    except Exception as e:
        print(f"[yahoo quoteSummary error] {e}")

    return result

def fetch_yfinance(ticker: str) -> dict:
    if not USE_YFINANCE:
        return {}
    result = {}
    try:
        t    = yf.Ticker(ticker)
        info = t.info or {}
        result["current_price"]  = _safe_val(info.get("currentPrice") or info.get("regularMarketPrice"))
        result["name"]           = info.get("longName") or info.get("shortName") or ticker
        result["sector"]         = info.get("sector", "Unknown")
        result["industry"]       = info.get("industry", "Unknown")
        result["description"]    = info.get("longBusinessSummary", "")
        result["market_cap"]     = _safe_val(info.get("marketCap"))
        result["pe_ratio"]       = _safe_val(info.get("trailingPE"))
        result["forward_pe"]     = _safe_val(info.get("forwardPE"))
        result["pb_ratio"]       = _safe_val(info.get("priceToBook"))
        result["ps_ratio"]       = _safe_val(info.get("priceToSalesTrailing12Months"))
        result["peg_ratio"]      = _safe_val(info.get("pegRatio"))
        result["eps"]            = _safe_val(info.get("trailingEps"))
        result["forward_eps"]    = _safe_val(info.get("forwardEps"))
        result["beta"]           = _safe_val(info.get("beta"))
        result["dividend_yield"] = _safe_val(info.get("dividendYield"))
        result["dividend_rate"]  = _safe_val(info.get("dividendRate"))
        result["52w_high"]       = _safe_val(info.get("fiftyTwoWeekHigh"))
        result["52w_low"]        = _safe_val(info.get("fiftyTwoWeekLow"))
        result["target_price"]   = _safe_val(info.get("targetMeanPrice"))
        result["recommendation"] = info.get("recommendationKey", "")
        result["revenue_growth"] = _safe_val(info.get("revenueGrowth"))
        result["profit_margin"]  = _safe_val(info.get("profitMargins"))
        result["roe"]            = _safe_val(info.get("returnOnEquity"))
        result["roa"]            = _safe_val(info.get("returnOnAssets"))
        result["debt_to_equity"] = _safe_val(info.get("debtToEquity"))
        result["current_ratio"]  = _safe_val(info.get("currentRatio"))
        result["enterprise_value"] = _safe_val(info.get("enterpriseValue"))
        result["ev_to_ebitda"]   = _safe_val(info.get("enterpriseToEbitda"))
        result["shares_outstanding"] = _safe_val(info.get("sharesOutstanding"))
        result["book_value"]     = _safe_val(info.get("bookValue"))

        try:
            inc = t.income_stmt
            if inc is not None and not inc.empty:
                col = inc.columns[0]
                def get_inc(*keys):
                    for k in keys:
                        matches = [i for i in inc.index if k.lower() in str(i).lower()]
                        if matches:
                            v = _safe_val(inc.loc[matches[0], col])
                            if v is not None: return v
                    return None
                result["revenue"]      = get_inc("Total Revenue", "Revenue")
                result["gross_profit"] = get_inc("Gross Profit")
                result["ebitda"]       = get_inc("EBITDA", "Normalized EBITDA")
                result["net_income"]   = get_inc("Net Income")
        except Exception: pass

        try:
            cf = t.cashflow
            if cf is not None and not cf.empty:
                col = cf.columns[0]
                def get_cf(*keys):
                    for k in keys:
                        matches = [i for i in cf.index if k.lower() in str(i).lower()]
                        if matches:
                            v = _safe_val(cf.loc[matches[0], col])
                            if v is not None: return v
                    return None
                result["operating_cashflow"] = get_cf("Operating Cash Flow")
                result["free_cashflow"]      = get_cf("Free Cash Flow")
        except Exception: pass

        try:
            bs = t.balance_sheet
            if bs is not None and not bs.empty:
                col = bs.columns[0]
                def get_bs(*keys):
                    for k in keys:
                        matches = [i for i in bs.index if k.lower() in str(i).lower()]
                        if matches:
                            v = _safe_val(bs.loc[matches[0], col])
                            if v is not None: return v
                    return None
                result["total_debt"] = get_bs("Total Debt", "Long Term Debt")
                result["total_cash"] = get_bs("Cash And Cash Equivalents")
        except Exception: pass

    except Exception as e:
        print(f"[yfinance error] {e}")
    return result

def merge(primary: dict, fallback: dict) -> dict:
    merged = dict(fallback)
    for k, v in primary.items():
        if v is not None:
            merged[k] = v
    return merged

def fetch_stock_data(ticker: str) -> dict:
    ticker = ticker.upper().strip()

    # Priority: RapidAPI (works on cloud) → yfinance → direct Yahoo
    rapid_data  = fetch_rapidapi(ticker)
    yf_data     = fetch_yfinance(ticker)
    direct_data = fetch_yahoo_direct(ticker)

    # Merge: rapidapi most reliable on cloud, yfinance best for financials
    data = merge(rapid_data, merge(yf_data, direct_data))
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

    # Try RapidAPI first
    if RAPIDAPI_KEY:
        try:
            headers = {
                "X-RapidAPI-Key": RAPIDAPI_KEY,
                "X-RapidAPI-Host": "yahoo-finance15.p.rapidapi.com",
            }
            period_map = {"1d":"1d","5d":"5d","1mo":"1mo","3mo":"3mo","6mo":"6mo","1y":"1y","2y":"2y","5y":"5y"}
            r = requests.get(
                f"https://yahoo-finance15.p.rapidapi.com/api/v1/markets/stock/history",
                headers=headers,
                params={"symbol": ticker, "interval": "1d", "diffandsplits": "false"},
                timeout=15,
            )
            d = r.json()
            body = d.get("body", {})
            if isinstance(body, dict) and body:
                items = sorted(body.items())
                dates  = [item[0] for item in items]
                closes = [_safe_val(item[1].get("close")) for item in items]
                volumes = [int(item[1].get("volume", 0) or 0) for item in items]
                return {"dates": dates, "closes": closes, "volumes": volumes}
        except Exception as e:
            print(f"[rapidapi history error] {e}")

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

    # Direct fallback
    try:
        r = requests.get(
            f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1y",
            headers=HEADERS_YF, timeout=15,
        )
        d = r.json()["chart"]["result"][0]
        from datetime import datetime
        return {
            "dates":   [datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d") for ts in d["timestamp"]],
            "closes":  [round(float(c), 2) if c else None for c in d["indicators"]["quote"][0]["close"]],
            "volumes": [int(v) if v else 0 for v in d["indicators"]["quote"][0]["volume"]],
        }
    except Exception as e:
        print(f"[price history error] {e}")
        return {}
