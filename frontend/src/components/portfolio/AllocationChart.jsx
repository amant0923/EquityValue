import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = [
  "#6366f1", "#8b5cf6", "#a78bfa", "#c084fc",
  "#f472b6", "#fb7185", "#f87171", "#fb923c",
  "#fbbf24", "#34d399", "#2dd4bf", "#38bdf8",
  "#60a5fa", "#818cf8",
];

export default function AllocationChart({ holdings }) {
  if (!holdings || holdings.length === 0) return null;

  const data = holdings
    .filter((h) => h.market_value > 0)
    .sort((a, b) => b.market_value - a.market_value)
    .map((h) => ({
      name: h.ticker,
      value: h.market_value,
      weight: h.weight,
    }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, fontSize: 13 }}>
        <p style={{ margin: 0, fontWeight: 600, color: "var(--text1)" }}>{d.name}</p>
        <p style={{ margin: "2px 0 0", color: "var(--text2)" }}>
          ${d.value.toLocaleString("en-US", { minimumFractionDigits: 2 })} ({d.weight.toFixed(1)}%)
        </p>
      </div>
    );
  };

  return (
    <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--text1)" }}>Allocation</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
        <ResponsiveContainer width={200} height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              dataKey="value"
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          {data.map((d, i) => (
            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
              <span style={{ color: "var(--text1)", fontWeight: 500 }}>{d.name}</span>
              <span style={{ color: "var(--text2)" }}>{d.weight.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
