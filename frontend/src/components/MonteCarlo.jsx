import { useState, useCallback, useRef, useEffect } from "react";

// ── Pure math ────────────────────────────────────────────────────────────────
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function runSimulation(base, assumptions, n = 10000) {
  const { fcf, shares, debt, cash, wacc, growth, terminalGrowth, years } = base;
  const { waccStd, growthStd, termStd } = assumptions;
  const results = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const w  = Math.max(0.04, wacc  + randn() * waccStd);
    const g  = Math.max(0.01, growth + randn() * growthStd);
    const tg = Math.max(0.005, Math.min(terminalGrowth + randn() * termStd, w - 0.01));

    let pv = 0;
    let cf = fcf;
    for (let yr = 1; yr <= years; yr++) {
      cf *= (1 + g);
      pv += cf / Math.pow(1 + w, yr);
    }
    const tv = (cf * (1 + tg)) / (w - tg);
    pv += tv / Math.pow(1 + w, years);
    results[i] = (pv - debt + cash) / shares;
  }
  return results;
}

function buildHistogram(results, bins = 60) {
  const sorted = Array.from(results).sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const width = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  sorted.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / width), bins - 1);
    counts[idx]++;
  });
  return { counts, min, max, width, sorted };
}

function percentile(sorted, p) {
  const idx = Math.floor(p * sorted.length);
  return sorted[Math.min(idx, sorted.length - 1)];
}

// ── Canvas histogram ─────────────────────────────────────────────────────────
function Histogram({ data, currentPrice, width = 600, height = 220 }) {
  const canvasRef = useRef();
  const { counts, min, max, width: binW, sorted } = data;
  const p10 = percentile(sorted, 0.10);
  const p50 = percentile(sorted, 0.50);
  const p90 = percentile(sorted, 0.90);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = width  * dpr;
    canvas.height = height * dpr;
    canvas.style.width  = width  + "px";
    canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const pad = { top: 16, right: 16, bottom: 36, left: 48 };
    const cw = width  - pad.left - pad.right;
    const ch = height - pad.top  - pad.bottom;
    const maxCount = Math.max(...counts);

    ctx.clearRect(0, 0, width, height);

    const toX = v  => pad.left + ((v - min) / (max - min)) * cw;
    const toY = c  => pad.top  + ch - (c / maxCount) * ch;
    const bins = counts.length;

    // Draw bars
    counts.forEach((c, i) => {
      const x  = pad.left + (i / bins) * cw;
      const bw = cw / bins - 0.5;
      const barVal = min + (i + 0.5) * binW;

      let colour;
      if (barVal < p10)          colour = "rgba(239,68,68,0.7)";
      else if (barVal < p50)     colour = "rgba(245,158,11,0.6)";
      else if (barVal < p90)     colour = "rgba(16,185,129,0.6)";
      else                       colour = "rgba(16,185,129,0.35)";

      ctx.fillStyle = colour;
      ctx.fillRect(x, toY(c), bw, ch - (toY(c) - pad.top));
    });

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth   = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (i / 4) * ch;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
    }

    // Percentile lines helper
    const vline = (v, colour, label) => {
      const x = toX(v);
      ctx.strokeStyle = colour; ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + ch); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = colour; ctx.font = "bold 9px monospace"; ctx.textAlign = "center";
      ctx.fillText(label, x, pad.top - 4);
      ctx.fillText(`$${v.toFixed(0)}`, x, pad.top + ch + 14);
    };

    vline(p10,          "#ef4444", "P10");
    vline(p50,          "#f59e0b", "P50");
    vline(p90,          "#10b981", "P90");
    vline(currentPrice, "#3b82f6", "Now");

    // X-axis
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.font = "9px monospace"; ctx.textAlign = "center";
    for (let i = 0; i <= 5; i++) {
      const v = min + (i / 5) * (max - min);
      const x = pad.left + (i / 5) * cw;
      ctx.fillText(`$${Math.round(v)}`, x, height - 4);
    }
  }, [data, currentPrice, width, height]);

  return <canvas ref={canvasRef} style={{ display: "block", width: "100%" }} />;
}

// ── Main component ───────────────────────────────────────────────────────────
export default function MonteCarlo({ data, onStatsGenerated }) {
  const km = data?.key_metrics || {};
  const fcf    = km.free_cashflow;
  const shares = km.shares_outstanding;
  const debt   = km.total_debt   || 0;
  const cash   = km.total_cash   || 0;
  const price  = data?.current_price;

  const beta       = km.beta || 1.0;
  const baseWacc   = Math.min(Math.max(0.04 + beta * 0.05, 0.07), 0.15);
  const baseGrowth = Math.min(Math.max(km.revenue_growth || 0.08, 0.02), 0.25);

  const [assumptions, setAssumptions] = useState({
    wacc:          baseWacc,
    growth:        baseGrowth,
    terminalGrowth:0.025,
    years:         5,
    waccStd:       0.02,
    growthStd:     0.03,
    termStd:       0.005,
    n:             10000,
  });

  const [simData, setSimData]   = useState(null);
  const [running, setRunning]   = useState(false);
  const [stats,   setStats]     = useState(null);
  const containerRef = useRef();
  const [chartWidth, setChartWidth] = useState(560);

  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      setChartWidth((entries[0]?.contentRect.width || 600) - 32);
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const run = useCallback(() => {
    if (!fcf || fcf <= 0 || !shares) return;
    setRunning(true);
    setTimeout(() => {
      const results = runSimulation(
        { fcf, shares, debt, cash,
          wacc: assumptions.wacc, growth: assumptions.growth,
          terminalGrowth: assumptions.terminalGrowth, years: assumptions.years },
        { waccStd: assumptions.waccStd, growthStd: assumptions.growthStd, termStd: assumptions.termStd },
        assumptions.n
      );
      const hist = buildHistogram(results);
      const sorted = hist.sorted;
      const mean   = sorted.reduce((a,b) => a+b, 0) / sorted.length;
      const std    = Math.sqrt(sorted.reduce((a,b) => a+(b-mean)**2,0)/sorted.length);
      const p5   = percentile(sorted, 0.05);
      const p25  = percentile(sorted, 0.25);
      const p50  = percentile(sorted, 0.50);
      const p75  = percentile(sorted, 0.75);
      const p95  = percentile(sorted, 0.95);
      const probAbove = sorted.filter(v => v > price).length / sorted.length;
      const newStats = { mean, std, p5, p25, p50, p75, p95, prob_above: probAbove, n: sorted.length };
      setSimData(hist);
      setStats(newStats);
      if (onStatsGenerated) onStatsGenerated(newStats);
      setRunning(false);
    }, 20);
  }, [assumptions, fcf, shares, debt, cash, price]);

  const setA = (k, v) => setAssumptions(a => ({ ...a, [k]: v }));

  if (!fcf || fcf <= 0 || !shares) {
    return (
      <div className="mc-wrap">
        <div className="mc-header"><span className="mc-title">Monte Carlo DCF Simulation</span></div>
        <div style={{ padding: "32px", textAlign: "center", color: "var(--text3)", fontSize: "0.8rem" }}>
          Monte Carlo requires positive Free Cash Flow. This company does not currently qualify.
        </div>
      </div>
    );
  }

  const verdictColor = p =>
    p > 0.65 ? "var(--green2)" : p > 0.40 ? "var(--yellow2)" : "var(--red2)";

  return (
    <div className="mc-wrap" ref={containerRef}>
      <div className="mc-header">
        <div>
          <span className="mc-title">Monte Carlo DCF Simulation</span>
          <span className="mc-sub">
            Stochastic valuation — {(assumptions.n).toLocaleString()} random paths across WACC &amp; growth distributions
          </span>
        </div>
        <button className="mc-run-btn" onClick={run} disabled={running}>
          {running ? "Simulating…" : simData ? "Re-run Simulation" : "Run Simulation"}
        </button>
      </div>

      {/* Assumptions */}
      <div className="mc-assumptions">
        <div className="mc-assum-group">
          <span className="mc-assum-group-label">Base Assumptions</span>
          {[
            { k:"wacc",          label:"Base WACC",       min:0.04, max:0.20, step:0.005, pct:true },
            { k:"growth",        label:"FCF Growth",      min:0.01, max:0.40, step:0.005, pct:true },
            { k:"terminalGrowth",label:"Terminal Growth", min:0.01, max:0.05, step:0.005, pct:true },
          ].map(({ k, label, min, max, step, pct }) => (
            <div key={k} className="mc-assum-row">
              <span className="mc-assum-key">{label}</span>
              <input type="range" min={min} max={max} step={step}
                value={assumptions[k]}
                onChange={e => setA(k, parseFloat(e.target.value))}
                className="mc-slider" />
              <span className="mc-assum-val">{pct ? `${(assumptions[k]*100).toFixed(1)}%` : assumptions[k]}</span>
            </div>
          ))}
        </div>
        <div className="mc-assum-group">
          <span className="mc-assum-group-label">Uncertainty (Std Dev)</span>
          {[
            { k:"waccStd",   label:"WACC σ",   min:0.005, max:0.05, step:0.005, pct:true },
            { k:"growthStd", label:"Growth σ",  min:0.005, max:0.10, step:0.005, pct:true },
            { k:"termStd",   label:"Terminal σ",min:0.001, max:0.02, step:0.001, pct:true },
          ].map(({ k, label, min, max, step, pct }) => (
            <div key={k} className="mc-assum-row">
              <span className="mc-assum-key">{label}</span>
              <input type="range" min={min} max={max} step={step}
                value={assumptions[k]}
                onChange={e => setA(k, parseFloat(e.target.value))}
                className="mc-slider" />
              <span className="mc-assum-val">{pct ? `${(assumptions[k]*100).toFixed(1)}%` : assumptions[k]}</span>
            </div>
          ))}
        </div>
        <div className="mc-assum-group">
          <span className="mc-assum-group-label">Simulation</span>
          <div className="mc-assum-row">
            <span className="mc-assum-key">Paths</span>
            <select className="mc-select" value={assumptions.n}
              onChange={e => setA("n", parseInt(e.target.value))}>
              {[1000,5000,10000,50000].map(v => <option key={v} value={v}>{v.toLocaleString()}</option>)}
            </select>
          </div>
          <div className="mc-assum-row">
            <span className="mc-assum-key">Years</span>
            <select className="mc-select" value={assumptions.years}
              onChange={e => setA("years", parseInt(e.target.value))}>
              {[3,5,7,10].map(v => <option key={v} value={v}>{v}yr</option>)}
            </select>
          </div>
        </div>
      </div>

      {!simData && !running && (
        <div className="mc-empty">
          <div className="mc-empty-icon">∿</div>
          <p>Configure assumptions above and click <strong>Run Simulation</strong> to generate the distribution</p>
        </div>
      )}

      {running && (
        <div className="mc-empty">
          <div className="mc-spinner" />
          <p>Running {assumptions.n.toLocaleString()} Monte Carlo paths…</p>
        </div>
      )}

      {simData && stats && !running && (
        <>
          {/* Stats strip */}
          <div className="mc-stats">
            {[
              { label:"Mean",   value:`$${stats.mean.toFixed(2)}`,  sub: "Expected value" },
              { label:"Median", value:`$${stats.p50.toFixed(2)}`,   sub: "P50" },
              { label:"P5",     value:`$${stats.p5.toFixed(2)}`,    sub: "Bear case" },
              { label:"P25",    value:`$${stats.p25.toFixed(2)}`,   sub: "25th pctile" },
              { label:"P75",    value:`$${stats.p75.toFixed(2)}`,   sub: "75th pctile" },
              { label:"P95",    value:`$${stats.p95.toFixed(2)}`,   sub: "Bull case" },
              { label:"Std Dev",value:`$${stats.std.toFixed(2)}`,   sub: "Dispersion" },
            ].map((s,i) => (
              <div key={i} className="mc-stat-item">
                <span className="mc-stat-label">{s.label}</span>
                <span className="mc-stat-value">{s.value}</span>
                <span className="mc-stat-sub">{s.sub}</span>
              </div>
            ))}
          </div>

          {/* Probability of upside */}
          {price && (
            <div className="mc-prob-bar">
              <span className="mc-prob-label">Probability intrinsic value &gt; current price (${price.toFixed(2)})</span>
              <div className="mc-prob-track">
                <div className="mc-prob-fill"
                  style={{ width: `${stats.probAbove*100}%`, background: verdictColor(stats.probAbove) }} />
              </div>
              <span className="mc-prob-pct" style={{ color: verdictColor(stats.probAbove) }}>
                {(stats.probAbove*100).toFixed(1)}%
              </span>
            </div>
          )}

          {/* Histogram */}
          <div className="mc-chart-wrap">
            <Histogram data={simData} currentPrice={price} width={chartWidth} height={220} />
            <div className="mc-chart-legend">
              {[["#ef4444","Below P10 (Bear)"],["#f59e0b","P10–P50"],["#10b981","P50–P90 (Base)"],["#3b82f6","Current Price"]].map(([c,l])=>(
                <span key={l} className="mc-legend-item">
                  <span className="mc-legend-dot" style={{ background: c }} />{l}
                </span>
              ))}
            </div>
          </div>

          {/* Interpretation */}
          <div className="mc-interpretation">
            <span className="mc-interp-label">Simulation Interpretation</span>
            <p>
              Across {stats.n.toLocaleString()} random paths, the median intrinsic value is{" "}
              <strong style={{ color: "var(--text)" }}>${stats.p50.toFixed(2)}</strong> with a{" "}
              <strong style={{ color: "var(--text)" }}>P5–P95 range of ${stats.p5.toFixed(2)}–${stats.p95.toFixed(2)}</strong>.{" "}
              {price && <>
                The simulation estimates a{" "}
                <strong style={{ color: verdictColor(stats.probAbove) }}>
                  {(stats.probAbove*100).toFixed(1)}% probability
                </strong>{" "}
                that intrinsic value exceeds the current market price of ${price.toFixed(2)}.
                {stats.probAbove > 0.65 && " The distribution skews bullish relative to the current price."}
                {stats.probAbove < 0.35 && " The distribution skews bearish — most paths price in overvaluation."}
                {stats.probAbove >= 0.35 && stats.probAbove <= 0.65 && " The market price sits near the central tendency of the distribution."}
              </>}
            </p>
          </div>
        </>
      )}

      <style>{`
        .mc-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .mc-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .mc-title { display: block; font-size: 0.72rem; font-weight: 700; color: var(--text2); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
        .mc-sub { font-size: 0.7rem; color: var(--text3); }
        .mc-run-btn { background: var(--primary); color: white; border: none; padding: 9px 20px; border-radius: var(--radius); font-size: 0.78rem; font-weight: 700; cursor: pointer; font-family: inherit; letter-spacing: 0.3px; transition: background 0.15s; white-space: nowrap; }
        .mc-run-btn:hover:not(:disabled) { background: var(--primary2); }
        .mc-run-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .mc-assumptions { display: flex; gap: 24px; flex-wrap: wrap; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; }
        .mc-assum-group { display: flex; flex-direction: column; gap: 10px; min-width: 180px; flex: 1; }
        .mc-assum-group-label { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--primary2); padding-bottom: 4px; border-bottom: 1px solid var(--border); }
        .mc-assum-row { display: flex; align-items: center; gap: 8px; }
        .mc-assum-key { font-size: 0.68rem; color: var(--text3); min-width: 80px; }
        .mc-assum-val { font-size: 0.7rem; font-weight: 700; color: var(--primary2); min-width: 38px; text-align: right; }
        .mc-slider { flex: 1; accent-color: var(--primary); cursor: pointer; }
        .mc-select { background: var(--surface3); border: 1px solid var(--border2); color: var(--text); font-size: 0.72rem; padding: 3px 8px; border-radius: 4px; font-family: inherit; cursor: pointer; flex: 1; }
        .mc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; gap: 12px; color: var(--text3); text-align: center; font-size: 0.82rem; border: 1px dashed var(--border2); border-radius: var(--radius); }
        .mc-empty-icon { font-size: 2.5rem; opacity: 0.3; }
        .mc-spinner { width: 28px; height: 28px; border: 2px solid var(--border2); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .mc-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px,1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
        .mc-stat-item { background: var(--surface2); padding: 10px 14px; display: flex; flex-direction: column; gap: 2px; }
        .mc-stat-label { font-size: 0.62rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px; }
        .mc-stat-value { font-size: 0.95rem; font-weight: 700; color: var(--text); }
        .mc-stat-sub { font-size: 0.6rem; color: var(--text3); }
        .mc-prob-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .mc-prob-label { font-size: 0.7rem; color: var(--text3); white-space: nowrap; }
        .mc-prob-track { flex: 1; min-width: 120px; height: 8px; background: var(--surface3); border-radius: 4px; overflow: hidden; border: 1px solid var(--border); }
        .mc-prob-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
        .mc-prob-pct { font-size: 0.9rem; font-weight: 700; min-width: 48px; text-align: right; }
        .mc-chart-wrap { display: flex; flex-direction: column; gap: 10px; }
        .mc-chart-legend { display: flex; gap: 16px; flex-wrap: wrap; }
        .mc-legend-item { display: flex; align-items: center; gap: 5px; font-size: 0.65rem; color: var(--text3); }
        .mc-legend-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
        .mc-interpretation { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); border-left: 3px solid var(--primary); padding: 14px 18px; }
        .mc-interp-label { display: block; font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--primary2); margin-bottom: 6px; }
        .mc-interpretation p { font-size: 0.78rem; color: var(--text2); line-height: 1.7; }
      `}</style>
    </div>
  );
}
