const SIGNAL_CONFIG = {
  "Strong Buy": { color: "#00c853", bg: "rgba(0,200,83,0.15)" },
  Buy: { color: "#4caf50", bg: "rgba(76,175,80,0.15)" },
  Neutral: { color: "#9e9e9e", bg: "rgba(158,158,158,0.12)" },
  Sell: { color: "#f44336", bg: "rgba(244,67,54,0.15)" },
  "Strong Sell": { color: "#b71c1c", bg: "rgba(183,28,28,0.15)" },
};

export default function SignalGauge({ signals }) {
  if (!signals) return null;

  const { buy_count = 0, sell_count = 0, neutral_count = 0, overall = "Neutral" } = signals;
  const total = buy_count + sell_count + neutral_count || 1;
  const buyPct = ((buy_count / total) * 100).toFixed(0);
  const neutralPct = ((neutral_count / total) * 100).toFixed(0);
  const sellPct = ((sell_count / total) * 100).toFixed(0);

  const cfg = SIGNAL_CONFIG[overall] || SIGNAL_CONFIG.Neutral;

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3
        style={{
          fontSize: "0.85rem",
          fontWeight: 700,
          color: "var(--text)",
          margin: "0 0 14px",
        }}
      >
        Signal Summary
      </h3>

      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <span
          style={{
            display: "inline-block",
            padding: "8px 20px",
            borderRadius: 8,
            fontSize: "1rem",
            fontWeight: 700,
            color: cfg.color,
            background: cfg.bg,
            letterSpacing: 0.3,
          }}
        >
          {overall}
        </span>
      </div>

      {/* Proportional bar */}
      <div
        style={{
          display: "flex",
          borderRadius: 6,
          overflow: "hidden",
          height: 10,
          marginBottom: 14,
          background: "var(--border)",
        }}
      >
        {buy_count > 0 && (
          <div
            style={{
              width: `${buyPct}%`,
              background: "var(--green2)",
              transition: "width 0.4s ease",
            }}
          />
        )}
        {neutral_count > 0 && (
          <div
            style={{
              width: `${neutralPct}%`,
              background: "#9e9e9e",
              transition: "width 0.4s ease",
            }}
          />
        )}
        {sell_count > 0 && (
          <div
            style={{
              width: `${sellPct}%`,
              background: "var(--red2, #f44336)",
              transition: "width 0.4s ease",
            }}
          />
        )}
      </div>

      {/* Count labels */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--green2)",
              display: "inline-block",
            }}
          />
          <span style={{ color: "var(--text3)" }}>Buy</span>
          <span style={{ fontWeight: 700, color: "var(--text)" }}>{buy_count}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#9e9e9e",
              display: "inline-block",
            }}
          />
          <span style={{ color: "var(--text3)" }}>Neutral</span>
          <span style={{ fontWeight: 700, color: "var(--text)" }}>{neutral_count}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--red2, #f44336)",
              display: "inline-block",
            }}
          />
          <span style={{ color: "var(--text3)" }}>Sell</span>
          <span style={{ fontWeight: 700, color: "var(--text)" }}>{sell_count}</span>
        </div>
      </div>
    </div>
  );
}
