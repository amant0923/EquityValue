import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <span style={{ color: "var(--text3)" }}>Theoretical:</span>
        <span className="mono" style={{ fontWeight: 600 }}>
          {d?.x?.toFixed(3) ?? "-"}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <span style={{ color: "var(--text3)" }}>Sample:</span>
        <span className="mono" style={{ fontWeight: 600 }}>
          {d?.y?.toFixed(3) ?? "-"}
        </span>
      </div>
    </div>
  );
};

export default function QQPlot({ data }) {
  if (!data) return null;

  const { theoretical_quantiles, sample_quantiles, reference_line } = data;

  /* Build scatter points */
  const scatterData = (theoretical_quantiles || []).map((tq, i) => ({
    x: tq,
    y: sample_quantiles?.[i] ?? 0,
  }));

  /* Build reference line from slope + intercept */
  const slope = reference_line?.slope ?? 1;
  const intercept = reference_line?.intercept ?? 0;

  const tq = theoretical_quantiles || [];
  if (tq.length === 0) return null;
  const minX = Math.min(...tq);
  const maxX = Math.max(...tq);
  const padding = (maxX - minX) * 0.05 || 0.1;

  const refLineData = [
    { x: minX - padding, y: slope * (minX - padding) + intercept },
    { x: maxX + padding, y: slope * (maxX + padding) + intercept },
  ];

  /* Merge both datasets: scatter points get `y`, ref line points get `refY` */
  const mergedData = [
    ...scatterData.map((d) => ({ ...d, refY: undefined })),
    ...refLineData.map((d) => ({ x: d.x, y: undefined, refY: d.y })),
  ].sort((a, b) => a.x - b.x);

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <style>{`
        .qq-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 12px;
        }
      `}</style>

      <div className="qq-title">Q-Q Plot (Normal Distribution)</div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart
          margin={{ top: 8, right: 12, bottom: 4, left: -4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.4}
          />
          <XAxis
            dataKey="x"
            type="number"
            domain={["auto", "auto"]}
            tick={{ fontSize: 10, fill: "var(--text3)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            label={{
              value: "Theoretical Quantiles",
              position: "insideBottom",
              offset: -2,
              fontSize: 10,
              fill: "var(--text3)",
            }}
          />
          <YAxis
            dataKey="y"
            type="number"
            domain={["auto", "auto"]}
            tick={{ fontSize: 10, fill: "var(--text3)" }}
            tickLine={false}
            axisLine={false}
            width={48}
            label={{
              value: "Sample Quantiles",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              fontSize: 10,
              fill: "var(--text3)",
            }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Reference line (dashed red) */}
          <Line
            data={refLineData}
            dataKey="y"
            stroke="var(--red)"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />

          {/* Scatter points */}
          <Scatter
            data={scatterData}
            dataKey="y"
            fill="var(--primary)"
            r={2}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
