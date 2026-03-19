import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import PortfolioCard from "../components/portfolio/PortfolioCard";
import CreatePortfolioModal from "../components/portfolio/CreatePortfolioModal";

export default function PortfolioListPage() {
  const navigate = useNavigate();
  const [portfolios, setPortfolios] = useState([]);
  const [limits, setLimits] = useState({ max_portfolios: 1, max_holdings: 5 });
  const [liveDataMap, setLiveDataMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchPortfolios = async () => {
    try {
      const { data } = await api.get("/portfolio");
      setPortfolios(data.portfolios);
      setLimits(data.limits);

      const liveMap = {};
      await Promise.allSettled(
        data.portfolios.map(async (p) => {
          try {
            const { data: live } = await api.get(`/portfolio/${p.id}/live`);
            liveMap[p.id] = live;
          } catch {}
        })
      );
      setLiveDataMap(liveMap);
    } catch (err) {
      console.error("Failed to load portfolios:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPortfolios(); }, []);

  const handleCreate = async (name) => {
    await api.post("/portfolio", { name });
    await fetchPortfolios();
  };

  const atLimit = portfolios.length >= limits.max_portfolios;

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div className="glass-card" style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>
          Loading portfolios...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: "var(--text1)" }}>Portfolios</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-accent" onClick={() => navigate("/portfolio/build")}>
            Build a Portfolio
          </button>
          <button
            className="btn-primary"
            onClick={() => setShowCreate(true)}
            disabled={atLimit}
            title={atLimit ? "Upgrade to create more portfolios" : ""}
          >
            + Create Portfolio
          </button>
        </div>
      </div>

      {atLimit && portfolios.length > 0 && (
        <div className="glass-card" style={{ padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "var(--text2)" }}>
          You've reached your portfolio limit ({limits.max_portfolios}). Upgrade your plan for more.
        </div>
      )}

      {portfolios.length === 0 ? (
        <div className="glass-card" style={{ padding: 60, textAlign: "center" }}>
          <p style={{ fontSize: 18, color: "var(--text1)", margin: "0 0 8px" }}>No portfolios yet</p>
          <p style={{ fontSize: 14, color: "var(--text2)", margin: "0 0 20px" }}>
            Create your first portfolio to start tracking your investments.
          </p>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            Create Portfolio
          </button>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
        }}>
          {portfolios.map((p) => (
            <PortfolioCard key={p.id} portfolio={p} liveData={liveDataMap[p.id]} />
          ))}
        </div>
      )}

      <CreatePortfolioModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
