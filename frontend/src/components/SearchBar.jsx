import { useState, useEffect, useRef } from "react";
import axios from "axios";
const API = "http://localhost:8000";

export default function SearchBar({ ticker, setTicker, onSearch, loading }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug]         = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (ticker.length < 1) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      axios.get(`${API}/search/${ticker}`)
        .then(r => { setSuggestions(r.data.results); setShowSug(true); })
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [ticker]);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setShowSug(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // FIX: backend returns s.ticker not s.symbol
  const select = sym => { setTicker(sym); setShowSug(false); onSearch(sym); };

  return (
    <div className="search-container" ref={ref}>
      <div className="search-bar">
        <input
          className="search-input"
          type="text"
          placeholder="Enter ticker symbol  —  AAPL, MSFT, NVDA..."
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === "Enter") { setShowSug(false); onSearch(); } }}
          onFocus={() => suggestions.length > 0 && setShowSug(true)}
          maxLength={10}
        />
        <button className="search-btn" onClick={() => { setShowSug(false); onSearch(); }} disabled={loading}>
          {loading ? "Loading..." : "Analyse"}
        </button>
      </div>
      {showSug && suggestions.length > 0 && (
        <div className="autocomplete">
          {suggestions.map((s, i) => (
            <div key={i} className="autocomplete-item" onMouseDown={() => select(s.ticker)}>
              {/* FIX: use s.ticker not s.symbol */}
              <div>
                <span className="autocomplete-symbol">{s.ticker}</span>
                <span className="autocomplete-name"> — {s.name}</span>
              </div>
              <span className="autocomplete-type">{s.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
