import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import PortfolioHeader from "../components/portfolio/PortfolioHeader";
import HoldingsTable from "../components/portfolio/HoldingsTable";
import AddHoldingModal from "../components/portfolio/AddHoldingModal";
import PnLChart from "../components/portfolio/PnLChart";
import AllocationChart from "../components/portfolio/AllocationChart";

export default function PortfolioDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchData = async () => {
    try {
      setError("");
      const [portfolioRes, liveRes] = await Promise.all([
        api.get("/portfolio"),
        api.get(`/portfolio/${id}/live`),
      ]);
      const p = portfolioRes.data.portfolios.find((p) => p.id === id);
      if (!p) { navigate("/portfolio"); return; }
      setPortfolio(p);
      setLiveData(liveRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleAddHolding = async (data) => {
    if (data.id) {
      await api.put(`/portfolio/${id}/holdings/${data.id}`, {
        shares: data.shares,
        avg_price: data.avg_price,
      });
    } else {
      await api.post(`/portfolio/${id}/holdings`, data);
    }
    await fetchData();
  };

  const handleDeleteHolding = async (holding) => {
    if (!confirm(`Remove ${holding.ticker} from this portfolio?`)) return;
    await api.delete(`/portfolio/${id}/holdings/${holding.id}`);
    await fetchData();
  };

  const handleDeletePortfolio = async () => {
    if (!confirm("Delete this entire portfolio? This cannot be undone.")) return;
    await api.delete(`/portfolio/${id}`);
    navigate("/portfolio");
  };

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div className="glass-card" style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>
          Loading portfolio...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "var(--red)", margin: "0 0 12px" }}>{error}</p>
          <button className="btn-primary" onClick={fetchData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
      <button
        onClick={() => navigate("/portfolio")}
        style={{
          background: "none",
          border: "none",
          color: "var(--text2)",
          cursor: "pointer",
          fontSize: 14,
          marginBottom: 16,
          padding: 0,
        }}
      >
        &larr; Back to Portfolios
      </button>

      <PortfolioHeader
        name={portfolio?.name}
        liveData={liveData}
        onDelete={handleDeletePortfolio}
      />

      <PnLChart portfolioId={id} liveData={liveData} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, marginBottom: 20 }}>
        <AllocationChart holdings={liveData?.holdings || []} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowAdd(true); }}>
          + Add Holding
        </button>
      </div>

      <HoldingsTable
        holdings={liveData?.holdings || []}
        onEdit={(h) => { setEditing(h); setShowAdd(true); }}
        onDelete={handleDeleteHolding}
      />

      <AddHoldingModal
        open={showAdd}
        onClose={() => { setShowAdd(false); setEditing(null); }}
        onAdd={handleAddHolding}
        editing={editing}
      />
    </div>
  );
}
