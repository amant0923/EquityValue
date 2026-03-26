const PERIODS = ["1W", "1M", "3M", "6M", "1Y", "YTD"];

const fmt = (v) => {
  if (v == null) return "---";
  const n = Number(v);
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
};

export default function PerformanceReturns({ performance }) {
  if (!performance) return null;

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
        Performance Returns
      </h3>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {PERIODS.map((p) => {
          const val = performance[p];
          if (val == null) return null;
          const positive = Number(val) >= 0;
          return (
            <div
              key={p}
              style={{
                flex: "1 1 0",
                minWidth: 60,
                padding: "10px 8px",
                borderRadius: 8,
                textAlign: "center",
                background: positive
                  ? "rgba(76, 175, 80, 0.1)"
                  : "rgba(244, 67, 54, 0.1)",
                border: `1px solid ${
                  positive
                    ? "rgba(76, 175, 80, 0.2)"
                    : "rgba(244, 67, 54, 0.2)"
                }`,
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  color: "var(--text3)",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {p}
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: positive ? "var(--green2)" : "var(--red2, #f44336)",
                }}
              >
                {fmt(val)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
