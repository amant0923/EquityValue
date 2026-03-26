import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  Legend,
} from "recharts";

const pct = (v, decimals = 2) =>
  v != null ? `${(Number(v) * 100).toFixed(decimals)}%` : "-";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: "0.75rem",
        color: "var(--text)",
        minWidth: 170,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 2,
          }}
        >
          <span style={{ color: "var(--text3)" }}>{p.name}:</span>
          <span className="mono" style={{ fontWeight: 600, color: p.color }}>
            {pct(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function VolatilityChart({ data }) {
  if (!data) return null;

  const { rolling_var, rolling_mean, var_summary } = data;

  /* Merge rolling_var and rolling_mean by date */
  const dateMap = {};
  (rolling_var || []).forEach((d) => {
    dateMap[d.date] = { ...dateMap[d.date], date: d.date, var_1pct: d.var_1pct, var_5pct: d.var_5pct };
  });
  (rolling_mean || []).forEach((d) => {
    dateMap[d.date] = { ...dateMap[d.date], date: d.date, rolling_mean: d.rolling_mean };
  });

  const chartData = Object.values(dateMap).sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  /* VaR summary cards */
  const summaryCards = [
    { label: "Daily VaR (1%)", value: pct(var_summary?.var_1pct), color: "var(--red)" },
    { label: "Daily VaR (5%)", value: pct(var_summary?.var_5pct), color: "#e06040" },
    {
      label: "Expected Shortfall",
      value: pct(var_summary?.expected_shortfall_1pct),
      color: "var(--red)",
    },
    {
      label: "Max Drawdown",
      value: pct(var_summary?.max_drawdown),
      color: "var(--red)",
    },
  ];

  return (
    <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
      <style>{`
        .vol-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 12px;
        }
        .var-summary-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 16px;
        }
        @media (max-width: 640px) {
          .var-summary-row {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .var-summary-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 14px;
          text-align: center;
        }
        .var-summary-label {
          font-size: 0.65rem;
          color: var(--text3);
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .var-summary-value {
          font-size: 1rem;
          font-weight: 700;
          font-family: "SF Mono", "Fira Code", monospace;
        }
      `}</style>

      <div className="vol-title">Rolling Value at Risk</div>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.3}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "var(--text3)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: "var(--text3)" }}
            tickLine={false}
            axisLine={false}
            width={42}
            tickFormatter={(v) => (v * 100).toFixed(1) + "%"}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="line"
            wrapperStyle={{ fontSize: 10, color: "var(--text3)" }}
          />
          <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
          <Line
            dataKey="var_1pct"
            name="VaR 1%"
            stroke="var(--red)"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
          <Line
            dataKey="var_5pct"
            name="VaR 5%"
            stroke="#e06040"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
          <Line
            dataKey="rolling_mean"
            name="Rolling Mean"
            stroke="var(--primary)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="var-summary-row">
        {summaryCards.map((card) => (
          <div className="var-summary-card" key={card.label}>
            <div className="var-summary-label">{card.label}</div>
            <div className="var-summary-value" style={{ color: card.color }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
