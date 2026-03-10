import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import api from "../../lib/api";

const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "1Y", days: 365 },
  { label: "All", days: "all" },
];

export default function PnLChart({ portfolioId, liveData }) {
  const [range, setRange] = useState(RANGES[1]);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSnapshots = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/portfolio/${portfolioId}/snapshots?days=${range.days}`);
        setSnapshots(data);
      } catch {}
      setLoading(false);
    };
    fetchSnapshots();
  }, [portfolioId, range.days]);

  const chartData = [
    ...snapshots.map((s) => ({
      date: s.snapshot_date,
      value: s.total_value,
      cost: s.total_cost,
      pnl: s.total_value - s.total_cost,
    })),
    ...(liveData && liveData.total_value > 0
      ? [{
          date: "Today",
          value: liveData.total_value,
          cost: liveData.total_cost,
          pnl: liveData.total_pnl,
        }]
      : []),
  ];

  const latestPnl = chartData.length > 0 ? chartData[chartData.length - 1]?.pnl : 0;
  const isPositive = latestPnl >= 0;

  const formatDate = (d) => {
    if (d === "Today") return d;
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const fmt = (n) => n?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const pos = d.pnl >= 0;
    return (
      <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, fontSize: 13 }}>
        <p style={{ margin: 0, color: "var(--text2)" }}>{d.date}</p>
        <p style={{ margin: "4px 0 0", color: "var(--text1)" }}>Value: ${fmt(d.value)}</p>
        <p style={{ margin: "2px 0 0", color: pos ? "var(--green)" : "var(--red)" }}>
          P&L: {pos ? "+" : ""}${fmt(d.pnl)}
        </p>
      </div>
    );
  };

  return (
    <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: "var(--text1)" }}>Portfolio Performance</h3>
        <div style={{ display: "flex", gap: 4 }}>
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r)}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                background: range.label === r.label ? "var(--accent, var(--primary))" : "var(--surface2)",
                color: range.label === r.label ? "#fff" : "var(--text2)",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && chartData.length === 0 ? (
        <div style={{ height: 250, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text2)", fontSize: 14 }}>
          Loading chart data...
        </div>
      ) : chartData.length === 0 ? (
        <div style={{ height: 250, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text2)", fontSize: 14 }}>
          No snapshot data yet. Performance history will appear after the first trading day.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: "var(--text2)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text2)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            {chartData.some((d) => d.cost) && (
              <ReferenceLine y={chartData[0]?.cost} stroke="var(--text2)" strokeDasharray="4 4" strokeOpacity={0.5} />
            )}
            <Area type="monotone" dataKey="value" stroke={isPositive ? "#22c55e" : "#ef4444"} fill="url(#pnlGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
