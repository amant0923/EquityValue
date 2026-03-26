import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

const fmt = (v, decimals = 2) =>
  v != null ? Number(v).toFixed(decimals) : "-";

const pct = (v, decimals = 2) =>
  v != null ? `${(Number(v) * 100).toFixed(decimals)}%` : "-";

function statColor(val) {
  if (val == null) return "var(--text)";
  return val >= 0 ? "var(--green2)" : "var(--red)";
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: "0.75rem",
        color: "var(--text)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.bin}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <span style={{ color: "var(--text3)" }}>Count:</span>
        <span className="mono" style={{ fontWeight: 600 }}>{d.count}</span>
      </div>
    </div>
  );
};

export default function RiskDistribution({ data }) {
  if (!data) return null;

  const { histogram, distribution, var_summary } = data;

  /* Transform bins + counts into chart data */
  const chartData = (histogram?.bins || []).map((bin, i) => {
    const mid = typeof bin === "number" ? bin : (bin[0] + bin[1]) / 2;
    return {
      bin: (mid * 100).toFixed(2) + "%",
      midRaw: mid,
      count: histogram.counts?.[i] ?? 0,
    };
  });

  const mean = distribution?.mean ?? 0;
  const std = distribution?.std ?? 1;

  /* Quantile reference lines */
  const qLines = [];
  if (histogram?.quantile_lines) {
    const ql = histogram.quantile_lines;
    if (ql.q5 != null)
      qLines.push({ val: (ql.q5 * 100).toFixed(2) + "%", label: "5th %ile" });
    if (ql.q95 != null)
      qLines.push({ val: (ql.q95 * 100).toFixed(2) + "%", label: "95th %ile" });
  }

  /* Bar color: blue center, red tails */
  function barFill(midRaw) {
    const dist = Math.abs(midRaw - mean) / (std || 1);
    if (dist > 2) return "var(--red)";
    if (dist > 1.5) return "#e06040";
    if (dist > 1) return "#b07030";
    return "var(--primary)";
  }

  /* Stats grid data */
  const annReturn = distribution?.mean != null ? distribution.mean * 252 : null;
  const annVol = distribution?.std != null ? distribution.std * Math.sqrt(252) : null;

  const stats = [
    { label: "Ann. Return", value: pct(annReturn), raw: annReturn },
    { label: "Ann. Volatility", value: pct(annVol), raw: annVol != null ? -annVol : null },
    { label: "Sharpe", value: fmt(var_summary?.sharpe_ratio), raw: var_summary?.sharpe_ratio },
    { label: "Sortino", value: fmt(var_summary?.sortino_ratio), raw: var_summary?.sortino_ratio },
    {
      label: "Max Drawdown",
      value: pct(var_summary?.max_drawdown),
      raw: var_summary?.max_drawdown,
    },
    { label: "Skewness", value: fmt(distribution?.skewness), raw: distribution?.skewness },
  ];

  const isNormal = distribution?.is_normal;

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <style>{`
        .risk-dist-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .risk-dist-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text);
        }
        .risk-normal-badge {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 12px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .risk-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 14px;
        }
        .risk-stat-cell {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 10px;
          text-align: center;
        }
        .risk-stat-label {
          font-size: 0.65rem;
          color: var(--text3);
          margin-bottom: 2px;
        }
        .risk-stat-value {
          font-size: 0.85rem;
          font-weight: 700;
          font-family: "SF Mono", "Fira Code", monospace;
        }
      `}</style>

      <div className="risk-dist-title-row">
        <span className="risk-dist-title">Return Distribution</span>
        <span
          className="risk-normal-badge"
          style={{
            color: isNormal ? "var(--green2)" : "var(--red)",
            background: isNormal
              ? "rgba(34,197,94,0.12)"
              : "rgba(239,68,68,0.12)",
          }}
        >
          {isNormal ? "Normal" : "Non-Normal"}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
          <XAxis
            dataKey="bin"
            tick={{ fontSize: 9, fill: "var(--text3)" }}
            interval="preserveStartEnd"
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "var(--text3)" }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          {qLines.map((ql, i) => (
            <ReferenceLine
              key={i}
              x={ql.val}
              stroke="var(--red)"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{
                value: ql.label,
                fill: "var(--red)",
                fontSize: 9,
                position: "top",
              }}
            />
          ))}
          <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={20}>
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={barFill(entry.midRaw)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="risk-stats-grid">
        {stats.map((s) => (
          <div className="risk-stat-cell" key={s.label}>
            <div className="risk-stat-label">{s.label}</div>
            <div className="risk-stat-value" style={{ color: statColor(s.raw) }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
