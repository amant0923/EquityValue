import { useState, useEffect, useRef } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function SearchBar({ ticker, setTicker, onSearch, loading }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]               = useState(false);
  const [active, setActive]           = useState(-1);
  const debounceRef                   = useRef(null);
  const wrapRef                       = useRef(null);

  // Fetch suggestions with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!ticker || ticker.length < 1) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`${API}/search/${encodeURIComponent(ticker)}`);
        const data = await res.json();
        setSuggestions(data.results || []);
        setOpen((data.results || []).length > 0);
        setActive(-1);
      } catch { setSuggestions([]); setOpen(false); }
    }, 220);
    return () => clearTimeout(debounceRef.current);
  }, [ticker]);

  // Close on outside click
  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (sym) => {
    setTicker(sym);
    setOpen(false);
    setSuggestions([]);
    onSearch(sym);
  };

  const handleKey = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, suggestions.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActive(a => Math.max(a - 1, -1)); }
    if (e.key === "Enter") {
      if (active >= 0 && suggestions[active]) { select(suggestions[active].symbol); }
      else { setOpen(false); onSearch(ticker); }
    }
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="sb-wrap" ref={wrapRef}>
      <div className="sb-input-row">
        <input
          className="sb-input"
          type="text"
          placeholder="Search ticker or company name…"
          value={ticker}
          onChange={e => { setTicker(e.target.value.toUpperCase()); }}
          onKeyDown={handleKey}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          className="sb-btn"
          onClick={() => { setOpen(false); onSearch(ticker); }}
          disabled={loading || !ticker}
        >
          {loading ? <span className="sb-spinner" /> : "Analyse"}
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <div className="sb-dropdown">
          {suggestions.map((s, i) => (
            <div
              key={s.symbol}
              className={`sb-item${active === i ? " sb-item--active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={() => select(s.symbol)}
            >
              <span className="sb-item-symbol">{s.symbol}</span>
              <span className="sb-item-name">{s.name}</span>
              <span className="sb-item-exch">{s.exchange}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .sb-wrap { position: relative; flex: 1; }
        .sb-input-row { display: flex; gap: 8px; }
        .sb-input {
          flex: 1; padding: 10px 16px; border-radius: var(--radius);
          border: 1px solid var(--border); background: var(--surface2);
          color: var(--text); font-size: 0.95rem; outline: none;
          transition: border-color 0.2s;
        }
        .sb-input:focus { border-color: var(--primary); }
        .sb-btn {
          padding: 10px 24px; border-radius: var(--radius);
          background: var(--primary); color: #fff; font-weight: 700;
          font-size: 0.9rem; border: none; cursor: pointer;
          transition: opacity 0.2s; white-space: nowrap;
        }
        .sb-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sb-spinner {
          display: inline-block; width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: sb-spin 0.7s linear infinite;
        }
        @keyframes sb-spin { to { transform: rotate(360deg); } }
        .sb-dropdown {
          position: absolute; top: calc(100% + 6px); left: 0; right: 0;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          z-index: 100; overflow: hidden;
        }
        .sb-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; cursor: pointer;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
        }
        .sb-item:last-child { border-bottom: none; }
        .sb-item--active, .sb-item:hover { background: var(--surface2); }
        .sb-item-symbol {
          font-size: 0.82rem; font-weight: 700; color: var(--primary2);
          min-width: 60px;
        }
        .sb-item-name {
          flex: 1; font-size: 0.8rem; color: var(--text2);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sb-item-exch {
          font-size: 0.68rem; color: var(--text3);
          background: var(--surface3); padding: 2px 7px;
          border-radius: 4px; white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
