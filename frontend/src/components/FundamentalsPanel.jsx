const fmt = (n, type = "number") => {
  if (n == null) return "—";
  if (type === "currency") {
    if (Math.abs(n) >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
    if (Math.abs(n) >= 1e9)  return `$${(n/1e9).toFixed(2)}B`;
    if (Math.abs(n) >= 1e6)  return `$${(n/1e6).toFixed(2)}M`;
    return `$${n.toFixed(0)}`;
  }
  if (type === "pct")    return `${(n * 100).toFixed(1)}%`;
  if (type === "ratio")  return Number(n).toFixed(2);
  if (type === "price")  return `$${Number(n).toFixed(2)}`;
  return String(n);
};

const color = (v, goodIfHigh = true) => {
  if (v == null) return "var(--text)";
  return (v > 0) === goodIfHigh ? "var(--green2)" : "var(--red2)";
};

function Section({ title, rows }) {
  return (
    <div className="fp-section">
      <div className="fp-section-title">{title}</div>
      <div className="fp-rows">
        {rows.map(([label, value, colored, good], i) => (
          <div key={i} className="fp-row">
            <span className="fp-label">{label}</span>
            <span className="fp-value" style={colored ? { color: color(typeof colored === "number" ? colored : null, good !== false) } : {}}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FundamentalsPanel({ data }) {
  if (!data) return null;
  const km = data.key_metrics || {};
  const an = data.analyst || {};

  const incomeRows = [
    ["Revenue",           fmt(km.revenue, "currency")],
    ["Gross Profit",      fmt(km.gross_profit, "currency")],
    ["EBITDA",            fmt(km.ebitda, "currency")],
    ["Net Income",        fmt(km.net_income, "currency"), km.net_income, true],
    ["EPS (TTM)",         fmt(km.eps, "price")],
    ["Forward EPS",       fmt(km.forward_eps, "price")],
    ["Revenue Growth",    fmt(km.revenue_growth, "pct"), km.revenue_growth, true],
    ["Earnings Growth",   fmt(km.earnings_growth, "pct"), km.earnings_growth, true],
  ];

  const marginRows = [
    ["Profit Margin",     fmt(km.profit_margin, "pct"), km.profit_margin, true],
    ["Operating Margin",  fmt(km.operating_margin, "pct"), km.operating_margin, true],
    ["ROE",               fmt(km.roe, "pct"), km.roe, true],
    ["ROA",               fmt(km.roa, "pct"), km.roa, true],
  ];

  const balanceRows = [
    ["Total Debt",        fmt(km.total_debt, "currency"), km.total_debt ? -1 : null, true],
    ["Total Cash",        fmt(km.total_cash, "currency"), km.total_cash, true],
    ["Free Cash Flow",    fmt(km.free_cashflow, "currency"), km.free_cashflow, true],
    ["Debt / Equity",     fmt(km.debt_to_equity, "ratio"), km.debt_to_equity != null ? -km.debt_to_equity : null, true],
    ["Current Ratio",     fmt(km.current_ratio, "ratio"), km.current_ratio ? km.current_ratio - 1 : null, true],
  ];

  const valuationRows = [
    ["P/E Ratio",         fmt(km.pe_ratio, "ratio")],
    ["Forward P/E",       fmt(km.forward_pe, "ratio")],
    ["P/B Ratio",         fmt(km.pb_ratio, "ratio")],
    ["P/S Ratio",         fmt(km.ps_ratio, "ratio")],
    ["PEG Ratio",         fmt(km.peg_ratio, "ratio")],
    ["EV/EBITDA",         fmt(km.ev_ebitda, "ratio")],
    ["EV/Revenue",        fmt(km.ev_to_revenue, "ratio")],
    ["Beta",              fmt(km.beta, "ratio")],
  ];

  const shareRows = [
    ["Shares Outstanding", fmt(km.shares_outstanding, "currency").replace("$","")],
    ["Market Cap",         fmt(data.market_cap, "currency")],
    ["Enterprise Value",   fmt(km.enterprise_value, "currency")],
    ["Book Value/Share",   fmt(km.book_value_per_share, "price")],
    ["52W High",           fmt(km["52w_high"], "price")],
    ["52W Low",            fmt(km["52w_low"], "price")],
    ["Dividend Yield",     fmt(km.dividend_yield, "pct")],
    ["Dividend Rate",      fmt(km.dividend_rate, "price")],
    ["Payout Ratio",       fmt(km.payout_ratio, "pct")],
  ];

  return (
    <div className="fp-wrap">
      <div className="fp-header">
        <span className="fp-title">Fundamental Data</span>
        <span className="fp-sub">All figures sourced live from Yahoo Finance</span>
      </div>
      <div className="fp-grid">
        <Section title="Income Statement" rows={incomeRows} />
        <Section title="Profitability" rows={marginRows} />
        <Section title="Balance Sheet & Cash Flow" rows={balanceRows} />
        <Section title="Valuation Multiples" rows={valuationRows} />
        <Section title="Share & Market Data" rows={shareRows} />
      </div>
      <style>{`
        .fp-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 22px 24px; }
        .fp-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 20px; }
        .fp-title { font-size: 0.72rem; font-weight: 700; color: var(--text2); text-transform: uppercase; letter-spacing: 0.8px; }
        .fp-sub { font-size: 0.68rem; color: var(--text3); }
        .fp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 24px; }
        .fp-section { display: flex; flex-direction: column; gap: 2px; }
        .fp-section-title { font-size: 0.68rem; font-weight: 700; color: var(--primary2); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
        .fp-rows { display: flex; flex-direction: column; gap: 0; }
        .fp-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid var(--border); }
        .fp-row:last-child { border-bottom: none; }
        .fp-label { font-size: 0.72rem; color: var(--text3); }
        .fp-value { font-size: 0.75rem; font-weight: 600; color: var(--text); }
      `}</style>
    </div>
  );
}
