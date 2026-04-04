"""Build the comprehensive investment memo prompt for Claude.

Gathers all available data for a ticker from Supabase cache tables and
constructs a structured prompt that gives Claude full context: fundamentals,
valuation models, technicals, risk, macro, governance, estimates, peer
comparisons, analyst sentiment, insider activity, SWOT/PESTLE, and more.
"""
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _pjson(row: dict) -> dict:
    """Parse any double-encoded JSON string fields in a Supabase row."""
    for key, val in row.items():
        if isinstance(val, str) and val and val[0] in ('{', '['):
            try:
                row[key] = json.loads(val)
            except (ValueError, TypeError):
                pass
    return row


def _safe_query(sb, table: str, ticker: str, *, select="*", single=True,
                order_col=None, desc=True, limit=None, eq_col="ticker"):
    """Fetch from Supabase with full error handling. Returns dict, list, or None."""
    try:
        q = sb.table(table).select(select).eq(eq_col, ticker)
        if order_col:
            q = q.order(order_col, desc=desc)
        if limit:
            q = q.limit(limit)
        elif single:
            q = q.limit(1)
        rows = q.execute().data
        if not rows:
            return None
        if single:
            return _pjson(rows[0])
        return [_pjson(r) for r in rows]
    except Exception as e:
        logger.debug("thesis_prompt: %s query failed for %s: %s", table, ticker, e)
        return None


def _fmt(v, prefix="", suffix="", decimals=1):
    if v is None:
        return "N/A"
    try:
        n = float(v)
        if abs(n) >= 1e12:
            return f"{prefix}{n/1e12:.{decimals}f}T{suffix}"
        if abs(n) >= 1e9:
            return f"{prefix}{n/1e9:.{decimals}f}B{suffix}"
        if abs(n) >= 1e6:
            return f"{prefix}{n/1e6:.{decimals}f}M{suffix}"
        return f"{prefix}{n:,.{decimals}f}{suffix}"
    except (ValueError, TypeError):
        return str(v)


def _pct(v):
    if v is None:
        return "N/A"
    try:
        return f"{float(v):.1f}%"
    except (ValueError, TypeError):
        return str(v)


def _val(v):
    return v if v is not None else "N/A"


# ── Data gatherers ───────────────────────────────────────────────────────────

def _gather_all_data(sb, ticker: str, sector: str) -> dict:
    """Fetch every data source from Supabase for the given ticker."""
    data = {}

    # Technicals
    data["technicals"] = _safe_query(sb, "technicals_cache", ticker)

    # Risk
    data["risk"] = _safe_query(sb, "risk_analysis_cache", ticker)

    # Analyst
    data["analyst"] = _safe_query(sb, "analyst_data", ticker)

    # Scores (Altman Z, Piotroski, DCF)
    data["scores"] = _safe_query(sb, "company_scores", ticker)

    # EVS
    data["evs"] = _safe_query(sb, "equity_value_scores", ticker)

    # Governance
    data["governance"] = _safe_query(sb, "governance_cache", ticker)

    # WACC
    data["wacc"] = _safe_query(sb, "wacc_cache", ticker)

    # Estimates
    data["estimates"] = _safe_query(sb, "estimates_cache", ticker)

    # SWOT / PESTLE
    data["qualitative"] = _safe_query(sb, "qualitative_cache", ticker)

    # Insider trades (recent 20)
    data["insider"] = _safe_query(
        sb, "insider_trades", ticker, single=False,
        order_col="filing_date", limit=20,
    )

    # Senate trades
    data["senate"] = _safe_query(
        sb, "senate_trades", ticker, single=False,
        order_col="transaction_date", limit=10,
    )

    # Earnings history (recent 8 quarters)
    data["earnings"] = _safe_query(
        sb, "earnings_history", ticker, single=False,
        order_col="date", limit=8,
    )

    # Revenue segments
    data["segments"] = _safe_query(
        sb, "revenue_segments", ticker, single=False,
        order_col="period_date", limit=20,
    )

    # Growth metrics (recent annual)
    data["growth"] = _safe_query(
        sb, "growth_metrics", ticker, single=False,
        order_col="period_date", limit=4,
    )

    # Key metrics (recent annual)
    data["metrics"] = _safe_query(
        sb, "key_metrics", ticker, single=False,
        order_col="period_date", limit=4,
    )

    # Dividends (recent)
    data["dividends"] = _safe_query(
        sb, "dividends_history", ticker, single=False,
        order_col="ex_date", limit=8,
    )

    # Peer comparison
    try:
        peers = sb.table("stock_fundamentals").select(
            "ticker,name,market_cap,pe_ratio,pb_ratio,ps_ratio,ev_to_ebitda,"
            "profit_margin,revenue_growth,roe,beta,dividend_yield,forward_pe"
        ).eq("sector", sector).neq("ticker", ticker) \
            .order("market_cap", desc=True).limit(5).execute().data or []
        data["peers"] = peers
    except Exception:
        data["peers"] = []

    # Macro overview
    try:
        macro_row = sb.table("macro_cache").select("current") \
            .eq("id", "global").limit(1).execute().data
        if macro_row:
            current = macro_row[0].get("current")
            if isinstance(current, str):
                current = json.loads(current)
            data["macro"] = current
        else:
            data["macro"] = None
    except Exception:
        data["macro"] = None

    # Sector macro
    try:
        sector_row = sb.table("macro_sector_cache").select("indicators") \
            .eq("sector", sector).limit(1).execute().data
        if sector_row:
            indicators = sector_row[0].get("indicators")
            if isinstance(indicators, str):
                indicators = json.loads(indicators)
            data["sector_macro"] = indicators
        else:
            data["sector_macro"] = None
    except Exception:
        data["sector_macro"] = None

    return data


# ── Prompt section builders ──────────────────────────────────────────────────

def _section_technicals(tech: dict) -> str:
    if not tech:
        return ""
    lines = ["TECHNICAL ANALYSIS:"]

    price_data = tech.get("price", {})
    if isinstance(price_data, dict):
        lines.append(f"- Last Close: ${_val(price_data.get('close'))}")
        lines.append(f"- 52-Week Range: ${_val(price_data.get('low_52w'))} – ${_val(price_data.get('high_52w'))}")

    # Moving averages
    sma = tech.get("sma", {})
    ema = tech.get("ema", {})
    if isinstance(sma, dict):
        lines.append(f"- SMA 20/50/200: {_val(sma.get('sma_20'))} / {_val(sma.get('sma_50'))} / {_val(sma.get('sma_200'))}")
    if isinstance(ema, dict):
        lines.append(f"- EMA 12/26: {_val(ema.get('ema_12'))} / {_val(ema.get('ema_26'))}")

    # Momentum
    rsi = tech.get("rsi", {})
    if isinstance(rsi, dict):
        lines.append(f"- RSI (14): {_val(rsi.get('rsi_14'))} (signal: {_val(rsi.get('signal'))})")

    macd = tech.get("macd", {})
    if isinstance(macd, dict):
        lines.append(f"- MACD: {_val(macd.get('macd_line'))} | Signal: {_val(macd.get('signal_line'))} | Histogram: {_val(macd.get('histogram'))} ({_val(macd.get('signal'))})")

    # Bollinger Bands
    bb = tech.get("bollinger", {})
    if isinstance(bb, dict):
        lines.append(f"- Bollinger Bands: Lower {_val(bb.get('lower'))} / Mid {_val(bb.get('middle'))} / Upper {_val(bb.get('upper'))}")

    # Supertrend
    st = tech.get("supertrend", {})
    if isinstance(st, dict):
        lines.append(f"- Supertrend: {_val(st.get('value'))} ({_val(st.get('signal'))})")

    # Signals summary
    signals = tech.get("signals", {})
    if isinstance(signals, dict):
        lines.append(f"- Overall Signal: {_val(signals.get('overall'))} (Buy: {_val(signals.get('buy_count'))}, Sell: {_val(signals.get('sell_count'))}, Neutral: {_val(signals.get('neutral_count'))})")

    return "\n".join(lines)


def _section_risk(risk: dict) -> str:
    if not risk:
        return ""
    lines = ["RISK ANALYSIS:"]

    var_summary = risk.get("var_summary", {})
    if isinstance(var_summary, dict):
        lines.append(f"- Value at Risk (95%): {_pct(var_summary.get('var_95'))}")
        lines.append(f"- Value at Risk (99%): {_pct(var_summary.get('var_99'))}")
        lines.append(f"- Expected Shortfall (95%): {_pct(var_summary.get('cvar_95'))}")

    dist = risk.get("distribution", {})
    if isinstance(dist, dict):
        lines.append(f"- Daily Volatility: {_pct(dist.get('std_dev'))}")
        lines.append(f"- Skewness: {_val(dist.get('skewness'))} | Kurtosis: {_val(dist.get('kurtosis'))}")
        lines.append(f"- Sharpe Ratio: {_val(dist.get('sharpe_ratio'))} | Sortino Ratio: {_val(dist.get('sortino_ratio'))}")
        lines.append(f"- Max Drawdown: {_pct(dist.get('max_drawdown'))}")

    return "\n".join(lines)


def _section_analyst(analyst: dict) -> str:
    if not analyst:
        return ""
    lines = ["ANALYST CONSENSUS:"]
    lines.append(f"- Rating: {_val(analyst.get('consensus_rating'))} ({_val(analyst.get('num_analysts'))} analysts)")
    lines.append(f"- Price Target: Low ${_val(analyst.get('target_low'))} / Avg ${_val(analyst.get('target_mean'))} / High ${_val(analyst.get('target_high'))}")

    recent = analyst.get("recent_grades", [])
    if isinstance(recent, str):
        try:
            recent = json.loads(recent)
        except Exception:
            recent = []
    if recent and isinstance(recent, list):
        last_3 = recent[:3]
        for g in last_3:
            if isinstance(g, dict):
                lines.append(f"  - {_val(g.get('firm'))}: {_val(g.get('previous'))} → {_val(g.get('current'))} ({_val(g.get('date'))})")

    return "\n".join(lines)


def _section_scores(scores: dict) -> str:
    if not scores:
        return ""
    lines = ["FINANCIAL HEALTH SCORES:"]
    lines.append(f"- Altman Z-Score: {_val(scores.get('altman_z_score'))}")
    lines.append(f"- Piotroski F-Score: {_val(scores.get('piotroski_score'))}")
    lines.append(f"- DCF Intrinsic Value: ${_val(scores.get('dcf_value'))}")
    return "\n".join(lines)


def _section_evs(evs: dict) -> str:
    if not evs:
        return ""
    lines = ["EQUITY VALUE SCORE (EVS):"]
    lines.append(f"- Overall Score: {_val(evs.get('score'))}/100 ({_val(evs.get('verdict'))})")
    components = evs.get("components", {})
    if isinstance(components, dict):
        for k, v in components.items():
            if isinstance(v, dict):
                lines.append(f"  - {k.replace('_', ' ').title()}: {_val(v.get('score'))}/100 (weight: {_val(v.get('weight'))})")
            else:
                lines.append(f"  - {k.replace('_', ' ').title()}: {_val(v)}")
    return "\n".join(lines)


def _section_governance(gov: dict) -> str:
    if not gov:
        return ""
    lines = ["CORPORATE GOVERNANCE:"]

    execs = gov.get("executives", [])
    if isinstance(execs, list) and execs:
        ceo = next((e for e in execs if "CEO" in str(e.get("title", "")).upper()), execs[0] if execs else None)
        if ceo and isinstance(ceo, dict):
            lines.append(f"- CEO: {_val(ceo.get('name'))} (pay: {_fmt(ceo.get('pay'), prefix='$')})")

    inst = gov.get("institutional_holders", [])
    if isinstance(inst, list) and inst:
        top_3 = inst[:3]
        holders = ", ".join(
            f"{h.get('holder', 'N/A')} ({_pct(h.get('pct_held'))})"
            for h in top_3 if isinstance(h, dict)
        )
        if holders:
            lines.append(f"- Top Institutional: {holders}")

    cap = gov.get("capital_structure", {})
    if isinstance(cap, dict):
        lines.append(f"- Shares Outstanding: {_fmt(cap.get('shares_outstanding'))}")
        lines.append(f"- Float: {_fmt(cap.get('float_shares'))}")
        lines.append(f"- Insider Ownership: {_pct(cap.get('insider_pct'))}")
        lines.append(f"- Institutional Ownership: {_pct(cap.get('institutional_pct'))}")

    return "\n".join(lines)


def _section_wacc(wacc: dict) -> str:
    if not wacc:
        return ""
    lines = ["WACC:"]
    lines.append(f"- WACC: {_pct(wacc.get('wacc'))}")
    components = wacc.get("components", {})
    if isinstance(components, dict):
        lines.append(f"- Cost of Equity: {_pct(components.get('cost_of_equity'))}")
        lines.append(f"- Cost of Debt: {_pct(components.get('cost_of_debt'))}")
        lines.append(f"- Risk-Free Rate: {_pct(components.get('risk_free_rate'))}")
        lines.append(f"- Equity Risk Premium: {_pct(components.get('equity_risk_premium'))}")
        lines.append(f"- Beta (levered): {_val(components.get('beta'))}")
    cap_struct = wacc.get("capital_structure", {})
    if isinstance(cap_struct, dict):
        lines.append(f"- Debt/Total Capital: {_pct(cap_struct.get('debt_weight'))}")
        lines.append(f"- Equity/Total Capital: {_pct(cap_struct.get('equity_weight'))}")
    return "\n".join(lines)


def _section_estimates(est: dict) -> str:
    if not est:
        return ""
    estimates = est.get("estimates", {})
    if isinstance(estimates, str):
        try:
            estimates = json.loads(estimates)
        except Exception:
            return ""
    if not estimates:
        return ""
    lines = ["FORWARD CONSENSUS ESTIMATES:"]
    for period_key in ("annual", "quarterly"):
        period_data = estimates.get(period_key, [])
        if isinstance(period_data, list):
            for item in period_data[:4]:
                if isinstance(item, dict):
                    period = item.get("period") or item.get("date", "?")
                    lines.append(f"  [{period}] Rev: {_fmt(item.get('revenue'), prefix='$')} | EPS: {_val(item.get('eps'))} | EBITDA: {_fmt(item.get('ebitda'), prefix='$')}")
            if period_data:
                lines.append("")
    return "\n".join(lines).rstrip()


def _section_insider(trades: list) -> str:
    if not trades:
        return ""
    lines = ["INSIDER TRADING (RECENT):"]
    buys = sum(1 for t in trades if isinstance(t, dict) and str(t.get("transaction_type", "")).upper() in ("BUY", "P-PURCHASE", "PURCHASE"))
    sells = sum(1 for t in trades if isinstance(t, dict) and str(t.get("transaction_type", "")).upper() in ("SELL", "S-SALE", "SALE"))
    lines.append(f"- Summary: {buys} buys, {sells} sells in recent filings")
    for t in trades[:5]:
        if isinstance(t, dict):
            lines.append(f"  - {_val(t.get('reporter_name'))}: {_val(t.get('transaction_type'))} {_fmt(abs(float(t.get('shares_traded', 0))), decimals=0)} shares @ ${_val(t.get('price'))} ({_val(t.get('filing_date'))})")
    return "\n".join(lines)


def _section_senate(trades: list) -> str:
    if not trades:
        return ""
    lines = ["SENATE TRADING:"]
    for t in trades[:5]:
        if isinstance(t, dict):
            lines.append(f"  - {_val(t.get('senator_name'))} ({_val(t.get('party'))}): {_val(t.get('transaction_type'))} {_val(t.get('amount_range'))} ({_val(t.get('transaction_date'))})")
    return "\n".join(lines)


def _section_earnings(earnings: list) -> str:
    if not earnings:
        return ""
    lines = ["EARNINGS HISTORY (RECENT QUARTERS):"]
    beats = sum(1 for e in earnings if isinstance(e, dict) and (e.get("eps_actual") or 0) > (e.get("eps_estimate") or 0))
    lines.append(f"- Beat Rate: {beats}/{len(earnings)} quarters")
    for e in earnings[:6]:
        if isinstance(e, dict):
            actual = e.get("eps_actual")
            estimate = e.get("eps_estimate")
            surprise = ""
            if actual is not None and estimate is not None:
                try:
                    diff = float(actual) - float(estimate)
                    surprise = f" ({'beat' if diff > 0 else 'miss'} by ${abs(diff):.2f})"
                except (ValueError, TypeError):
                    pass
            lines.append(f"  - {_val(e.get('date'))}: EPS ${_val(actual)} vs est ${_val(estimate)}{surprise}")
    return "\n".join(lines)


def _section_segments(segments: list) -> str:
    if not segments:
        return ""
    lines = ["REVENUE SEGMENTS:"]
    product_segs = [s for s in segments if isinstance(s, dict) and s.get("segment_type") == "product"]
    geo_segs = [s for s in segments if isinstance(s, dict) and s.get("segment_type") == "geographic"]

    # Deduplicate to latest period
    def _latest(seg_list):
        if not seg_list:
            return []
        latest_date = max(s.get("period_date", "") for s in seg_list)
        return [s for s in seg_list if s.get("period_date") == latest_date]

    for label, segs in [("By Product/Service", _latest(product_segs)), ("By Geography", _latest(geo_segs))]:
        if segs:
            lines.append(f"  {label}:")
            for s in segs:
                lines.append(f"    - {_val(s.get('segment_name'))}: {_fmt(s.get('revenue'), prefix='$')}")

    return "\n".join(lines)


def _section_growth(growth_list: list) -> str:
    if not growth_list:
        return ""
    lines = ["GROWTH TRENDS (ANNUAL):"]
    latest = growth_list[0] if growth_list else {}
    if isinstance(latest, dict):
        lines.append(f"- Revenue Growth: {_pct(latest.get('revenue_growth'))}")
        lines.append(f"- EPS Growth: {_pct(latest.get('eps_growth'))}")
        lines.append(f"- Net Income Growth: {_pct(latest.get('net_income_growth'))}")
        lines.append(f"- FCF Growth: {_pct(latest.get('free_cash_flow_growth'))}")
        lines.append(f"- Operating Income Growth: {_pct(latest.get('operating_income_growth'))}")
        # Show trend over multiple years if available
        if len(growth_list) >= 2:
            prev = growth_list[1]
            if isinstance(prev, dict):
                lines.append(f"- Prior Year Revenue Growth: {_pct(prev.get('revenue_growth'))}")
    return "\n".join(lines)


def _section_dividends(divs: list) -> str:
    if not divs:
        return ""
    lines = ["DIVIDEND HISTORY:"]
    latest = divs[0] if divs else {}
    if isinstance(latest, dict):
        lines.append(f"- Latest: ${_val(latest.get('amount'))} on {_val(latest.get('ex_date'))}")
        lines.append(f"- Yield: {_pct(latest.get('yield'))}")
        lines.append(f"- Frequency: {_val(latest.get('frequency'))}")
    return "\n".join(lines)


def _section_peers(peers: list, ticker: str) -> str:
    if not peers:
        return ""
    lines = ["PEER COMPARISON (SAME SECTOR):"]
    lines.append(f"{'Ticker':<8} {'P/E':>8} {'Fwd P/E':>8} {'P/S':>8} {'EV/EBITDA':>10} {'Margin':>8} {'RevGr':>8} {'ROE':>8} {'Beta':>6}")
    lines.append("-" * 80)
    for p in peers:
        if isinstance(p, dict):
            lines.append(
                f"{p.get('ticker', '?'):<8} "
                f"{_val(p.get('pe_ratio')):>8} "
                f"{_val(p.get('forward_pe')):>8} "
                f"{_val(p.get('ps_ratio')):>8} "
                f"{_val(p.get('ev_to_ebitda')):>10} "
                f"{_pct(p.get('profit_margin')):>8} "
                f"{_pct(p.get('revenue_growth')):>8} "
                f"{_pct(p.get('roe')):>8} "
                f"{_val(p.get('beta')):>6}"
            )
    return "\n".join(lines)


def _section_qualitative(qual: dict) -> str:
    if not qual:
        return ""
    lines = []

    swot = qual.get("swot")
    if isinstance(swot, str):
        try:
            swot = json.loads(swot)
        except Exception:
            swot = None
    if isinstance(swot, dict):
        lines.append("SWOT ANALYSIS:")
        for key in ("strengths", "weaknesses", "opportunities", "threats"):
            items = swot.get(key, [])
            if isinstance(items, list) and items:
                lines.append(f"  {key.title()}:")
                for item in items[:3]:
                    lines.append(f"    - {item if isinstance(item, str) else _val(item)}")

    pestle = qual.get("pestle")
    if isinstance(pestle, str):
        try:
            pestle = json.loads(pestle)
        except Exception:
            pestle = None
    if isinstance(pestle, dict):
        lines.append("PESTLE ANALYSIS:")
        for key in ("political", "economic", "social", "technological", "legal", "environmental"):
            items = pestle.get(key, [])
            if isinstance(items, list) and items:
                lines.append(f"  {key.title()}:")
                for item in items[:2]:
                    lines.append(f"    - {item if isinstance(item, str) else _val(item)}")

    return "\n".join(lines)


def _section_macro(macro: dict, sector_macro: dict) -> str:
    lines = []
    if macro and isinstance(macro, dict):
        lines.append("MACROECONOMIC ENVIRONMENT:")
        lines.append(f"- GDP Growth (YoY): {_pct(macro.get('gdp_growth'))}")
        lines.append(f"- Inflation (CPI YoY): {_pct(macro.get('inflation_rate'))}")
        lines.append(f"- Fed Funds Rate: {_pct(macro.get('fed_funds_rate'))}")
        lines.append(f"- Consumer Confidence: {_val(macro.get('consumer_confidence'))}")
        lines.append(f"- Unemployment Rate: {_pct(macro.get('unemployment_rate'))}")

    if sector_macro and isinstance(sector_macro, dict):
        lines.append("SECTOR-SPECIFIC MACRO INDICATORS:")
        for series_id, data_points in sector_macro.items():
            if isinstance(data_points, list) and data_points:
                latest = data_points[-1] if data_points else {}
                if isinstance(latest, dict):
                    lines.append(f"  - {series_id}: {_val(latest.get('value'))} (as of {_val(latest.get('date'))})")

    return "\n".join(lines)


# ── Main prompt builder ──────────────────────────────────────────────────────

def build_thesis_prompt(
    ticker: str,
    data: dict,
    valuation: dict,
    sb,
) -> str:
    """Build the full investment memo prompt with all available data.

    Args:
        ticker: Stock ticker symbol
        data: Normalised company fundamentals from fetch_stock_data + normalise()
        valuation: Output from run_valuation()
        sb: Supabase client instance
    """
    consensus = valuation.get("consensus", {})
    metrics = valuation.get("key_metrics", {})
    applicable = [v for v in valuation.get("valuations", []) if v.get("applicable")]
    sector = data.get("sector", "Technology")
    today = datetime.utcnow().strftime('%d %B %Y')

    # Gather all supplementary data from Supabase
    extra = _gather_all_data(sb, ticker, sector) if sb else {}

    # ── Assemble prompt sections ─────────────────────────────────────────

    valuation_lines = "\n".join([
        f"- {v['model']}: ${v['intrinsic_value']} ({v['verdict']}, {v['upside_pct']}% upside)"
        for v in applicable
    ])

    sections = []

    # Core fundamentals (always available)
    sections.append(f"""COMPANY OVERVIEW:
- Name: {data.get('name', ticker)} ({ticker})
- Sector: {_val(data.get('sector'))} | Industry: {_val(data.get('industry'))}
- Current Price: ${_val(data.get('price'))}
- Market Cap: {_fmt(data.get('market_cap'), prefix='$')}
- Enterprise Value: {_fmt(data.get('enterprise_value'), prefix='$')}
- Revenue (TTM): {_fmt(data.get('revenue'), prefix='$')}
- EBITDA: {_fmt(data.get('ebitda'), prefix='$')}
- Net Income: {_fmt(data.get('net_income'), prefix='$')}
- Free Cash Flow: {_fmt(data.get('free_cashflow'), prefix='$')}
- Total Cash: {_fmt(data.get('cash'), prefix='$')}
- Total Debt: {_fmt(data.get('total_debt'), prefix='$')}""")

    sections.append(f"""KEY VALUATION METRICS:
- P/E: {_val(metrics.get('pe_ratio'))} | Forward P/E: {_val(data.get('forward_pe'))}
- EV/EBITDA: {_val(metrics.get('ev_ebitda'))} | EV/Revenue: {_val(data.get('ev_to_revenue'))}
- P/S: {_val(metrics.get('ps_ratio'))} | P/B: {_val(data.get('pb_ratio'))}
- PEG Ratio: {_val(data.get('peg_ratio'))}
- ROE: {_pct(metrics.get('roe'))} | ROA: {_pct(data.get('roa'))}
- Profit Margin: {_pct(metrics.get('profit_margin'))} | Operating Margin: {_pct(data.get('operating_margin'))}
- EBITDA Margin: {_pct(data.get('ebitda_margin'))}
- Revenue Growth: {_pct(metrics.get('revenue_growth'))} | Earnings Growth: {_pct(data.get('earnings_growth'))}
- Debt/Equity: {_val(data.get('debt_to_equity'))} | Current Ratio: {_val(data.get('current_ratio'))}
- Beta: {_val(metrics.get('beta'))}
- Dividend Yield: {_pct(data.get('dividend_yield'))} | Payout Ratio: {_pct(data.get('payout_ratio'))}""")

    sections.append(f"""VALUATION MODELS APPLIED:
{valuation_lines}

CONSENSUS: {_val(consensus.get('overall_verdict'))} at ${_val(consensus.get('average_intrinsic_value'))} ({_val(consensus.get('upside_pct'))}% vs current price)""")

    # Supplementary sections — each only appears if data exists
    for builder, key in [
        (_section_evs, "evs"),
        (_section_scores, "scores"),
        (_section_wacc, "wacc"),
        (_section_technicals, "technicals"),
        (_section_risk, "risk"),
        (_section_analyst, "analyst"),
        (_section_earnings, "earnings"),
        (_section_insider, "insider"),
        (_section_senate, "senate"),
        (_section_growth, "growth"),
        (_section_estimates, "estimates"),
        (_section_segments, "segments"),
        (_section_dividends, "dividends"),
        (_section_governance, "governance"),
        (_section_qualitative, "qualitative"),
    ]:
        section = builder(extra.get(key))
        if section:
            sections.append(section)

    # Peers
    peers_section = _section_peers(extra.get("peers", []), ticker)
    if peers_section:
        sections.append(peers_section)

    # Macro
    macro_section = _section_macro(extra.get("macro"), extra.get("sector_macro"))
    if macro_section:
        sections.append(macro_section)

    data_block = "\n\n".join(sections)

    # ── Final prompt ─────────────────────────────────────────────────────

    prompt = f"""You are a senior equity research analyst at a top-tier investment bank writing an institutional-grade investment memo.

Today's date is {today}. Use this exact date in the memo header.

You have been given comprehensive data on {data.get('name', ticker)} ({ticker}) spanning fundamentals, valuation models, technical indicators, risk metrics, analyst consensus, insider activity, earnings track record, growth trends, forward estimates, peer comparisons, governance, macroeconomic conditions, and qualitative analysis. Synthesize ALL of this data — do not ignore any section.

<data>
{data_block}
</data>

Write a thorough investment memo using this exact structure. Each section must reference specific data points from above — never make vague claims without numbers to back them up.

## Executive Summary
A 3-4 sentence thesis that captures: the investment case, the key risk/reward asymmetry, and your verdict. Include the current price, your target price, and the implied upside/downside.

## Company & Industry Context
Position the company within its sector and industry. Reference market cap, revenue scale, and how it ranks vs peers. Incorporate any relevant macroeconomic factors (rates, inflation, GDP) that affect this company's outlook.

## Financial Analysis
Analyze profitability (margins, ROE, ROA), growth trajectory (revenue/EPS growth, forward estimates), and balance sheet strength (debt/equity, current ratio, cash position, Altman Z-Score, Piotroski F-Score). Compare key metrics against peer averages where the data is available. Highlight the WACC and what it implies for value creation.

## Valuation Assessment
Walk through each valuation model applied and what they collectively suggest. Address where the models agree and disagree. Reference the EVS score and its component breakdown. Use the DCF value and consensus price target as anchors.

## Technical Outlook
Summarize the current technical posture: trend (SMA 50 vs 200), momentum (RSI, MACD), volatility (Bollinger Bands), and any key support/resistance levels. State whether technicals confirm or contradict the fundamental thesis.

## Risk Profile
Quantify risk: VaR, max drawdown, Sharpe/Sortino ratios, beta. Reference the SWOT and PESTLE factors. Address the bear case honestly — what could go wrong, and how severe could losses be?

## Catalysts & Sentiment
Analyst ratings trajectory (upgrades/downgrades), insider buy/sell patterns, earnings beat rate, and any notable senate trading activity. What near-term events could move the stock?

## Investment Recommendation
Issue a clear **BUY**, **HOLD**, or **SELL** rating.
- State your 12-month price target with the valuation basis
- Define upside and downside scenarios with price levels
- List 3 key catalysts to watch
- Specify what would change your rating

Be direct, data-dense, and analytical. Every claim must cite a number from the data. Write like a Goldman Sachs analyst, not a chatbot. No hedging language like "it's worth noting" or "investors should consider" — just state your analysis."""

    return prompt
