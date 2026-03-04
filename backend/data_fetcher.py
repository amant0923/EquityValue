import numpy as np
import warnings
import requests
import json
import time
import random
warnings.filterwarnings("ignore")

try:
    import yfinance as yf
    USE_YFINANCE = True
except ImportError:
    USE_YFINANCE = False

# ── Rotating user agents to avoid blocks ────────────────────────────────────
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
]

def _get_headers():
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Cache-Control": "max-age=0",
    }

def _get_crumb_and_cookie():
    """Get a valid crumb + cookie from Yahoo Finance — required for API calls."""
    session = requests.Session()
    try:
        # First hit the main page to get cookies
        r = session.get(
            "https://finance.yahoo.com",
            headers=_get_headers(),
            timeout=10,
            allow_redirects=True,
        )
        # Get crumb
        crumb_r = session.get(
            "https://query1.finance.yahoo.com/v1/test/getcrumb",
            headers={**_get_headers(), "Referer": "https://finance.yahoo.com"},
            timeout=10,
        )
        crumb = crumb_r.text.strip()
        cookies = session.cookies.get_dict()
        return crumb, cookies
    except Exception as e:
        print(f"[crumb error] {e}")
        return None, {}

def _safe_val(val, default=None):
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return default
    try:
        f = float(val)
        return None if np.isnan(f) else f
    except (TypeError, ValueError):
        return default

def fetch_yahoo_direct(ticker: str) -> dict:
    """Pull fundamentals directly from Yahoo Finance with crumb auth."""
    result = {}
    ticker = ticker.upper().strip()

    crumb, cookies = _get_crumb_and_cookie()
    headers = {**_get_headers(), "Referer": f"https://finance.yahoo.com/quote/{ticker}"}

    # ── Price via chart endpoint ─────────────────────────────────────────────
    for base in ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]:
        try:
            r = requests.get(
                f"{base}/v8/finance/chart/{ticker}?interval=1d&range=1d",
                headers=headers, cookies=cookies, timeout=10,
            )
            data = r.json()
            meta = data["chart"]["result"][0]["meta"]
            result["current_price"] = _safe_val(meta.get("regularMarketPrice") or meta.get("chartPreviousClose"))
            result["ticker"] = ticker
            result["name"]   = meta.get("longName") or meta.get("shortName") or ticker
            break
        except Exception as e:
            print(f"[chart {base}] {e}")
            continue

    # ── Fundamentals via quoteSummary ────────────────────────────────────────
    modules = "summaryDetail,defaultKeyStatistics,financialData,assetProfile,recommendationTrend,earningsTrend"
    params  = {"modules": modules}
    if crumb:
        params["crumb"] = crumb

    for base in ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]:
        try:
            r = requests.get(
                f"{base}/v10/finance/quoteSummary/{ticker}",
                params=params,
                headers=headers,
                cookies=cookies,
                timeout=15,
            )
            qs = r.json().get("quoteSummary", {}).get("result", [{}])
            if not qs or qs[0] is None:
                continue
            qs = qs[0]

            sd = qs.get("summaryDetail", {})
            ks = qs.get("defaultKeyStatistics", {})
            fd = qs.get("financialData", {})
            ap = qs.get("assetProfile", {})

            def raw(d, k):
                v = d.get(k, {})
                return v.get("raw") if isinstance(v, dict) else v

            result["name"]        = ap.get("longName") or result.get("name") or ticker
            result["sector"]      = ap.get("sector", "Unknown")
            result["industry"]    = ap.get("industry", "Unknown")
            result["description"] = ap.get("longBusinessSummary", "")
            result["market_cap"]  = _safe_val(raw(sd, "marketCap"))
            result["pe_ratio"]    = _safe_val(raw(sd, "trailingPE"))
            result["forward_pe"]  = _safe_val(raw(ks, "forwardPE"))
            result["pb_ratio"]    = _safe_val(raw(ks, "priceToBook"))
            result["ps_ratio"]    = _safe_val(raw(ks, "priceToSalesTrailing12Months"))
            result["peg_ratio"]   = _safe_val(raw(ks, "pegRatio"))
            result["eps"]         = _safe_val(raw(ks, "trailingEps"))
            result["forward_eps"] = _safe_val(raw(ks, "forwardEps"))
            result["beta"]        = _safe_val(raw(sd, "beta"))
            result["dividend_yield"]  = _safe_val(raw(sd, "dividendYield"))
            result["dividend_rate"]   = _safe_val(raw(sd, "dividendRate"))
            result["payout_ratio"]    = _safe_val(raw(sd, "payoutRatio"))
            result["shares_outstanding"] = _safe_val(raw(ks, "sharesOutstanding"))
            result["book_value"]  = _safe_val(raw(ks, "bookValue"))
            result["52w_high"]    = _safe_val(raw(sd, "fiftyTwoWeekHigh"))
            result["52w_low"]     = _safe_val(raw(sd, "fiftyTwoWeekLow"))
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
            break
        except Exception as e:
            print(f"[quoteSummary {base}] {e}")
            continue

    return result

def fetch_yfinance(ticker: str) -> dict:
    """yfinance-based fetch."""
    if not USE_YFINANCE:
        return {}
    result = {}
    try:
        t    = yf.Ticker(ticker)
        info = t.info or {}

        result["current_price"] = _safe_val(
            info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
        )
        result["name"]        = info.get("longName") or info.get("shortName") or ticker
        result["sector"]      = info.get("sector", "Unknown")
        result["industry"]    = info.get("industry", "Unknown")
        result["description"] = info.get("longBusinessSummary", "")
        result["market_cap"]  = _safe_val(info.get("marketCap"))
        result["beta"]        = _safe_val(info.get("beta"))
        result["pe_ratio"]    = _safe_val(info.get("trailingPE"))
        result["forward_pe"]  = _safe_val(info.get("forwardPE"))
        result["pb_ratio"]    = _safe_val(info.get("priceToBook"))
        result["ps_ratio"]    = _safe_val(info.get("priceToSalesTrailing12Months"))
        result["peg_ratio"]   = _safe_val(info.get("pegRatio"))
        result["eps"]         = _safe_val(info.get("trailingEps"))
        result["forward_eps"] = _safe_val(info.get("forwardEps"))
        result["book_value"]  = _safe_val(info.get("bookValue"))
        result["dividend_yield"]     = _safe_val(info.get("dividendYield"))
        result["dividend_rate"]      = _safe_val(info.get("dividendRate"))
        result["payout_ratio"]       = _safe_val(info.get("payoutRatio"))
        result["shares_outstanding"] = _safe_val(info.get("sharesOutstanding"))
        result["52w_high"]    = _safe_val(info.get("fiftyTwoWeekHigh"))
        result["52w_low"]     = _safe_val(info.get("fiftyTwoWeekLow"))
        result["target_price"]   = _safe_val(info.get("targetMeanPrice"))
        result["recommendation"] = info.get("recommendationKey", "")

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
                result["net_income"]   = get_inc("Net Income", "Net Income Common Stockholders")
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
                if result.get("free_cashflow") is None:
                    op    = result.get("operating_cashflow")
                    capex = get_cf("Capital Expenditure", "Capital Expenditures")
                    if op and capex:
                        result["free_cashflow"] = op - abs(capex)
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
                result["total_cash"] = get_bs("Cash And Cash Equivalents", "Cash Cash Equivalents")
        except Exception: pass

        result["revenue_growth"]   = _safe_val(info.get("revenueGrowth"))
        result["earnings_growth"]  = _safe_val(info.get("earningsGrowth"))
        result["profit_margin"]    = _safe_val(info.get("profitMargins"))
        result["operating_margin"] = _safe_val(info.get("operatingMargins"))
        result["roe"]              = _safe_val(info.get("returnOnEquity"))
        result["roa"]              = _safe_val(info.get("returnOnAssets"))
        result["debt_to_equity"]   = _safe_val(info.get("debtToEquity"))
        result["current_ratio"]    = _safe_val(info.get("currentRatio"))
        result["enterprise_value"] = _safe_val(info.get("enterpriseValue"))
        result["ev_to_ebitda"]     = _safe_val(info.get("enterpriseToEbitda"))
        result["ev_to_revenue"]    = _safe_val(info.get("enterpriseToRevenue"))

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

    # Try direct API first (more reliable on cloud), then yfinance
    direct_data = fetch_yahoo_direct(ticker)
    yf_data     = fetch_yfinance(ticker)

    data = merge(yf_data, direct_data)
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

    # Try yfinance first
    if USE_YFINANCE:
        try:
            t    = yf.Ticker(ticker)
            hist = t.history(period=period)
            if hist is not None and not hist.empty:
                return {
                    "dates":   [str(d.date()) for d in hist.index],
                    "closes":  [round(float(c), 2) for c in hist["Close"]],
                    "volumes": [int(v) for v in hist["Volume"]],
                }
        except Exception: pass

    # Direct fallback
    try:
        crumb, cookies = _get_crumb_and_cookie()
        headers = _get_headers()
        period_map = {"1d":"1d","5d":"5d","1mo":"1mo","3mo":"3mo","6mo":"6mo","1y":"1y","2y":"2y","5y":"5y"}
        r = requests.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
            f"?interval=1d&range={period_map.get(period,'1y')}",
            headers=headers, cookies=cookies, timeout=15,
        )
        d          = r.json()["chart"]["result"][0]
        timestamps = d["timestamp"]
        closes     = d["indicators"]["quote"][0]["close"]
        volumes    = d["indicators"]["quote"][0]["volume"]
        from datetime import datetime
        dates = [datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d") for ts in timestamps]
        return {
            "dates":   dates,
            "closes":  [round(float(c), 2) if c else None for c in closes],
            "volumes": [int(v) if v else 0 for v in volumes],
        }
    except Exception as e:
        print(f"[price history error] {e}")
        return {}
