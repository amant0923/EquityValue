import { useState, useMemo } from "react";

const fmt = (n, type = "currency") => {
  if (n == null || isNaN(n) || !isFinite(n)) return "—";
  if (type === "currency") {
    const abs = Math.abs(n), sign = n < 0 ? "-" : "";
    if (abs >= 1e12) return `${sign}$${(abs/1e12).toFixed(2)}T`;
    if (abs >= 1e9)  return `${sign}$${(abs/1e9).toFixed(2)}B`;
    if (abs >= 1e6)  return `${sign}$${(abs/1e6).toFixed(2)}M`;
    return `${sign}$${abs.toFixed(1)}M`;
  }
  if (type === "pct")   return `${(n*100).toFixed(1)}%`;
  if (type === "x")     return `${n.toFixed(2)}x`;
  if (type === "price") return `$${n.toFixed(2)}`;
  return n.toFixed(2);
};

const irrColor  = v => !v || isNaN(v) ? "var(--text)" : v >= 0.20 ? "var(--green2)" : v >= 0.12 ? "var(--yellow2)" : "var(--red2)";
const moicColor = v => !v || isNaN(v) ? "var(--text)" : v >= 2.5 ? "var(--green2)" : v >= 1.5 ? "var(--yellow2)" : "var(--red2)";
const levColor  = v => !v || isNaN(v) ? "var(--text)" : v <= 4 ? "var(--green2)" : v <= 6 ? "var(--yellow2)" : "var(--red2)";

// Newton's method IRR
function calcIRR(cashflows, guess = 0.20, maxIter = 200) {
  let r = guess;
  for (let i = 0; i < maxIter; i++) {
    let npv = 0, dnpv = 0;
    cashflows.forEach((cf, t) => {
      const d = Math.pow(1 + r, t);
      npv  += cf / d;
      dnpv -= t * cf / (d * (1 + r));
    });
    const nr = r - npv / dnpv;
    if (Math.abs(nr - r) < 1e-8) return nr;
    r = nr;
  }
  return r;
}

function runLBO(params, data) {
  const {
    entryEVEBITDA, exitEVEBITDA, holdingYears,
    debtPct, debtCost, revenueGrowth, ebitdaMarginImprovement,
    managementRollover,
  } = params;

  const km      = data?.key_metrics || {};
  const ebitda0 = km.ebitda   || 0;
  const rev0    = km.revenue  || 0;
  const debt0   = km.total_debt || 0;
  const cash0   = km.total_cash || 0;
  const shares  = km.shares_outstanding || 1;
  const price   = data?.current_price || 0;

  if (!ebitda0 || ebitda0 <= 0) return null;

  // Entry
  const entryEV      = entryEVEBITDA * ebitda0;
  const entryEquity  = entryEV - debt0 + cash0;
  const debtFunded   = entryEV * debtPct;
  const equityFunded = entryEV * (1 - debtPct);
  const premiumPct   = price > 0 ? (entryEquity / shares - price) / price : 0;

  // Annual projections
  const years = Array.from({ length: holdingYears + 1 }, (_, i) => i);
  const proj  = years.map(yr => {
    const rev    = rev0 * Math.pow(1 + revenueGrowth, yr);
    const margin = (ebitda0 / rev0) + ebitdaMarginImprovement * yr;
    const ebitda = rev * margin;
    const fcf    = ebitda * 0.6; // rough: after tax, capex, wc
    return { yr, rev, ebitda, fcf };
  });

  // Debt schedule — simple: pay down from FCF
  let debtBal = debtFunded;
  const debtSchedule = [debtBal];
  proj.slice(1).forEach(({ fcf }) => {
    const interest  = debtBal * debtCost;
    const repayment = Math.max(0, Math.min(fcf - interest, debtBal));
    debtBal = Math.max(0, debtBal - repayment);
    debtSchedule.push(debtBal);
  });

  // Exit
  const exitYear   = proj[holdingYears];
  const exitEV     = exitEVEBITDA * exitYear.ebitda;
  const exitDebt   = debtSchedule[holdingYears];
  const exitEquity = exitEV - exitDebt;
  const mgmtShare  = managementRollover / 100;
  const peEquity   = exitEquity * (1 - mgmtShare);

  // Returns
  const moic = equityFunded > 0 ? peEquity / equityFunded : null;
  const cfs  = [-equityFunded, ...proj.slice(1).map(() => 0)];
  cfs[holdingYears] += peEquity;
  let irr = null;
  try { irr = calcIRR(cfs); } catch {}

  // Sensitivity table — IRR across entry/exit multiples
  // Sensitivity: vary exit multiples (rows) and entry multiples (cols)
  // Ensure exit multiples are always plausible vs entry to avoid all-null tables
  const sensEntries = [entryEVEBITDA - 2, entryEVEBITDA, entryEVEBITDA + 2];
  const baseExit = Math.max(exitEVEBITDA, entryEVEBITDA - 2);
  const sensExits = [baseExit + 4, baseExit + 2, baseExit];
  const sensTable   = sensExits.map(exM =>
    sensEntries.map(enM => {
      const eEV  = enM * ebitda0;
      const eEq  = eEV * (1 - debtPct);
      const xEV  = exM * exitYear.ebitda;
      const xEq  = xEV - debtSchedule[holdingYears];
      const xPE  = xEq * (1 - mgmtShare);
      const cf2  = [-eEq, ...Array(holdingYears - 1).fill(0), xPE];
      try {
        const r = calcIRR(cf2);
        return isFinite(r) && r > -1 ? r : null;
      } catch { return null; }
    })
  );

  return {
    entryEV, entryEquity, entryEVEBITDA,
    debtFunded, equityFunded, premiumPct,
    proj, debtSchedule,
    exitEV, exitEquity, exitDebt, peEquity,
    moic, irr,
    sensTable, sensEntries, sensExits,
    exitYear,
  };
}

// ── Stat cell ────────────────────────────────────────────────────────────────
function Stat({ label, value, sub, color }) {
  return (
    <div className="lbo-stat">
      <span className="lbo-stat-label">{label}</span>
      <span className="lbo-stat-value" style={color ? { color } : {}}>{value}</span>
      {sub && <span className="lbo-stat-sub">{sub}</span>}
    </div>
  );
}

export default function LBOModel({ data, onResultGenerated }) {
  const km    = data?.key_metrics || {};
  const ebitda = km.ebitda;
  const price  = data?.current_price;

  const [params, setParams] = useState({
    entryEVEBITDA:           km.ev_ebitda ? parseFloat(km.ev_ebitda.toFixed(1)) : 12,
    exitEVEBITDA:            km.ev_ebitda ? parseFloat((km.ev_ebitda + 2).toFixed(1)) : 14,
    holdingYears:            5,
    debtPct:                 0.60,
    debtCost:                0.07,
    revenueGrowth:           Math.min(Math.max(km.revenue_growth || 0.06, 0.02), 0.20),
    ebitdaMarginImprovement: 0.005,
    managementRollover:      10,
  });

  const setP = (k, v) => setParams(p => ({ ...p, [k]: v }));

  const result = useMemo(() => {
    if (!ebitda || ebitda <= 0) return null;
    const r = runLBO(params, data);
    if (r && onResultGenerated) onResultGenerated({
      irr: r.irr, moic: r.moic,
      entry_ev: r.entryEV, exit_ev: r.exitEV,
      entry_ev_ebitda: params.entryEVEBITDA, exit_ev_ebitda: params.exitEVEBITDA,
      hold_years: params.holdingYears, debt_pct: params.debtPct,
      pe_equity: r.peEquity,
    });
    return r;
  }, [params, data]);

  if (!ebitda || ebitda <= 0) {
    return (
      <div className="lbo-wrap">
        <div className="lbo-header"><span className="lbo-title">LBO Quick Model</span></div>
        <div style={{ padding:"32px", textAlign:"center", color:"var(--text3)", fontSize:"0.8rem" }}>
          LBO model requires positive EBITDA. This company does not currently qualify.
        </div>
      </div>
    );
  }

  const r = result;

  return (
    <div className="lbo-wrap">
      <div className="lbo-header">
        <div>
          <span className="lbo-title">LBO Quick Model</span>
          <span className="lbo-sub">Leveraged buyout returns analysis — entry, debt structure, exit &amp; IRR</span>
        </div>
        {r?.irr != null && (
          <div className="lbo-irr-badge" style={{ color: irrColor(r.irr), borderColor: irrColor(r.irr)+"44", background: irrColor(r.irr)+"11" }}>
            IRR: {fmt(r.irr, "pct")} &nbsp;·&nbsp; MOIC: {r.moic?.toFixed(2)}x
          </div>
        )}
      </div>

      {/* Parameters */}
      <div className="lbo-params">
        <div className="lbo-param-group">
          <span className="lbo-param-group-label">Entry & Structure</span>
          {[
            { k:"entryEVEBITDA", label:"Entry EV/EBITDA", min:4, max:25, step:0.5, disp: v => `${v.toFixed(1)}x` },
            { k:"debtPct",       label:"Debt / EV",       min:0.2, max:0.85, step:0.05, disp: v => `${(v*100).toFixed(0)}%` },
            { k:"debtCost",      label:"Cost of Debt",    min:0.03, max:0.15, step:0.005, disp: v => `${(v*100).toFixed(1)}%` },
          ].map(({ k, label, min, max, step, disp }) => (
            <div key={k} className="lbo-param-row">
              <span className="lbo-param-key">{label}</span>
              <input type="range" min={min} max={max} step={step}
                value={params[k]} onChange={e => setP(k, parseFloat(e.target.value))}
                className="lbo-slider" />
              <span className="lbo-param-val">{disp(params[k])}</span>
            </div>
          ))}
        </div>
        <div className="lbo-param-group">
          <span className="lbo-param-group-label">Exit & Value Creation</span>
          {[
            { k:"exitEVEBITDA",            label:"Exit EV/EBITDA",     min:4, max:25, step:0.5,  disp: v => `${v.toFixed(1)}x` },
            { k:"holdingYears",            label:"Hold Period",         min:2, max:10, step:1,    disp: v => `${v}yr` },
            { k:"revenueGrowth",           label:"Rev Growth (p.a.)",   min:0, max:0.25, step:0.005, disp: v => `${(v*100).toFixed(1)}%` },
            { k:"ebitdaMarginImprovement", label:"Margin Improvement",  min:0, max:0.03, step:0.001, disp: v => `+${(v*100).toFixed(1)}% p.a.` },
            { k:"managementRollover",      label:"Mgmt Rollover",       min:0, max:30,  step:1,    disp: v => `${v}%` },
          ].map(({ k, label, min, max, step, disp }) => (
            <div key={k} className="lbo-param-row">
              <span className="lbo-param-key">{label}</span>
              <input type="range" min={min} max={max} step={step}
                value={params[k]} onChange={e => setP(k, parseFloat(e.target.value))}
                className="lbo-slider" />
              <span className="lbo-param-val">{disp(params[k])}</span>
            </div>
          ))}
        </div>
      </div>

      {r && (
        <>
          {/* Sources & Uses */}
          <div className="lbo-su-grid">
            <div className="lbo-su-box">
              <span className="lbo-su-title">Sources of Funds</span>
              <div className="lbo-su-row"><span>Debt</span><span style={{ color:"var(--red2)" }}>{fmt(r.debtFunded)}</span></div>
              <div className="lbo-su-row"><span>PE Equity</span><span style={{ color:"var(--primary2)" }}>{fmt(r.equityFunded)}</span></div>
              <div className="lbo-su-row lbo-su-total"><span>Total</span><span>{fmt(r.entryEV)}</span></div>
            </div>
            <div className="lbo-su-box">
              <span className="lbo-su-title">Uses of Funds</span>
              <div className="lbo-su-row"><span>Enterprise Value</span><span>{fmt(r.entryEV)}</span></div>
              <div className="lbo-su-row lbo-su-total"><span>Entry EV/EBITDA</span><span>{fmt(params.entryEVEBITDA, "x")}</span></div>
              {price > 0 && <div className="lbo-su-row"><span>Implied Premium</span>
                <span style={{ color: r.premiumPct >= 0 ? "var(--green2)" : "var(--red2)" }}>
                  {r.premiumPct >= 0 ? "+" : ""}{fmt(r.premiumPct, "pct")}
                </span>
              </div>}
            </div>
          </div>

          {/* Key returns */}
          <div className="lbo-returns-grid">
            <Stat label="IRR"        value={fmt(r.irr, "pct")}    color={irrColor(r.irr)}   sub={r.irr >= 0.20 ? "✓ Meets typical PE hurdle" : r.irr >= 0.12 ? "Below 20% hurdle" : "Below hurdle"} />
            <Stat label="MOIC"       value={`${r.moic?.toFixed(2)}x`} color={moicColor(r.moic)} sub="Money-on-invested-capital" />
            <Stat label="Exit EV"    value={fmt(r.exitEV)}         sub={`${params.exitEVEBITDA}x exit EBITDA`} />
            <Stat label="Exit Equity" value={fmt(r.exitEquity)}    sub="Total equity at exit" />
            <Stat label="PE Equity"  value={fmt(r.peEquity)}       sub={`After ${params.managementRollover}% mgmt`} />
            <Stat label="Entry Debt" value={fmt(r.debtFunded)}     sub={`${(params.debtPct*100).toFixed(0)}% of EV`} />
            <Stat label="Exit Debt"  value={fmt(r.debtSchedule?.[params.holdingYears])} color={levColor(r.debtSchedule?.[params.holdingYears] / r.exitYear?.ebitda)} sub="Residual debt at exit" />
            <Stat label="Net Leverage" value={r.exitYear?.ebitda > 0 ? `${((r.debtSchedule?.[params.holdingYears] || 0) / r.exitYear.ebitda).toFixed(1)}x` : "—"} sub="Exit Net Debt / EBITDA" />
          </div>

          {/* Projection table */}
          <div className="lbo-table-wrap">
            <table className="lbo-table">
              <thead>
                <tr>
                  <th className="lbo-th lbo-th--label">Year</th>
                  {r.proj.map(p => <th key={p.yr} className="lbo-th">{p.yr === 0 ? "Entry" : `Y${p.yr}`}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  { label:"Revenue",   key:"rev" },
                  { label:"EBITDA",    key:"ebitda" },
                  { label:"FCF",       key:"fcf" },
                ].map(({ label, key }) => (
                  <tr key={label}>
                    <td className="lbo-td lbo-td--label">{label}</td>
                    {r.proj.map((p,i) => (
                      <td key={i} className="lbo-td"
                        style={key==="fcf" ? {color: p[key]>=0?"var(--green2)":"var(--red2)"} : {}}>
                        {fmt(p[key])}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="lbo-td lbo-td--label">Debt Balance</td>
                  {r.debtSchedule.map((d,i) => (
                    <td key={i} className="lbo-td" style={{ color: "var(--red2)" }}>{fmt(d)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="lbo-td lbo-td--label lbo-td--bold">Net Leverage</td>
                  {r.proj.map((p,i) => {
                    const lev = p.ebitda > 0 ? r.debtSchedule[i] / p.ebitda : null;
                    return <td key={i} className="lbo-td lbo-td--bold" style={{ color: levColor(lev) }}>
                      {lev != null ? `${lev.toFixed(1)}x` : "—"}
                    </td>;
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* IRR Sensitivity */}
          <div className="lbo-sens-wrap">
            <div className="lbo-sens-header">
              <span className="lbo-sens-title">IRR Sensitivity — Entry vs Exit Multiple</span>
            </div>
            <div className="lbo-sens-table-wrap">
              <table className="lbo-sens-table">
                <thead>
                  <tr>
                    <th className="lbo-sens-corner">Exit ↓ / Entry →</th>
                    {r.sensEntries.map(e => <th key={e} className="lbo-sens-th">{e.toFixed(1)}x</th>)}
                  </tr>
                </thead>
                <tbody>
                  {r.sensExits.map((ex, ri) => (
                    <tr key={ex}>
                      <td className="lbo-sens-row-label">{ex.toFixed(1)}x</td>
                      {r.sensTable[ri].map((irr, ci) => {
                        const bg = irr == null ? "transparent"
                          : irr >= 0.20 ? "rgba(16,185,129,0.18)"
                          : irr >= 0.12 ? "rgba(245,158,11,0.14)"
                          : "rgba(239,68,68,0.14)";
                        const col = irr == null ? "var(--text3)"
                          : irr >= 0.20 ? "var(--green2)"
                          : irr >= 0.12 ? "var(--yellow2)"
                          : "var(--red2)";
                        const isBase = Math.abs(ex - params.exitEVEBITDA) < 0.01 && Math.abs(r.sensEntries[ci] - params.entryEVEBITDA) < 0.01;
                        return (
                          <td key={ci} style={{ background: bg, color: col, outline: isBase ? "2px solid var(--primary)" : "none" }} className="lbo-sens-td">
                            {irr != null ? `${(irr*100).toFixed(1)}%` : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="lbo-sens-legend">
              <span><span className="lbo-sens-dot" style={{background:"rgba(16,185,129,0.4)"}}/> ≥20% IRR (PE hurdle)</span>
              <span><span className="lbo-sens-dot" style={{background:"rgba(245,158,11,0.4)"}}/> 12–20%</span>
              <span><span className="lbo-sens-dot" style={{background:"rgba(239,68,68,0.4)"}}/> &lt;12%</span>
              <span style={{marginLeft:"auto", fontSize:"0.65rem", color:"var(--text3)"}}>Outlined cell = base case</span>
            </div>
          </div>
        </>
      )}

      <style>{`
        .lbo-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .lbo-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .lbo-title { display: block; font-size: 0.72rem; font-weight: 700; color: var(--text2); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
        .lbo-sub { font-size: 0.7rem; color: var(--text3); }
        .lbo-irr-badge { font-size: 0.72rem; font-weight: 700; padding: 5px 14px; border-radius: var(--radius); border: 1px solid; white-space: nowrap; }
        .lbo-params { display: flex; gap: 24px; flex-wrap: wrap; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; }
        .lbo-param-group { display: flex; flex-direction: column; gap: 10px; flex: 1; min-width: 200px; }
        .lbo-param-group-label { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--primary2); padding-bottom: 6px; border-bottom: 1px solid var(--border); }
        .lbo-param-row { display: flex; align-items: center; gap: 8px; }
        .lbo-param-key { font-size: 0.67rem; color: var(--text3); min-width: 110px; }
        .lbo-param-val { font-size: 0.7rem; font-weight: 700; color: var(--primary2); min-width: 52px; text-align: right; }
        .lbo-slider { flex: 1; accent-color: var(--primary); cursor: pointer; }
        .lbo-su-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .lbo-su-box { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 18px; display: flex; flex-direction: column; gap: 8px; }
        .lbo-su-title { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text3); margin-bottom: 4px; }
        .lbo-su-row { display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text2); }
        .lbo-su-total { border-top: 1px solid var(--border); padding-top: 6px; font-weight: 700; color: var(--text); }
        .lbo-returns-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px,1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
        .lbo-stat { background: var(--surface2); padding: 12px 16px; display: flex; flex-direction: column; gap: 3px; }
        .lbo-stat-label { font-size: 0.62rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px; }
        .lbo-stat-value { font-size: 1.05rem; font-weight: 700; color: var(--text); }
        .lbo-stat-sub { font-size: 0.6rem; color: var(--text3); }
        .lbo-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); }
        .lbo-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
        .lbo-th { padding: 9px 14px; text-align: right; font-size: 0.68rem; font-weight: 700; color: var(--text3); border-bottom: 1px solid var(--border); background: var(--surface2); }
        .lbo-th--label { text-align: left; min-width: 120px; }
        .lbo-td { padding: 7px 14px; text-align: right; border-bottom: 1px solid var(--border); color: var(--text); font-size: 0.75rem; }
        .lbo-td--label { text-align: left; color: var(--text2); }
        .lbo-td--bold { font-weight: 700; }
        .lbo-tr:last-child td { border-bottom: none; }
        .lbo-sens-wrap { display: flex; flex-direction: column; gap: 12px; }
        .lbo-sens-header { display: flex; align-items: center; justify-content: space-between; }
        .lbo-sens-title { font-size: 0.7rem; font-weight: 700; color: var(--text2); text-transform: uppercase; letter-spacing: 0.6px; }
        .lbo-sens-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); }
        .lbo-sens-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
        .lbo-sens-th { padding: 9px 16px; text-align: center; font-size: 0.68rem; font-weight: 700; color: var(--primary2); border-bottom: 1px solid var(--border); background: var(--surface2); }
        .lbo-sens-corner { padding: 9px 14px; text-align: left; font-size: 0.65rem; color: var(--text3); border-bottom: 1px solid var(--border); background: var(--surface2); white-space: nowrap; }
        .lbo-sens-row-label { padding: 9px 14px; font-size: 0.72rem; font-weight: 700; color: var(--primary2); border-bottom: 1px solid var(--border); background: var(--surface2); white-space: nowrap; }
        .lbo-sens-td { padding: 9px 16px; text-align: center; font-weight: 700; font-size: 0.78rem; border-bottom: 1px solid var(--border); }
        .lbo-sens-legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 0.67rem; color: var(--text3); align-items: center; }
        .lbo-sens-dot { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
      `}</style>
    </div>
  );
}
