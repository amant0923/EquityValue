import { useState } from "react";

export default function HoldingsTable({ holdings, onEdit, onDelete }) {
  const [sortKey, setSortKey] = useState("ticker");
  const [sortDir, setSortDir] = useState(1);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(-sortDir);
    else { setSortKey(key); setSortDir(1); }
  };

  const sorted = [...holdings].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === "string") return av.localeCompare(bv) * sortDir;
    return ((av || 0) - (bv || 0)) * sortDir;
  });

  const fmt = (n) => n?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "—";
  const arrow = (key) => sortKey === key ? (sortDir === 1 ? " \u25B2" : " \u25BC") : "";

  const columns = [
    { key: "ticker", label: "Ticker" },
    { key: "shares", label: "Shares" },
    { key: "avg_price", label: "Avg Price" },
    { key: "current_price", label: "Price" },
    { key: "market_value", label: "Value" },
    { key: "pnl", label: "P&L" },
    { key: "pnl_pct", label: "P&L %" },
    { key: "weight", label: "Weight" },
  ];

  const desktopTable = (
    <div className="holdings-table-wrap" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={() => handleSort(c.key)}
                style={{
                  padding: "10px 12px",
                  textAlign: c.key === "ticker" ? "left" : "right",
                  color: "var(--text2)",
                  fontWeight: 500,
                  cursor: "pointer",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                  userSelect: "none",
                }}
              >
                {c.label}{arrow(c.key)}
              </th>
            ))}
            <th style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", width: 80 }}></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => {
            const isPos = (h.pnl || 0) >= 0;
            const pnlColor = isPos ? "var(--green)" : "var(--red)";
            return (
              <tr key={h.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text1)" }}>
                  {h.ticker}
                  {h.name && <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text2)", marginLeft: 8 }}>{h.name}</span>}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text1)" }}>{h.shares}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text1)" }}>${fmt(h.avg_price)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text1)" }}>${fmt(h.current_price)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text1)" }}>${fmt(h.market_value)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: pnlColor, fontWeight: 500 }}>
                  {isPos ? "+" : ""}${fmt(h.pnl)}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: pnlColor, fontWeight: 500 }}>
                  {isPos ? "+" : ""}{h.pnl_pct?.toFixed(2)}%
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text1)" }}>
                  {h.weight?.toFixed(1)}%
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                  <button
                    onClick={() => onEdit(h)}
                    style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", marginRight: 8, fontSize: 13 }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(h)}
                    style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 13 }}
                  >
                    Del
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const mobileCards = (
    <div className="holdings-mobile" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {sorted.map((h) => {
        const isPos = (h.pnl || 0) >= 0;
        const pnlColor = isPos ? "var(--green)" : "var(--red)";
        return (
          <div key={h.id} className="glass-card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontWeight: 600, color: "var(--text1)" }}>{h.ticker}</span>
              <span style={{ color: pnlColor, fontWeight: 500 }}>
                {isPos ? "+" : ""}{h.pnl_pct?.toFixed(2)}%
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 13, color: "var(--text2)" }}>
              <span>{h.shares} shares @ ${fmt(h.avg_price)}</span>
              <span style={{ textAlign: "right" }}>Now ${fmt(h.current_price)}</span>
              <span>Value: ${fmt(h.market_value)}</span>
              <span style={{ textAlign: "right", color: pnlColor }}>P&L: {isPos ? "+" : ""}${fmt(h.pnl)}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => onEdit(h)} className="btn-secondary" style={{ flex: 1, padding: "6px 0", fontSize: 13 }}>Edit</button>
              <button onClick={() => onDelete(h)} className="btn-danger" style={{ flex: 1, padding: "6px 0", fontSize: 13 }}>Remove</button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .holdings-table-wrap { display: none !important; }
          .holdings-mobile { display: flex !important; }
        }
        @media (min-width: 769px) {
          .holdings-mobile { display: none !important; }
        }
      `}</style>
      <div className="glass-card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--text1)" }}>Holdings</h3>
        {holdings.length === 0 ? (
          <p style={{ color: "var(--text2)", fontSize: 14 }}>No holdings yet. Add your first stock.</p>
        ) : (
          <>
            {desktopTable}
            {mobileCards}
          </>
        )}
      </div>
    </>
  );
}
