import { useState } from "react";

const fmt = (n, type = "currency") => {
  if (n == null || isNaN(n)) return "—";
  if (type === "currency") {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1e12) return `${sign}$${(abs/1e12).toFixed(1)}T`;
    if (abs >= 1e9)  return `${sign}$${(abs/1e9).toFixed(1)}B`;
    if (abs >= 1e6)  return `${sign}$${(abs/1e6).toFixed(1)}M`;
    return `${sign}$${abs.toFixed(0)}`;
  }
  if (type === "pct") return `${(n*100).toFixed(1)}%`;
  if (type === "ratio") return n.toFixed(2);
  if (type === "x") return `${n.toFixed(1)}x`;
  return String(n);
};

const pctColor = v => {
  if (v == null) return "var(--text)";
  return v >= 0 ? "var(--green2)" : "var(--red2)";
};

function buildProjections(data, assumptions) {
  const km = data.key_metrics || {};
  const baseRev    = km.revenue || 0;
  const baseEbitda = km.ebitda  || 0;
  const baseNI     = km.net_income || 0;
  const baseFCF    = km.free_cashflow || 0;
  const baseDebt   = km.total_debt || 0;
  const baseCash   = km.total_cash || 0;
  const baseCapex  = baseFCF < 0 ? 0 : (km.operating_cashflow || baseFCF) - baseFCF;

  const { revGrowth, ebitdaMargin, taxRate, capexPct, daRate, wcPct } = assumptions;

  const years = [-2, -1, 0, 1, 2, 3, 4, 5];
  const currentYear = new Date().getFullYear();

  return years.map((offset, i) => {
    const year = currentYear + offset;
    const isActual = offset <= 0;
    const label = isActual ? (offset === 0 ? `${year}E` : `${year}A`) : `${year}E`;

    let rev, ebitda, ni, fcf, debt, cash;

    if (offset === 0) {
      // Base year = actuals
      rev    = baseRev;
      ebitda = baseEbitda;
      ni     = baseNI;
      fcf    = baseFCF;
      debt   = baseDebt;
      cash   = baseCash;
    } else if (offset < 0) {
      // Historical — estimate backwards with slight variation
      const factor = Math.pow(1 - (revGrowth * 0.8), Math.abs(offset));
      rev    = baseRev * factor;
      ebitda = rev * (ebitdaMargin - 0.01 * Math.abs(offset));
      ni     = ebitda * (1 - taxRate) * 0.7;
      fcf    = ni * 0.85;
      debt   = baseDebt * (1 + 0.05 * Math.abs(offset));
      cash   = baseCash * (1 - 0.05 * Math.abs(offset));
    } else {
      // Forward projections
      const factor = Math.pow(1 + revGrowth, offset);
      rev    = baseRev * factor;
      ebitda = rev * ebitdaMargin;
      const da     = rev * daRate;
      const ebit   = ebitda - da;
      ni     = ebit * (1 - taxRate);
      const capex  = rev * capexPct;
      const wc     = rev * wcPct * (offset > 1 ? revGrowth : 0);
      fcf    = ni + da - capex - wc;
      // Simple debt paydown from FCF
      debt   = Math.max(0, baseDebt - fcf * (offset * 0.3));
      cash   = baseCash + fcf * 0.4 * offset;
    }

    const ebitdaMgn = rev ? ebitda / rev : null;
    const niMgn     = rev ? ni / rev : null;
    const netLeverage = ebitda > 0 ? (debt - cash) / ebitda : null;

    return { year, label, isActual, rev, ebitda, ebitdaMgn, ni, niMgn, fcf, debt, cash, netLeverage };
  });
}

function Row({ label, values, type = "currency", bold, highlight, indent, colorFn }) {
  return (
    <tr className={`tsm-tr ${bold ? "tsm-tr--bold" : ""} ${highlight ? "tsm-tr--highlight" : ""}`}>
      <td className={`tsm-td tsm-td--label ${indent ? "tsm-td--indent" : ""}`}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className="tsm-td tsm-td--num" style={colorFn ? { color: colorFn(v) } : {}}>
          {fmt(v, type)}
        </td>
      ))}
    </tr>
  );
}

function DividerRow({ cols }) {
  return (
    <tr>
      <td colSpan={cols + 1} style={{ height: "1px", background: "var(--border)", padding: 0 }} />
    </tr>
  );
}

export default function ThreeStatementModel({ data }) {
  const km = data?.key_metrics || {};
  const [tab, setTab] = useState("income");
  const [assumptions, setAssumptions] = useState({
    revGrowth:    Math.min(Math.max(km.revenue_growth || 0.08, 0.02), 0.30),
    ebitdaMargin: km.ebitda && km.revenue ? km.ebitda / km.revenue : 0.20,
    taxRate:      0.21,
    capexPct:     0.04,
    daRate:       0.03,
    wcPct:        0.02,
  });

  if (!km.revenue) return null;

  const proj = buildProjections(data, assumptions);
  const fwdYears = proj.filter(p => !p.isActual);
  const allYears = proj;

  const setA = (key, val) => setAssumptions(a => ({ ...a, [key]: val }));

  const TABS = [
    { id: "income",  label: "Income Statement" },
    { id: "cashflow",label: "Cash Flow" },
    { id: "balance", label: "Balance Sheet" },
    { id: "credit",  label: "Credit Metrics" },
  ];

  return (
    <div className="tsm-wrap">
      <div className="tsm-header">
        <div>
          <span className="tsm-title">3-Statement Financial Model</span>
          <span className="tsm-sub">Historical & projected financials with adjustable assumptions</span>
        </div>
        <div className="tsm-badge">5-Year Projection</div>
      </div>

      {/* Assumptions bar */}
      <div className="tsm-assumptions">
        <span className="tsm-assum-label">Assumptions</span>
        {[
          { key: "revGrowth",    label: "Rev. Growth",    min: 0, max: 0.5,  step: 0.01, display: "pct" },
          { key: "ebitdaMargin", label: "EBITDA Margin",  min: 0, max: 0.6,  step: 0.01, display: "pct" },
          { key: "taxRate",      label: "Tax Rate",       min: 0, max: 0.4,  step: 0.01, display: "pct" },
          { key: "capexPct",     label: "Capex % Rev",    min: 0, max: 0.2,  step: 0.005, display: "pct" },
        ].map(({ key, label, min, max, step, display }) => (
          <div key={key} className="tsm-assum-item">
            <span className="tsm-assum-key">{label}</span>
            <input
              type="range" min={min} max={max} step={step}
              value={assumptions[key]}
              onChange={e => setA(key, parseFloat(e.target.value))}
              className="tsm-slider"
            />
            <span className="tsm-assum-val">
              {display === "pct" ? `${(assumptions[key]*100).toFixed(1)}%` : assumptions[key].toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tsm-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`tsm-tab ${tab === t.id ? "tsm-tab--active" : ""}`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Table */}
      <div className="tsm-table-wrap">
        <table className="tsm-table">
          <thead>
            <tr>
              <th className="tsm-th tsm-th--label"></th>
              {allYears.map(y => (
                <th key={y.year} className={`tsm-th ${!y.isActual ? "tsm-th--proj" : ""}`}>
                  {y.label}
                  {!y.isActual && <div className="tsm-th-proj-badge">Proj.</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tab === "income" && <>
              <Row label="Revenue"         values={allYears.map(y => y.rev)}     bold />
              <Row label="  YoY Growth"    values={allYears.map((y,i) => i === 0 ? null : (y.rev - allYears[i-1].rev) / allYears[i-1].rev)} type="pct" indent colorFn={pctColor} />
              <DividerRow cols={allYears.length} />
              <Row label="EBITDA"          values={allYears.map(y => y.ebitda)}  bold />
              <Row label="  EBITDA Margin" values={allYears.map(y => y.ebitdaMgn)} type="pct" indent colorFn={pctColor} />
              <DividerRow cols={allYears.length} />
              <Row label="Net Income"      values={allYears.map(y => y.ni)}      bold colorFn={pctColor} />
              <Row label="  Net Margin"    values={allYears.map(y => y.niMgn)}   type="pct" indent colorFn={pctColor} />
            </>}

            {tab === "cashflow" && <>
              <Row label="Net Income"      values={allYears.map(y => y.ni)}      bold />
              <Row label="(+) D&A"         values={allYears.map(y => y.rev * assumptions.daRate)} indent />
              <Row label="(-) Capex"       values={allYears.map(y => -y.rev * assumptions.capexPct)} indent colorFn={v => v < 0 ? "var(--red2)" : "var(--text)"} />
              <DividerRow cols={allYears.length} />
              <Row label="Free Cash Flow"  values={allYears.map(y => y.fcf)}     bold colorFn={pctColor} highlight />
              <Row label="  FCF Margin"    values={allYears.map(y => y.rev ? y.fcf / y.rev : null)} type="pct" indent colorFn={pctColor} />
            </>}

            {tab === "balance" && <>
              <Row label="Cash & Equivalents" values={allYears.map(y => y.cash)} bold colorFn={pctColor} />
              <DividerRow cols={allYears.length} />
              <Row label="Total Debt"      values={allYears.map(y => y.debt)}    bold colorFn={v => v > 0 ? "var(--red2)" : "var(--green2)"} />
              <DividerRow cols={allYears.length} />
              <Row label="Net Debt"        values={allYears.map(y => y.debt - y.cash)} bold highlight colorFn={v => v > 0 ? "var(--red2)" : "var(--green2)"} />
            </>}

            {tab === "credit" && <>
              <Row label="EBITDA"              values={allYears.map(y => y.ebitda)} bold />
              <Row label="Total Debt"          values={allYears.map(y => y.debt)} colorFn={v => v > 0 ? "var(--red2)" : "var(--green2)"} />
              <Row label="Cash"                values={allYears.map(y => y.cash)} colorFn={pctColor} />
              <DividerRow cols={allYears.length} />
              <Row label="Net Debt / EBITDA"   values={allYears.map(y => y.netLeverage)} type="x" bold highlight
                colorFn={v => v == null ? "var(--text)" : v < 2 ? "var(--green2)" : v < 4 ? "var(--yellow2)" : "var(--red2)"} />
              <Row label="Interest Coverage"
                values={allYears.map(y => {
                  const intExp = y.debt * 0.05;
                  return intExp > 0 ? y.ebitda / intExp : null;
                })}
                type="x" colorFn={v => v == null ? "var(--text)" : v > 3 ? "var(--green2)" : v > 1.5 ? "var(--yellow2)" : "var(--red2)"} />
              <Row label="FCF / Debt"
                values={allYears.map(y => y.debt > 0 ? y.fcf / y.debt : null)}
                type="pct" colorFn={pctColor} />
            </>}
          </tbody>
        </table>
      </div>

      {/* Forward summary strip */}
      <div className="tsm-fwd-strip">
        {fwdYears.slice(0,5).map(y => (
          <div key={y.year} className="tsm-fwd-item">
            <span className="tsm-fwd-year">{y.label}</span>
            <span className="tsm-fwd-rev">{fmt(y.rev)}</span>
            <span className="tsm-fwd-ebitda" style={{ color: "var(--green2)" }}>{fmt(y.ebitda)}</span>
            <span className="tsm-fwd-fcf" style={{ color: y.fcf >= 0 ? "var(--green2)" : "var(--red2)" }}>{fmt(y.fcf)} FCF</span>
          </div>
        ))}
      </div>

      <style>{`
        .tsm-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .tsm-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .tsm-title { display: block; font-size: 0.72rem; font-weight: 700; color: var(--text2); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
        .tsm-sub { font-size: 0.7rem; color: var(--text3); }
        .tsm-badge { font-size: 0.68rem; font-weight: 700; padding: 3px 10px; border-radius: 3px; background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.2); color: var(--primary2); letter-spacing: 0.5px; }
        .tsm-assumptions { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; }
        .tsm-assum-label { font-size: 0.65rem; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: 0.8px; white-space: nowrap; }
        .tsm-assum-item { display: flex; align-items: center; gap: 8px; }
        .tsm-assum-key { font-size: 0.65rem; color: var(--text3); white-space: nowrap; }
        .tsm-assum-val { font-size: 0.72rem; font-weight: 700; color: var(--primary2); min-width: 36px; text-align: right; }
        .tsm-slider { width: 80px; accent-color: var(--primary); cursor: pointer; }
        .tsm-tabs { display: flex; gap: 2px; background: var(--surface2); padding: 3px; border-radius: var(--radius); width: fit-content; border: 1px solid var(--border); }
        .tsm-tab { background: transparent; border: none; color: var(--text3); font-size: 0.72rem; font-weight: 600; padding: 6px 14px; border-radius: 5px; cursor: pointer; font-family: inherit; transition: all 0.15s; letter-spacing: 0.3px; }
        .tsm-tab--active { background: var(--surface3); color: var(--text); border: 1px solid var(--border2); }
        .tsm-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); }
        .tsm-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
        .tsm-th { padding: 10px 14px; text-align: right; font-size: 0.68rem; font-weight: 700; color: var(--text3); border-bottom: 1px solid var(--border); background: var(--surface2); white-space: nowrap; letter-spacing: 0.3px; }
        .tsm-th--label { text-align: left; min-width: 160px; }
        .tsm-th--proj { color: var(--primary2); background: rgba(37,99,235,0.05); }
        .tsm-th-proj-badge { font-size: 0.55rem; color: var(--primary2); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 1px; }
        .tsm-td { padding: 7px 14px; text-align: right; border-bottom: 1px solid var(--border); color: var(--text); white-space: nowrap; }
        .tsm-td--label { text-align: left; color: var(--text2); font-weight: 500; }
        .tsm-td--indent { padding-left: 24px; color: var(--text3); font-size: 0.7rem; }
        .tsm-tr--bold td { font-weight: 700; color: var(--text); }
        .tsm-tr--highlight td { background: rgba(37,99,235,0.04); }
        .tsm-tr:last-child td { border-bottom: none; }
        .tsm-fwd-strip { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
        .tsm-fwd-item { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; }
        .tsm-fwd-year { font-size: 0.65rem; font-weight: 700; color: var(--primary2); text-transform: uppercase; letter-spacing: 0.5px; }
        .tsm-fwd-rev { font-size: 0.82rem; font-weight: 700; color: var(--text); }
        .tsm-fwd-ebitda { font-size: 0.72rem; font-weight: 600; }
        .tsm-fwd-fcf { font-size: 0.68rem; }
      `}</style>
    </div>
  );
}
