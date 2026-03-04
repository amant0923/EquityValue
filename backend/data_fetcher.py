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

FMP_KEY      = os.environ.get("FMP_KEY", "")
RAPIDAPI_KEY = os.environ.get("RAPIDAPI_KEY", "")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

def _safe_val(val, default=None):
    if val is None: return default
    try:
        f = float(val)
        return None if (np.isnan(f) or np.isinf(f)) else f
    except (TypeError, ValueError):
        return default

# ── Financial Modeling Prep (best free financial data) ───────────────────────
def fetch_fmp(ticker: str) -> dict:
    if not FMP_KEY:
        return {}
    result = {}
    base = "https://financialmodelingprep.com/api/v3"

    try:
        # Quote (price + basic metrics)
        r = requests.get(f"{base}/quote/{ticker}?apikey={FMP_KEY}", timeout=10)
        q = r.json()
        if isinstance(q, list) and q:
            q = q[0]
            result["current_price"]      = _safe_val(q.get("price"))
            result["market_cap"]         = _safe_val(q.get("marketCap"))
            result["pe_ratio"]           = _safe_val(q.get("pe"))
            result["eps"]                = _safe_val(q.get("eps"))
            result["52w_high"]           = _safe_val(q.get("yearHigh"))
            result["52w_low"]            = _safe_val(q.get("yearLow"))
            result["shares_outstanding"] = _safe_val(q.get("sharesOutstanding"))
            result["name"]               = q.get("name", ticker)
    except Exception as e:
        print(f"[fmp quote] {e}")

    try:
        # Key metrics & ratios
        r = requests.get(f"{base}/key-metrics-ttm/{ticker}?apikey={FMP_KEY}", timeout=10)
        km = r.json()
        if isinstance(km, list) and km:
            km = km[0]
            result["revenue"]          = _safe_val(km.get("revenuePerShareTTM"))
            result["pb_ratio"]         = _safe_val(km.get("pbRatioTTM"))
            result["ps_ratio"]         = _safe_val(km.get("priceToSalesRatioTTM"))
            result["peg_ratio"]        = _safe_val(km.get("pegRatioTTM"))
            result["ev_to_ebitda"]     = _safe_val(km.get("enterpriseValueOverEBITDATTM"))
            result["ev_to_revenue"]    = _safe_val(km.get("evToSalesTTM"))
            result["enterprise_value"] = _safe_val(km.get("enterpriseValueTTM"))
            result["roe"]              = _safe_val(km.get("roeTTM"))
            result["roa"]              = _safe_val(km.get("returnOnTangibleAssetsTTM"))
            result["free_cashflow"]    = _safe_val(km.get("freeCashFlowPerShareTTM"))
            result["dividend_yield"]   = _safe_val(km.get("dividendYieldTTM"))
            result["current_ratio"]    = _safe_val(km.get("currentRatioTTM"))
            result["debt_to_equity"]   = _safe_val(km.get("debtToEquityTTM"))
            result["book_value"]       = _safe_val(km.get("bookValuePerShareTTM"))
    except Exception as e:
        print(f"[fmp key-metrics] {e}")

    try:
        # Financial ratios for margins, beta etc
        r = requests.get(f"{base}/ratios-ttm/{ticker}?apikey={FMP_KEY}", timeout=10)
        rt = r.json()
        if isinstance(rt, list) and rt:
            rt = rt[0]
            result["profit_margin"]    = _safe_val(rt.get("netProfitMarginTTM"))
            result["operating_margin"] = _safe_val(rt.get("operatingProfitMarginTTM"))
            result["forward_pe"]       = _safe_val(rt.get("priceEarningsRatioTTM"))
            result["payout_ratio"]     = _safe_val(rt.get("payoutRatioTTM"))
    except Exception as e:
        print(f"[fmp ratios] {e}")

    try:
        # Income statement for revenue, ebitda, net income
        r = requests.get(f"{base}/income-statement/{ticker}?limit=1&apikey={FMP_KEY}", timeout=10)
        inc = r.json()
        if isinstance(inc, list) and inc:
            inc = inc[0]
            result["revenue"]        = _safe_val(inc.get("revenue"))
            result["gross_profit"]   = _safe_val(inc.get("grossProfit"))
            result["ebitda"]         = _safe_val(inc.get("ebitda"))
            result["net_income"]     = _safe_val(inc.get("netIncome"))
            result["operating_margin"] = _safe_val(inc.get("operatingIncomeRatio"))
            result["profit_margin"]  = _safe_val(inc.get("netIncomeRatio"))
            result["revenue_growth"] = _safe_val(inc.get("growthRevenue"))
    except Exception as e:
        print(f"[fmp income] {e}")

    try:
        # Cash flow statement
        r = requests.get(f"{base}/cash-flow-statement/{ticker}?limit=1&apikey={FMP_KEY}", timeout=10)
        cf = r.json()
        if isinstance(cf, list) and cf:
            cf = cf[0]
            result["free_cashflow"]      = _safe_val(cf.get("freeCashFlow"))
            result["operating_cashflow"] = _safe_val(cf.get("operatingCashFlow"))
    except Exception as e:
        print(f"[fmp cashflow] {e}")

    try:
        # Balance sheet
        r = requests.get(f"{base}/balance-sheet-statement/{ticker}?limit=1&apikey={FMP_KEY}", timeout=10)
        bs = r.json()
        if isinstance(bs, list) and bs:
            bs = bs[0]
            result["total_debt"]  = _safe_val(bs.get("totalDebt"))
            result["total_cash"]  = _safe_val(bs.get("cashAndCashEquivalents"))
            result["book_value"]  = _safe_val(bs.get("totalStockholdersEquity"))
    except Exception as e:
        print(f"[fmp balance] {e}")

    try:
        # Company profile for sector, description, beta
        r = requests.get(f"{base}/profile/{ticker}?apikey={FMP_KEY}", timeout=10)
        pr = r.json()
        if isinstance(pr, list) and pr:
            pr = pr[0]
            result["sector"]      = pr.get("sector", "Unknown")
            result["industry"]    = pr.get("industry", "Unknown")
            result["description"] = pr.get("description", "")
            result["beta"]        = _safe_val(pr.get("beta"))
            result["website"]     = pr.get("website", "")
            result["forward_pe"]  = result.get("forward_pe") or _safe_val(pr.get("forwardPE"))
            result["dividend_yield"] = result.get("dividend_yield") or _safe_val(pr.get("lastDiv"))
    except Exception as e:
        print(f"[fmp profile] {e}")

    try:
        # Analyst estimates
        r = requests.get(f"{base}/analyst-stock-recommendations/{ticker}?limit=1&apikey={FMP_KEY}", timeout=10)
        an = r.json()
        if isinstance(an, list) and an:
            an = an[0]
            result["recommendation"] = an.get("analystRatingsStrongBuy") and "buy" or ""
    except Exception as e:
        print(f"[fmp analyst] {e}")

    try:
        # Price target
        r = requests.get(f"{base}/price-target-consensus/{ticker}?apikey={FMP_KEY}", timeout=10)
        pt = r.json()
        if isinstance(pt, list) and pt:
            pt = pt[0]
            result["target_price"]    = _safe_val(pt.get("targetConsensus"))
            result["target_high"]     = _safe_val(pt.get("targetHigh"))
            result["target_low"]      = _safe_val(pt.get("targetLow"))
    except Exception as e:
        print(f"[fmp price target] {e}")

    return result

# ── RapidAPI fallback ────────────────────────────────────────────────────────
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
        result["current_price"]      = _safe_val(info.get("regularMarketPrice"))
        result["name"]               = info.get("longName") or info.get("shortName") or ticker
        result["market_cap"]         = _safe_val(info.get("marketCap"))
        result["pe_ratio"]           = _safe_val(info.get("trailingPE"))
        result["forward_pe"]         = _safe_val(info.get("forwardPE"))
        result["eps"]                = _safe_val(info.get("epsTrailingTwelveMonths"))
        result["forward_eps"]        = _safe_val(info.get("epsForward"))
        result["52w_high"]           = _safe_val(info.get("fiftyTwoWeekHigh"))
        result["52w_low"]            = _safe_val(info.get("fiftyTwoWeekLow"))
        result["dividend_yield"]     = _safe_val(info.get("dividendYield"))
        result["shares_outstanding"] = _safe_val(info.get("sharesOutstanding"))
        result["book_value"]         = _safe_val(info.get("bookValue"))
        result["pb_ratio"]           = _safe_val(info.get("priceToBook"))
        result["beta"]               = _safe_val(info.get("beta"))
    except Exception as e:
        print(f"[rapidapi] {e}")
    return result

# ── yfinance fallback ────────────────────────────────────────────────────────
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
        result["operating_margin"] = _safe_val(info.get("operatingMargins"))
        result["roe"]            = _safe_val(info.get("returnOnEquity"))
        result["roa"]            = _safe_val(info.get("returnOnAssets"))
        result["debt_to_equity"] = _safe_val(info.get("debtToEquity"))
        result["current_ratio"]  = _safe_val(info.get("currentRatio"))
        result["enterprise_value"] = _safe_val(info.get("enterpriseValue"))
        result["ev_to_ebitda"]   = _safe_val(info.get("enterpriseToEbitda"))
        result["shares_outstanding"] = _safe_val(info.get("sharesOutstanding"))
        result["book_value"]     = _safe_val(info.get("bookValue"))
        result["earnings_growth"] = _safe_val(info.get("earningsGrowth"))

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
    # FMP is most complete on cloud, then RapidAPI, then yfinance
    fmp_data    = fetch_fmp(ticker)
    rapid_data  = fetch_rapidapi(ticker)
    yf_data     = fetch_yfinance(ticker)

    data = merge(fmp_data, merge(rapid_data, yf_data))
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

    # FMP price history
    if FMP_KEY:
        try:
            from datetime import datetime, timedelta
            end   = datetime.today().strftime("%Y-%m-%d")
            days  = {"1d":1,"5d":5,"1mo":30,"3mo":90,"6mo":180,"1y":365,"2y":730,"5y":1825}
            start = (datetime.today() - timedelta(days=days.get(period, 365))).strftime("%Y-%m-%d")
            r = requests.get(
                f"https://financialmodelingprep.com/api/v3/historical-price-full/{ticker}"
                f"?from={start}&to={end}&apikey={FMP_KEY}",
                timeout=15,
            )
            hist = r.json().get("historical", [])
            if hist:
                hist = sorted(hist, key=lambda x: x["date"])
                return {
                    "dates":   [h["date"] for h in hist],
                    "closes":  [_safe_val(h.get("close")) for h in hist],
                    "volumes": [int(h.get("volume", 0) or 0) for h in hist],
                }
        except Exception as e:
            print(f"[fmp history] {e}")

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
