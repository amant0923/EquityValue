import { useState, useRef, useEffect } from "react";
import "./StockPicker.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function StockPicker({ selected = [], onSelect, maxStocks = 50 }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/search/${encodeURIComponent(query)}`);
        const data = await res.json();
        const items = (data.results || []).filter(
          (r) => !selected.includes(r.symbol)
        );
        setResults(items);
        setOpen(items.length > 0);
        setActiveIdx(-1);
      } catch {
        setResults([]);
        setOpen(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, selected]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addTicker = (symbol) => {
    if (selected.length >= maxStocks) return;
    if (!selected.includes(symbol)) {
      onSelect([...selected, symbol]);
    }
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const removeTicker = (symbol) => {
    onSelect(selected.filter((t) => t !== symbol));
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && results[activeIdx]) {
        addTicker(results[activeIdx].symbol);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="stock-picker" ref={wrapRef}>
      <div className="stock-picker__input-wrap">
        <input
          className="stock-picker__input"
          type="text"
          placeholder="Search tickers to add..."
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
          spellCheck={false}
          disabled={selected.length >= maxStocks}
          aria-label="Search tickers"
        />
        {open && results.length > 0 && (
          <div className="stock-picker__dropdown">
            {results.map((r, i) => (
              <div
                key={r.symbol}
                className={`stock-picker__item${activeIdx === i ? " active" : ""}`}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={() => addTicker(r.symbol)}
              >
                <span className="stock-picker__item-symbol">{r.symbol}</span>
                <span className="stock-picker__item-name">{r.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="stock-picker__chips">
          {selected.map((ticker) => (
            <span key={ticker} className="stock-picker__chip">
              {ticker}
              <button
                className="stock-picker__chip-remove"
                onClick={() => removeTicker(ticker)}
                aria-label={`Remove ${ticker}`}
                type="button"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="stock-picker__counter">
        {selected.length} / {maxStocks} stocks selected
      </div>
    </div>
  );
}
