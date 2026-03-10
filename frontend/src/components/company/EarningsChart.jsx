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

const CustomTooltip = ({ active, payload, label }) => {
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
        minWidth: 160,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <span style={{ color: "var(--text3)" }}>Actual:</span>
        <span className="mono" style={{ fontWeight: 600 }}>
          ${d?.eps_actual?.toFixed(2) ?? "-"}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <span style={{ color: "var(--text3)" }}>Estimate:</span>
        <span className="mono">${d?.eps_estimate?.toFixed(2) ?? "-"}</span>
      </div>
      {d?.eps_surprise != null && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            marginTop: 4,
            paddingTop: 4,
            borderTop: "1px solid var(--border)",
          }}
        >
          <span style={{ color: "var(--text3)" }}>Surprise:</span>
          <span
            className="mono"
            style={{
              fontWeight: 600,
              color: d.eps_surprise >= 0 ? "var(--green2)" : "var(--red2)",
            }}
          >
            {d.eps_surprise >= 0 ? "+" : ""}
            {d.eps_surprise_pct?.toFixed(1) ?? d.eps_surprise?.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
};

export default function EarningsChart({ earnings }) {
  if (!earnings || earnings.length === 0) return null;

  const data = [...earnings]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-12)
    .map((e) => ({
      ...e,
      quarter: new Date(e.date).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      beat: e.eps_actual != null && e.eps_estimate != null
        ? e.eps_actual >= e.eps_estimate
        : null,
    }));

  const beats = data.filter((d) => d.beat === true).length;
  const total = data.filter((d) => d.beat !== null).length;

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h3 className="ci-section-title">Earnings History</h3>
        {total > 0 && (
          <span style={{ fontSize: "0.7rem", color: "var(--text3)" }}>
            Beat {beats}/{total} quarters
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
          <XAxis
            dataKey="quarter"
            tick={{ fill: "var(--text3)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text3)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Bar dataKey="eps_estimate" name="Estimate" fill="var(--surface2)" radius={[3, 3, 0, 0]} barSize={18} />
          <Bar dataKey="eps_actual" name="Actual" radius={[3, 3, 0, 0]} barSize={18}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.beat === true
                    ? "var(--green2)"
                    : d.beat === false
                    ? "var(--red2)"
                    : "var(--primary2)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          justifyContent: "center",
          marginTop: 8,
        }}
      >
        <span className="ec-legend">
          <span className="ec-legend-box" style={{ background: "var(--surface2)" }} />
          Estimate
        </span>
        <span className="ec-legend">
          <span className="ec-legend-box" style={{ background: "var(--green2)" }} />
          Beat
        </span>
        <span className="ec-legend">
          <span className="ec-legend-box" style={{ background: "var(--red2)" }} />
          Miss
        </span>
      </div>

      <style>{`
        .ci-section-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 12px;
        }
        .ec-legend {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.68rem;
          color: var(--text3);
        }
        .ec-legend-box {
          width: 10px;
          height: 10px;
          border-radius: 2px;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
