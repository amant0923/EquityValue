export default function PortfolioHeader({ name, liveData, onDelete }) {
  const totalValue = liveData?.total_value ?? 0;
  const totalCost = liveData?.total_cost ?? 0;
  const totalPnl = liveData?.total_pnl ?? 0;
  const totalPnlPct = liveData?.total_pnl_pct ?? 0;
  const isPositive = totalPnl >= 0;

  const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, color: "var(--text1)" }}>{name}</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text2)" }}>
            Cost basis: ${fmt(totalCost)}
          </p>
        </div>
        <button onClick={onDelete} className="btn-danger">
          Delete Portfolio
        </button>
      </div>

      <div style={{ display: "flex", gap: 32, marginTop: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text2)" }}>Total Value</p>
          <p style={{ margin: "2px 0 0", fontSize: 28, fontWeight: 600, color: "var(--text1)" }}>
            ${fmt(totalValue)}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text2)" }}>Total P&L</p>
          <p style={{
            margin: "2px 0 0",
            fontSize: 28,
            fontWeight: 600,
            color: isPositive ? "var(--green)" : "var(--red)",
          }}>
            {isPositive ? "+" : ""}${fmt(totalPnl)}
            <span style={{ fontSize: 16, marginLeft: 8 }}>
              ({isPositive ? "+" : ""}{totalPnlPct.toFixed(2)}%)
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
