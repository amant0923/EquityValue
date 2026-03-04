import numpy as np
import warnings
import requests
import os
import json
import time
warnings.filterwarnings("ignore")

try:
    import yfinance as yf
    USE_YFINANCE = True
except ImportError:
    USE_YFINANCE = False

AV_KEY       = os.environ.get("AV_KEY", "")
RAPIDAPI_KEY = os.environ.get("RAPIDAPI_KEY", "")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

def _safe_val(val, default=None):
    if val is None: return default
    if isinstance(val, str) and val in ("None", "N/A", "-", "", "nan"): return default
    try:
        f = float(val)
        return None if (np.isnan(f) or np.isinf(f)) else f
    except (TypeError, ValueError):
        return default

# ── Alpha Vantage ────────────────────────────────────────────────────────────
def fetch_alpha_vantage(ticker: str) -> dict:
    if not AV_KEY:
        return {}
    result = {}
    base = "https://www.alphavantage.co/query"

    # Overview — company info + key metrics
    try:
        r = requests.get(base, params={"function": "OVERVIEW", "symbol": ticker, "apikey": AV_KEY}, timeout=15)
        d = r.json()
        if "Symbol" in d:
            result["name"]             = d.get("Name", ticker)
            result["sector"]           = d.get("Sector", "Unknown")
            result["industry"]         = d.get("Industry", "Unknown")
            result["description"]      = d.get("Description", "")
            result["market_cap"]       = _safe_val(d.get("MarketCapitalization"))
            result["pe_ratio"]         = _safe_val(d.get("PERatio"))
            result["forward_pe"]       = _safe_val(d.get("ForwardPE"))
            result["pb_ratio"]         = _safe_val(d.get("PriceToBookRatio"))
            result["ps_ratio"]         = _safe_val(d.get("PriceToSalesRatioTTM"))
            result["peg_ratio"]        = _safe_val(d.get("PEGRatio"))
            result["eps"]              = _safe_val(d.get("EPS"))
            result["beta"]             = _safe_val(d.get("Beta"))
            result["52w_high"]         = _safe_val(d.get("52WeekHigh"))
            result["52w_low"]          = _safe_val(d.get("52WeekLow"))
            result["dividend_yield"]   = _safe_val(d.get("DividendYield"))
            result["dividend_rate"]    = _safe_val(d.get("DividendPerShare"))
            result["payout_ratio"]     = _safe_val(d.get("PayoutRatio"))
            result["book_value"]       = _safe_val(d.get("BookValue"))
            result["shares_outstanding"] = _safe_val(d.get("SharesOutstanding"))
            result["ev_to_ebitda"]     = _safe_val(d.get("EVToEBITDA"))
            result["ev_to_revenue"]    = _safe_val(d.get("EVToRevenue"))
            result["profit_margin"]    = _safe_val(d.get("ProfitMargin"))
            result["operating_margin"] = _safe_val(d.get("OperatingMarginTTM"))
            result["roe"]              = _safe_val(d.get("ReturnOnEquityTTM"))
            result["roa"]              = _safe_val(d.get("ReturnOnAssetsTTM"))
            result["revenue_growth"]   = _safe_val(d.get("QuarterlyRevenueGrowthYOY"))
            result["earnings_growth"]  = _safe_val(d.get("QuarterlyEarningsGrowthYOY"))
            result["target_price"]     = _safe_val(d.get("AnalystTargetPrice"))
            result["debt_to_equity"]   = _safe_val(d.get("DebtToEquityRatio") or d.get("DebtToEquity"))
            result["current_ratio"]    = _safe_val(d.get("CurrentRatio"))
            result["forward_eps"]      = _safe_val(d.get("ForwardAnnualDividendRate")) # fallback
            # Revenue & income from overview
            result["revenue"]          = _safe_val(d.get("RevenueTTM"))
            result["gross_profit"]     = _safe_val(d.get("GrossProfitTTM"))
            result["ebitda"]           = _safe_val(d.get("EBITDA"))
            result["enterprise_value"] = _safe_val(d.get("EnterpriseValue"))
            result["diluted_eps"]      = _safe_val(d.get("DilutedEPSTTM"))
            result["eps"]              = result["eps"] or result.get("diluted_eps")
        else:
            print(f"[av overview] no data: {d.get('Note') or d.get('Information') or 'unknown'}")
    except Exception as e:
        print(f"[av overview error] {e}")

    # Current price via global quote
    try:
        r = requests.get(base, params={"function": "GLOBAL_QUOTE", "symbol": ticker, "apikey": AV_KEY}, timeout=10)
        d = r.json().get("Global Quote", {})
        if d.get("05. price"):
            result["current_price"] = _safe_val(d.get("05. price"))
            result["52w_high"]      = result.get("52w_high") or _safe_val(d.get("03. high"))
            result["52w_low"]       = result.get("52w_low")  or _safe_val(d.get("04. low"))
    except Exception as e:
        print(f"[av quote error] {e}")

    # Income statement for detailed financials
    try:
        r = requests.get(base, params={"function": "INCOME_STATEMENT", "symbol": ticker, "apikey": AV_KEY}, timeout=15)
        d = r.json()
        reports = d.get("annualReports", [])
        if reports:
            rep = reports[0]
            result["revenue"]      = result.get("revenue")      or _safe_val(rep.get("totalRevenue"))
            result["gross_profit"] = result.get("gross_profit") or _safe_val(rep.get("grossProfit"))
            result["ebitda"]       = result.get("ebitda")       or _safe_val(rep.get("ebitda"))
            result["net_income"]   = _safe_val(rep.get("netIncome"))
            result["operating_margin"] = result.get("operating_margin") or _safe_val(rep.get("operatingIncome"))
    except Exception as e:
        print(f"[av income error] {e}")

    # Cash flow statement
    try:
        r = requests.get(base, params={"function": "CASH_FLOW", "symbol": ticker, "apikey": AV_KEY}, timeout=15)
        d = r.json()
        reports = d.get("annualReports", [])
        if reports:
            rep = reports[0]
            result["operating_cashflow"] = _safe_val(rep.get("operatingCashflow"))
            result["free_cashflow"]      = _safe_val(rep.get("operatingCashflow")) 
            capex = _safe_val(rep.get("capitalExpenditures"))
            op    = result.get("operating_cashflow")
            if op and capex:
                result["free_cashflow"] = op - abs(capex)
    except Exception as e:
        print(f"[av cashflow error] {e}")

    # Balance sheet
    try:
        r = requests.get(base, params={"function": "BALANCE_SHEET", "symbol": ticker, "apikey": AV_KEY}, timeout=15)
        d = r.json()
        reports = d.get("annualReports", [])
        if reports:
            rep = reports[0]
            result["total_debt"]  = _safe_val(rep.get("shortLongTermDebtTotal") or rep.get("longTermDebt"))
            result["total_cash"]  = _safe_val(rep.get("cashAndCashEquivalentsAtCarryingValue"))
    except Exception as e:
        print(f"[av balance error] {e}")

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
        result["market_cap"]     = _safe_val(info.get("marketCap"))
        result["pe_ratio"]       = _safe_val(info.get("trailingPE"))
        result["forward_pe"]     = _safe_val(info.get("forwardPE"))
        result["pb_ratio"]       = _safe_val(info.get("priceToBook"))
        result["eps"]            = _safe_val(info.get("trailingEps"))
        result["forward_eps"]    = _safe_val(info.get("forwardEps"))
        result["beta"]           = _safe_val(info.get("beta"))
        result["52w_high"]       = _safe_val(info.get("fiftyTwoWeekHigh"))
        result["52w_low"]        = _safe_val(info.get("fiftyTwoWeekLow"))
        result["shares_outstanding"] = _safe_val(info.get("sharesOutstanding"))
        result["book_value"]     = _safe_val(info.get("bookValue"))
        result["dividend_yield"] = _safe_val(info.get("dividendYield"))
        result["target_price"]   = _safe_val(info.get("targetMeanPrice"))
        result["recommendation"] = info.get("recommendationKey", "")
        result["enterprise_value"] = _safe_val(info.get("enterpriseValue"))
        result["ev_to_ebitda"]   = _safe_val(info.get("enterpriseToEbitda"))
        result["roe"]            = _safe_val(info.get("returnOnEquity"))
        result["roa"]            = _safe_val(info.get("returnOnAssets"))
        result["profit_margin"]  = _safe_val(info.get("profitMargins"))
        result["revenue_growth"] = _safe_val(info.get("revenueGrowth"))
        result["debt_to_equity"] = _safe_val(info.get("debtToEquity"))
        result["current_ratio"]  = _safe_val(info.get("currentRatio"))
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

    av_data    = fetch_alpha_vantage(ticker)
    rapid_data = fetch_rapidapi(ticker)
    yf_data    = fetch_yfinance(ticker)

    # AV has best financials, RapidAPI has best price, yfinance fills gaps
    data = merge(av_data, merge(rapid_data, yf_data))
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

    # Alpha Vantage daily prices
    if AV_KEY:
        try:
            r = requests.get(
                "https://www.alphavantage.co/query",
                params={"function": "TIME_SERIES_DAILY", "symbol": ticker,
                        "outputsize": "full" if period in ("2y","5y") else "compact",
                        "apikey": AV_KEY},
                timeout=20,
            )
            d = r.json().get("Time Series (Daily)", {})
            if d:
                items  = sorted(d.items())
                # Filter by period
                from datetime import datetime, timedelta
                days = {"1d":1,"5d":5,"1mo":30,"3mo":90,"6mo":180,"1y":365,"2y":730,"5y":1825}
                cutoff = datetime.today() - timedelta(days=days.get(period, 365))
                items  = [(dt, v) for dt, v in items if datetime.strptime(dt, "%Y-%m-%d") >= cutoff]
                if items:
                    return {
                        "dates":   [i[0] for i in items],
                        "closes":  [_safe_val(i[1].get("4. close")) for i in items],
                        "volumes": [int(float(i[1].get("5. volume", 0) or 0)) for i in items],
                    }
        except Exception as e:
            print(f"[av history error] {e}")

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
