import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function PortfolioCard({ portfolio, liveData }) {
  const navigate = useNavigate();
  const totalValue = liveData?.total_value ?? 0;
  const totalPnl = liveData?.total_pnl ?? 0;
  const totalPnlPct = liveData?.total_pnl_pct ?? 0;
  const isPositive = totalPnl >= 0;

  return (
    <motion.div
      className="glass-card"
      whileHover={{ scale: 1.02 }}
      onClick={() => navigate(`/portfolio/${portfolio.id}`)}
      style={{ padding: 24, cursor: "pointer" }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--text1)" }}>
        {portfolio.name}
      </h3>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text2)" }}>
        {portfolio.holding_count} holding{portfolio.holding_count !== 1 ? "s" : ""}
      </p>

      {totalValue > 0 ? (
        <>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--text1)" }}>
            ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p style={{
            margin: "4px 0 0",
            fontSize: 14,
            fontWeight: 500,
            color: isPositive ? "var(--green)" : "var(--red)",
          }}>
            {isPositive ? "+" : ""}${totalPnl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {" "}
            ({isPositive ? "+" : ""}{totalPnlPct.toFixed(2)}%)
          </p>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: "var(--text2)" }}>No holdings yet</p>
      )}
    </motion.div>
  );
}
