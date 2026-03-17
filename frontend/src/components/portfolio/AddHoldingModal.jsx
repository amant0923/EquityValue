import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AddHoldingModal({ open, onClose, onAdd, editing }) {
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchTimeout, setSearchTimeout] = useState(null);

  const isEdit = !!editing;

  useEffect(() => {
    if (editing) {
      setTicker(editing.ticker || "");
      setShares(editing.shares?.toString() || "");
      setAvgPrice(editing.avg_price?.toString() || "");
    } else {
      setTicker("");
      setShares("");
      setAvgPrice("");
    }
    setError("");
    setSearchResults([]);
  }, [editing, open]);

  const handleTickerChange = (val) => {
    setTicker(val.toUpperCase());
    if (searchTimeout) clearTimeout(searchTimeout);
    if (val.length >= 1 && !isEdit) {
      const timeout = setTimeout(async () => {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/search/${val}`
          );
          if (res.ok) {
            const data = await res.json();
            setSearchResults((data.results || []).slice(0, 6));
          }
        } catch {}
      }, 300);
      setSearchTimeout(timeout);
    } else {
      setSearchResults([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ticker.trim() || !shares || !avgPrice) return;
    setLoading(true);
    setError("");
    try {
      await onAdd({
        ticker: ticker.trim(),
        shares: parseFloat(shares),
        avg_price: parseFloat(avgPrice),
        ...(isEdit ? { id: editing.id } : {}),
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save holding");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface1)",
    color: "var(--text1)",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="glass-card"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          style={{ padding: 32, maxWidth: 420, width: "90%", margin: "15vh auto" }}
        >
          <h3 style={{ margin: "0 0 20px", fontSize: 18, color: "var(--text1)" }}>
            {isEdit ? `Edit ${editing.ticker}` : "Add Holding"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14, position: "relative" }}>
              <label style={{ fontSize: 13, color: "var(--text2)", display: "block", marginBottom: 4 }}>Ticker</label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => handleTickerChange(e.target.value)}
                placeholder="e.g. AAPL"
                disabled={isEdit}
                autoFocus={!isEdit}
                style={{ ...inputStyle, opacity: isEdit ? 0.6 : 1 }}
              />
              {searchResults.length > 0 && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  zIndex: 10,
                  maxHeight: 200,
                  overflow: "auto",
                }}>
                  {searchResults.map((r) => (
                    <div
                      key={r.ticker || r.symbol}
                      onClick={() => { setTicker(r.ticker || r.symbol); setSearchResults([]); }}
                      style={{
                        padding: "8px 14px",
                        cursor: "pointer",
                        fontSize: 13,
                        color: "var(--text1)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <strong>{r.ticker || r.symbol}</strong>
                      <span style={{ color: "var(--text2)", marginLeft: 8 }}>{r.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: "var(--text2)", display: "block", marginBottom: 4 }}>Shares</label>
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="e.g. 50"
                min="0.01"
                step="any"
                autoFocus={isEdit}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: "var(--text2)", display: "block", marginBottom: 4 }}>Average Purchase Price ($)</label>
              <input
                type="number"
                value={avgPrice}
                onChange={(e) => setAvgPrice(e.target.value)}
                placeholder="e.g. 180.50"
                min="0.01"
                step="any"
                style={inputStyle}
              />
            </div>

            {error && (
              <p style={{ color: "var(--red)", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={loading || !ticker.trim() || !shares || !avgPrice} className="btn-primary">
                {loading ? "Saving..." : isEdit ? "Save Changes" : "Add Holding"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
