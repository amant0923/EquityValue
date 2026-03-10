import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

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
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div
          key={p.dataKey}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <span style={{ color: p.color }}>{p.name}:</span>
          <span className="mono">
            ${Math.abs(p.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

function formatValue(v) {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v}`;
}

export default function InsiderChart({ trades }) {
  if (!trades || trades.length === 0) return null;

  // Group trades by month
  const monthMap = {};
  trades.forEach((t) => {
    const date = t.transaction_date || t.filing_date;
    if (!date) return;
    const d = new Date(date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { buys: 0, sells: 0 };
    const val = Math.abs(t.total_value || t.shares_traded * (t.price || 0)) || 0;
    const type = (t.transaction_type || "").toLowerCase();
    if (type.includes("buy") || type.includes("purchase") || type.includes("acquisition")) {
      monthMap[key].buys += val;
    } else {
      monthMap[key].sells += val;
    }
  });

  const data = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, vals]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      Buys: vals.buys,
      Sells: -vals.sells,
    }));

  if (data.length === 0) return null;

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 className="ci-section-title" style={{ marginBottom: 16 }}>
        Insider Activity
      </h3>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
          <XAxis
            dataKey="month"
            tick={{ fill: "var(--text3)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text3)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatValue}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Bar dataKey="Buys" fill="var(--green2)" radius={[3, 3, 0, 0]} barSize={20} />
          <Bar dataKey="Sells" fill="var(--red2)" radius={[0, 0, 3, 3]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>

      <div
        style={{
          display: "flex",
          gap: 16,
          justifyContent: "center",
          marginTop: 8,
        }}
      >
        <span className="ic-legend">
          <span className="ic-legend-box" style={{ background: "var(--green2)" }} />
          Buys
        </span>
        <span className="ic-legend">
          <span className="ic-legend-box" style={{ background: "var(--red2)" }} />
          Sells
        </span>
      </div>

      <style>{`
        .ic-legend {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.68rem;
          color: var(--text3);
        }
        .ic-legend-box {
          width: 10px;
          height: 10px;
          border-radius: 2px;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
