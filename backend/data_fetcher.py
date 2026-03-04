import numpy as np
import warnings
import requests
import json
warnings.filterwarnings("ignore")

try:
    import yfinance as yf
    USE_YFINANCE = True
except ImportError:
    USE_YFINANCE = False

# ── Direct Yahoo Finance API fallback (no yfinance dependency) ──────────────
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

def _get_from_series(series, *keys):
    """Try multiple key names from a pandas Series/dict."""
    for k in keys:
        try:
            val = series.get(k) if hasattr(series, "get") else series[k]
            if val is not None and not (isinstance(val, float) and np.isnan(val)):
                return float(val)
        except (KeyError, TypeError, ValueError):
            continue
    return None

def fetch_yahoo_direct(ticker: str) -> dict:
    """Pull fundamentals directly from Yahoo Finance v10/v11 endpoints."""
    result = {}
    base = "https://query2.finance.yahoo.com"
    # Price
    try:
        r = requests.get(
            f"{base}/v8/finance/chart/{ticker}?interval=1d&range=1d",
            headers=HEADERS, timeout=10
        )
        data = r.json()
        meta = data["chart"]["result"][0]["meta"]
        result["current_price"] = _safe_val(meta.get("regularMarketPrice"))
        result["ticker"] = ticker.upper()
        result["name"] = meta.get("longName") or meta.get("shortName") or ticker.upper()
    except Exception:
        pass

    # Fundamentals via v10/quoteSummary
    modules = "summaryDetail,defaultKeyStatistics,financialData,incomeStatementHistory,cashflowStatementHistory,balanceSheetHistory,assetProfile"
    try:
        r = requests.get(
            f"{base}/v10/finance/quoteSummary/{ticker}?modules={modules}",
            headers=HEADERS, timeout=15
        )
        qs = r.json().get("quoteSummary", {}).get("result", [{}])[0]

        sd  = qs.get("summaryDetail", {})
        ks  = qs.get("defaultKeyStatistics", {})
        fd  = qs.get("financialData", {})
        ap  = qs.get("assetProfile", {})

        def raw(d, k):
            v = d.get(k, {})
            return v.get("raw") if isinstance(v, dict) else v

        result["name"]            = result.get("name") or ap.get("longName") or ticker.upper()
        result["sector"]          = ap.get("sector", "Unknown")
        result["industry"]        = ap.get("industry", "Unknown")
        result["description"]     = ap.get("longBusinessSummary", "")
        result["market_cap"]      = _safe_val(raw(sd, "marketCap"))
        result["pe_ratio"]        = _safe_val(raw(sd, "trailingPE"))
        result["forward_pe"]      = _safe_val(raw(ks, "forwardPE"))
        result["pb_ratio"]        = _safe_val(raw(ks, "priceToBook"))
        result["ps_ratio"]        = _safe_val(raw(ks, "priceToSalesTrailing12Months"))
        result["peg_ratio"]       = _safe_val(raw(ks, "pegRatio"))
        result["eps"]             = _safe_val(raw(ks, "trailingEps"))
        result["forward_eps"]     = _safe_val(raw(ks, "forwardEps"))
        result["beta"]            = _safe_val(raw(sd, "beta"))
        result["dividend_yield"]  = _safe_val(raw(sd, "dividendYield"))
        result["dividend_rate"]   = _safe_val(raw(sd, "dividendRate"))
        result["payout_ratio"]    = _safe_val(raw(sd, "payoutRatio"))
        result["shares_outstanding"] = _safe_val(raw(ks, "sharesOutstanding"))
        result["book_value"]      = _safe_val(raw(ks, "bookValue"))
        result["52w_high"]        = _safe_val(raw(sd, "fiftyTwoWeekHigh"))
        result["52w_low"]         = _safe_val(raw(sd, "fiftyTwoWeekLow"))

        # Financial data module
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
        result["target_price"]      = _safe_val(raw(fd, "targetMeanPrice"))
        result["target_high"]       = _safe_val(raw(fd, "targetHighPrice"))
        result["target_low"]        = _safe_val(raw(fd, "targetLowPrice"))
        result["target_median"]     = _safe_val(raw(fd, "targetMedianPrice"))
        result["recommendation"]    = fd.get("recommendationKey", "")
        result["recommendation_mean"] = _safe_val(raw(fd, "recommendationMean"))
        result["analyst_count"]     = _safe_val(raw(fd, "numberOfAnalystOpinions"))

        # EV metrics from defaultKeyStatistics
        result["enterprise_value"]     = _safe_val(raw(ks, "enterpriseValue"))
        result["ev_to_ebitda"]         = _safe_val(raw(ks, "enterpriseToEbitda"))
        result["ev_to_revenue"]        = _safe_val(raw(ks, "enterpriseToRevenue"))

    except Exception as e:
        print(f"[direct API error] {e}")

    return result

def fetch_yfinance(ticker: str) -> dict:
    """yfinance-based fetch with exhaustive field aliases."""
    if not USE_YFINANCE:
        return {}
    result = {}
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}

        result["current_price"] = _safe_val(
            info.get("currentPrice") or info.get("regularMarketPrice") or
            info.get("previousClose")
        )
        result["name"]      = info.get("longName") or info.get("shortName") or ticker
        result["sector"]    = info.get("sector", "Unknown")
        result["industry"]  = info.get("industry", "Unknown")
        result["description"] = info.get("longBusinessSummary", "")
        result["market_cap"] = _safe_val(info.get("marketCap"))
        result["beta"]       = _safe_val(info.get("beta"))
        result["pe_ratio"]   = _safe_val(info.get("trailingPE"))
        result["forward_pe"] = _safe_val(info.get("forwardPE"))
        result["pb_ratio"]   = _safe_val(info.get("priceToBook"))
        result["ps_ratio"]   = _safe_val(info.get("priceToSalesTrailing12Months"))
        result["peg_ratio"]  = _safe_val(info.get("pegRatio"))
        result["eps"]        = _safe_val(info.get("trailingEps"))
        result["forward_eps"]= _safe_val(info.get("forwardEps"))
        result["book_value"] = _safe_val(info.get("bookValue"))
        result["dividend_yield"] = _safe_val(info.get("dividendYield"))
        result["dividend_rate"]  = _safe_val(info.get("dividendRate"))
        result["payout_ratio"]   = _safe_val(info.get("payoutRatio"))
        result["shares_outstanding"] = _safe_val(info.get("sharesOutstanding"))
        result["52w_high"] = _safe_val(info.get("fiftyTwoWeekHigh"))
        result["52w_low"]  = _safe_val(info.get("fiftyTwoWeekLow"))
        result["target_price"]        = _safe_val(info.get("targetMeanPrice"))
        result["target_high"]         = _safe_val(info.get("targetHighPrice"))
        result["target_low"]          = _safe_val(info.get("targetLowPrice"))
        result["target_median"]       = _safe_val(info.get("targetMedianPrice"))
        result["recommendation"]      = info.get("recommendationKey", "")
        result["recommendation_mean"] = _safe_val(info.get("recommendationMean"))
        result["analyst_count"]       = _safe_val(info.get("numberOfAnalystOpinions"))

        # Try income statement for P&L items
        try:
            inc = t.income_stmt
            if inc is not None and not inc.empty:
                col = inc.columns[0]
                def get_inc(*keys):
                    for k in keys:
                        matches = [i for i in inc.index if k.lower() in str(i).lower()]
                        if matches:
                            v = inc.loc[matches[0], col]
                            r = _safe_val(v)
                            if r is not None: return r
                    return None
                result["revenue"]      = get_inc("Total Revenue", "Revenue")
                result["gross_profit"] = get_inc("Gross Profit")
                result["ebitda"]       = get_inc("EBITDA", "Normalized EBITDA")
                result["net_income"]   = get_inc("Net Income", "Net Income Common Stockholders")
                result["operating_margin"] = _safe_val(info.get("operatingMargins"))
                result["profit_margin"]    = _safe_val(info.get("profitMargins"))
        except Exception:
            pass

        # Cashflow
        try:
            cf = t.cashflow
            if cf is not None and not cf.empty:
                col = cf.columns[0]
                def get_cf(*keys):
                    for k in keys:
                        matches = [i for i in cf.index if k.lower() in str(i).lower()]
                        if matches:
                            v = cf.loc[matches[0], col]
                            r = _safe_val(v)
                            if r is not None: return r
                    return None
                result["operating_cashflow"] = get_cf("Operating Cash Flow", "Cash From Operations")
                result["free_cashflow"]      = get_cf("Free Cash Flow")
                if result.get("free_cashflow") is None:
                    op = result.get("operating_cashflow")
                    capex_keys = ["Capital Expenditure", "Capital Expenditures", "Purchase Of PPE"]
                    capex = get_cf(*capex_keys)
                    if op is not None and capex is not None:
                        result["free_cashflow"] = op - abs(capex)
        except Exception:
            pass

        # Balance sheet
        try:
            bs = t.balance_sheet
            if bs is not None and not bs.empty:
                col = bs.columns[0]
                def get_bs(*keys):
                    for k in keys:
                        matches = [i for i in bs.index if k.lower() in str(i).lower()]
                        if matches:
                            v = bs.loc[matches[0], col]
                            r = _safe_val(v)
                            if r is not None: return r
                    return None
                result["total_debt"] = get_bs("Total Debt", "Long Term Debt And Capital Lease Obligation")
                result["total_cash"] = get_bs("Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments")
        except Exception:
            pass

        # Remaining from info
        result["revenue_growth"]   = _safe_val(info.get("revenueGrowth"))
        result["earnings_growth"]  = _safe_val(info.get("earningsGrowth"))
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
    """Merge two dicts: keep primary value unless it is None."""
    merged = dict(fallback)
    for k, v in primary.items():
        if v is not None:
            merged[k] = v
    return merged

def fetch_stock_data(ticker: str) -> dict:
    """
    Master fetch function — tries yfinance first, then direct Yahoo API,
    merges both for maximum coverage.
    """
    ticker = ticker.upper().strip()
    yf_data     = fetch_yfinance(ticker)
    direct_data = fetch_yahoo_direct(ticker)

    # Direct API is usually more reliable for fundamentals; yfinance better for cashflows
    data = merge(yf_data, direct_data)
    data["ticker"] = ticker

    # Derived metrics if not already set
    price = data.get("current_price")
    eps   = data.get("eps")
    bv    = data.get("book_value")
    shares = data.get("shares_outstanding")

    if data.get("pe_ratio") is None and price and eps and eps > 0:
        data["pe_ratio"] = round(price / eps, 2)
    if data.get("pb_ratio") is None and price and bv and bv > 0:
        data["pb_ratio"] = round(price / bv, 2)
    if data.get("market_cap") is None and price and shares:
        data["market_cap"] = price * shares

    # EV = market_cap + total_debt - total_cash
    if data.get("enterprise_value") is None:
        mc   = data.get("market_cap")
        debt = data.get("total_debt")
        cash = data.get("total_cash")
        if mc and debt is not None and cash is not None:
            data["enterprise_value"] = mc + debt - cash

    return data

def fetch_price_history(ticker: str, period: str = "1y") -> dict:
    """Fetch OHLCV history — used for charts."""
    ticker = ticker.upper()
    if USE_YFINANCE:
        try:
            t = yf.Ticker(ticker)
            hist = t.history(period=period)
            if hist is not None and not hist.empty:
                return {
                    "dates":  [str(d.date()) for d in hist.index],
                    "closes": [round(float(c), 2) for c in hist["Close"]],
                    "volumes":[int(v) for v in hist["Volume"]],
                }
        except Exception:
            pass
    # Direct fallback
    try:
        period_map = {"1d": "1d", "5d": "5d", "1mo": "1mo", "3mo": "3mo",
                      "6mo": "6mo", "1y": "1y", "2y": "2y", "5y": "5y"}
        yf_period = period_map.get(period, "1y")
        r = requests.get(
            f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}"
            f"?interval=1d&range={yf_period}",
            headers=HEADERS, timeout=15
        )
        d = r.json()["chart"]["result"][0]
        timestamps = d["timestamp"]
        closes = d["indicators"]["quote"][0]["close"]
        volumes = d["indicators"]["quote"][0]["volume"]
        from datetime import datetime
        dates = [datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d") for ts in timestamps]
        return {
            "dates":  dates,
            "closes": [round(float(c), 2) if c else None for c in closes],
            "volumes":[int(v) if v else 0 for v in volumes],
        }
    except Exception as e:
        print(f"[price history error] {e}")
        return {}
