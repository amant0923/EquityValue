import { useState, useRef, useEffect } from "react";
import { getAuthToken } from "../lib/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function buildPrompt(data) {
  const km = data.key_metrics || {};
  const an = data.analyst     || {};
  const co = data.consensus   || {};

  const fmt = (v, type) => {
    if (v == null) return "N/A";
    if (type === "pct")   return `${(v*100).toFixed(1)}%`;
    if (type === "price") return `$${Number(v).toFixed(2)}`;
    if (type === "x")     return `${Number(v).toFixed(1)}x`;
    if (type === "large") {
      const a = Math.abs(v);
      if (a >= 1e12) return `$${(v/1e12).toFixed(2)}T`;
      if (a >= 1e9)  return `$${(v/1e9).toFixed(2)}B`;
      if (a >= 1e6)  return `$${(v/1e6).toFixed(2)}M`;
      return `$${v}`;
    }
    return String(v);
  };

  return `You are a senior equity research analyst at a bulge-bracket investment bank. Write a rigorous, institutional-quality investment memo for ${data.company_name} (${data.ticker}).

COMPANY DATA:
- Sector: ${data.sector} | Industry: ${data.industry}
- Company Type: ${data.company_type}
- Current Price: ${fmt(data.current_price, "price")}
- Market Cap: ${fmt(data.market_cap, "large")}
- Description: ${data.description?.slice(0, 400) || "N/A"}

VALUATION SUMMARY:
- Consensus Intrinsic Value: ${co.average_intrinsic_value ? fmt(co.average_intrinsic_value, "price") : "N/A"}
- Consensus Verdict: ${co.overall_verdict || "N/A"}
- Upside/Downside: ${co.upside_pct != null ? `${co.upside_pct > 0 ? "+" : ""}${co.upside_pct}%` : "N/A"}
- Models Used: ${co.models_used || "N/A"}

KEY FINANCIALS:
- Revenue: ${fmt(km.revenue, "large")} | Revenue Growth: ${fmt(km.revenue_growth, "pct")}
- EBITDA: ${fmt(km.ebitda, "large")} | EBITDA Margin: ${km.ebitda && km.revenue ? fmt(km.ebitda/km.revenue, "pct") : "N/A"}
- Net Income: ${fmt(km.net_income, "large")} | Net Margin: ${fmt(km.profit_margin, "pct")}
- Free Cash Flow: ${fmt(km.free_cashflow, "large")}
- EPS: ${fmt(km.eps, "price")} | Forward EPS: ${fmt(km.forward_eps, "price")}
- ROE: ${fmt(km.roe, "pct")} | ROA: ${fmt(km.roa, "pct")}

VALUATION MULTIPLES:
- P/E: ${fmt(km.pe_ratio, "x")} | Forward P/E: ${fmt(km.forward_pe, "x")}
- EV/EBITDA: ${fmt(km.ev_ebitda, "x")} | P/S: ${fmt(km.ps_ratio, "x")}
- PEG: ${fmt(km.peg_ratio, "x")} | P/B: ${fmt(km.pb_ratio, "x")}
- Beta: ${km.beta?.toFixed(2) || "N/A"}

BALANCE SHEET:
- Total Debt: ${fmt(km.total_debt, "large")} | Cash: ${fmt(km.total_cash, "large")}
- Debt/Equity: ${km.debt_to_equity?.toFixed(2) || "N/A"} | Current Ratio: ${km.current_ratio?.toFixed(2) || "N/A"}

EV MODEL CONSENSUS (Equity Valuation model-derived targets):
- Recommendation: ${an.recommendation || "N/A"} | Mean Model Target: ${fmt(an.target_mean, "price")}
- Model Target Range: ${fmt(an.target_low, "price")} – ${fmt(an.target_high, "price")}
Note: These targets are derived from EV's valuation models (DCF, EV/EBITDA, P/S, etc.), not from Wall Street analyst consensus.

Write the memo in the following exact structure. Be specific, quantitative, and analytical — not generic. Reference the actual numbers provided. Write as if this memo will be read by a Managing Director before a client call.

---

## Investment Thesis

Write 3–4 sentences summarising the core bull case. Reference specific metrics. State clearly whether this is a BUY, HOLD, or SELL and why.

## Bull Case

Write 3 distinct, numbered bull case arguments. Each should be 2–3 sentences, reference specific data points, and explain the upside catalyst.

## Bear Case

Write 3 distinct, numbered bear case arguments. Each should be 2–3 sentences, reference specific risks, and explain the downside scenario.

## Valuation Assessment

2–3 paragraphs analysing the valuation. Reference the consensus intrinsic value, key multiples vs sector, and what the market is pricing in. Be direct about whether the stock looks cheap or expensive and why.

## Key Risks

List 4–5 specific risks in bullet form. Be specific to this company and sector — not generic boilerplate.

## Conclusion

2–3 sentences. State your recommendation, 12-month price target rationale, and one key catalyst to watch.

---

Tone: Direct, analytical, institutional. No marketing language. No hedging clichés like "it remains to be seen". Write like a confident senior analyst, not a disclaimer machine.`;
}

// ── Markdown renderer (simple) ───────────────────────────────────────────────
function renderMemo(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="it-section-heading">
          {line.replace("## ", "")}
        </h3>
      );
    } else if (line.match(/^\d+\./)) {
      // Numbered list — collect all items, joining wrapped lines, skipping blanks between items
      const rawItems = [];
      let current = line.replace(/^\d+\.\s*/, "");
      i++;
      while (i < lines.length) {
        const next = lines[i];
        if (next.match(/^\d+\./)) {
          // Start of next numbered item
          if (current.trim()) rawItems.push(current.trim());
          current = next.replace(/^\d+\.\s*/, "");
          i++;
        } else if (next.trim() === "") {
          // Blank line — peek ahead to see if another numbered item follows
          let peek = i + 1;
          while (peek < lines.length && lines[peek].trim() === "") peek++;
          if (peek < lines.length && lines[peek].match(/^\d+\./)) {
            // More numbered items ahead — save current and skip blanks
            if (current.trim()) rawItems.push(current.trim());
            current = "";
            i = peek;
          } else {
            // End of numbered list
            break;
          }
        } else if (!next.startsWith("## ") && !next.startsWith("- ") && !next.startsWith("---")) {
          // Continuation line — append to current item
          current += " " + next.trim();
          i++;
        } else {
          break;
        }
      }
      if (current.trim()) rawItems.push(current.trim());

      const items = rawItems.map((text, idx) => {
        const parts = text.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={j}>{part.slice(2, -2)}</strong>;
          }
          return part;
        });
        return <li key={idx}>{parts}</li>;
      });
      elements.push(<ol key={`ol-${i}`} className="it-ol">{items}</ol>);
      continue;
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      const items = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("• "))) {
        items.push(<li key={i}>{lines[i].replace(/^[-•]\s*/, "")}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`} className="it-ul">{items}</ul>);
      continue;
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} className="it-hr" />);
    } else if (line.trim() === "") {
      // skip blank lines between sections
    } else {
      // Paragraph — handle **bold**
      const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={j}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
      elements.push(<p key={i} className="it-p">{parts}</p>);
    }
    i++;
  }
  return elements;
}

// ── Badge ────────────────────────────────────────────────────────────────────
function RecBadge({ text }) {
  if (!text) return null;
  const upper = text.toUpperCase();
  const color =
    upper.includes("BUY")  ? "var(--green2)" :
    upper.includes("SELL") ? "var(--red2)"   : "var(--yellow2)";
  return (
    <span className="it-rec-badge" style={{ color, borderColor: color+"44", background: color+"11" }}>
      {upper}
    </span>
  );
}

export default function InvestmentThesis({ data, onMemoGenerated }) {
  const [memo,    setMemo]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [rec,     setRec]     = useState(null);
  const abortRef = useRef(null);

  // Extract recommendation from Conclusion/Recommendation section only
  useEffect(() => {
    if (!memo) return;
    // Look for the recommendation in the Conclusion or Recommendation section
    const sectionMatch = memo.match(/(?:##\s*(?:Conclusion|Recommendation)[\s\S]*?)(STRONG BUY|BUY|HOLD|UNDERPERFORM|SELL)/i);
    if (sectionMatch) {
      setRec(sectionMatch[1].toUpperCase());
      return;
    }
    // Fallback: find last occurrence (more likely to be the final verdict)
    const allMatches = [...memo.matchAll(/(STRONG BUY|BUY|HOLD|UNDERPERFORM|SELL)/gi)];
    if (allMatches.length > 0) setRec(allMatches[allMatches.length - 1][1].toUpperCase());
  }, [memo]);

  const generate = async () => {
    setLoading(true);
    setMemo("");
    setError("");
    setRec(null);
    abortRef.current = new AbortController();

    try {
      const headers = { "Content-Type": "application/json" };
      const token = getAuthToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch(`${API_URL}/ai/thesis`, {
        method: "POST",
        signal: abortRef.current.signal,
        headers,
        body: JSON.stringify({
          messages: [{ role: "user", content: buildPrompt(data) }],
        }),
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error("Please sign in to generate a memo.");
        if (response.status === 503) throw new Error("AI service is not configured. Please try again later.");
        if (response.status === 429) throw new Error("Rate limit reached. Please wait a moment and try again.");
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.detail || `API error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              setMemo(prev => { const next = prev + evt.delta.text; if (onMemoGenerated) onMemoGenerated(next); return next; });
            } else if (evt.type === "error") {
              setError(evt.error || "AI generation failed. Please try again.");
              setLoading(false);
              return;
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError("Failed to generate thesis. Check your API connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  return (
    <div className="it-wrap">
      <div className="it-header">
        <div>
          <span className="it-title">AI Investment Memo</span>
          <span className="it-sub">
            Institutional-grade equity research memo — bull case, bear case, valuation &amp; recommendation
          </span>
        </div>
        <div className="it-header-right">
          {rec && <RecBadge text={rec} />}
          {!loading ? (
            <button className="it-btn" onClick={generate} disabled={loading}>
              {memo ? "Regenerate Memo" : "Generate Memo"}
            </button>
          ) : (
            <button className="it-btn it-btn--stop" onClick={stop}>
              Stop
            </button>
          )}
        </div>
      </div>

      {!memo && !loading && !error && (
        <div className="it-empty">
          <div className="it-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <p>Click <strong>Generate Memo</strong> to produce a full IB-style investment memo with bull case, bear case, valuation assessment and recommendation.</p>
          <p className="it-empty-sub">Powered by Claude — typically takes 10–15 seconds</p>
        </div>
      )}

      {error && (
        <div className="it-error">{error}</div>
      )}

      {(memo || loading) && (
        <div className="it-memo">
          {/* Company header strip */}
          <div className="it-memo-header">
            <div className="it-memo-co">
              <span className="it-memo-name">{data.company_name}</span>
              <span className="it-memo-ticker">{data.ticker}</span>
              <span className="it-memo-sector">{data.sector}</span>
            </div>
            <div className="it-memo-meta">
              <span>Current: <strong>${data.current_price?.toFixed(2)}</strong></span>
              {data.consensus?.average_intrinsic_value && (
                <span>Intrinsic: <strong>${data.consensus.average_intrinsic_value}</strong></span>
              )}
              <span className="it-memo-date">{new Date().toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })}</span>
            </div>
          </div>

          <div className="it-memo-divider" />

          {/* Content */}
          <div className="it-memo-body">
            {renderMemo(memo)}
            {loading && <span className="it-cursor">▊</span>}
          </div>
        </div>
      )}

      <style>{`
        .it-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .it-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .it-title { display: block; font-size: 0.72rem; font-weight: 700; color: var(--text2); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
        .it-sub { font-size: 0.7rem; color: var(--text3); }
        .it-header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .it-rec-badge { font-size: 0.78rem; font-weight: 800; padding: 5px 14px; border-radius: var(--radius); border: 1px solid; letter-spacing: 1px; }
        .it-btn { background: var(--primary); color: white; border: none; padding: 9px 20px; border-radius: var(--radius); font-size: 0.78rem; font-weight: 700; cursor: pointer; font-family: inherit; letter-spacing: 0.3px; transition: background 0.15s; white-space: nowrap; }
        .it-btn:hover { background: var(--primary2); }
        .it-btn--stop { background: var(--red); }
        .it-btn--stop:hover { background: var(--red2); }
        .it-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 48px 32px; text-align: center; border: 1px dashed var(--border2); border-radius: var(--radius); color: var(--text2); font-size: 0.82rem; line-height: 1.6; }
        .it-empty-icon { width: 40px; height: 40px; color: var(--text3); opacity: 0.5; }
        .it-empty-sub { font-size: 0.72rem; color: var(--text3); }
        .it-error { background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.25); color: var(--red2); padding: 14px 18px; border-radius: var(--radius); font-size: 0.78rem; }
        .it-memo { background: var(--surface2); border: 1px solid var(--border2); border-radius: var(--radius-lg); overflow: hidden; }
        .it-memo-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding: 16px 24px; background: var(--surface3); }
        .it-memo-co { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .it-memo-name { font-size: 0.95rem; font-weight: 700; color: var(--text); letter-spacing: -0.3px; }
        .it-memo-ticker { font-size: 0.72rem; font-weight: 700; color: var(--primary2); background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.2); padding: 2px 8px; border-radius: 3px; letter-spacing: 0.5px; }
        .it-memo-sector { font-size: 0.7rem; color: var(--text3); background: var(--surface2); border: 1px solid var(--border); padding: 2px 8px; border-radius: 3px; }
        .it-memo-meta { display: flex; gap: 16px; font-size: 0.72rem; color: var(--text3); align-items: center; flex-wrap: wrap; }
        .it-memo-meta strong { color: var(--text); }
        .it-memo-date { color: var(--text3); font-size: 0.68rem; }
        .it-memo-divider { height: 1px; background: var(--border); }
        .it-memo-body { padding: 28px 32px; display: flex; flex-direction: column; gap: 0; }
        .it-section-heading { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--primary2); margin: 24px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
        .it-section-heading:first-child { margin-top: 0; }
        .it-p { font-size: 0.83rem; color: var(--text2); line-height: 1.75; margin-bottom: 10px; }
        .it-p strong { color: var(--text); }
        .it-ul { padding-left: 18px; display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
        .it-ol { padding-left: 18px; display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; }
        .it-ul li, .it-ol li { font-size: 0.83rem; color: var(--text2); line-height: 1.65; }
        .it-ul li::marker { color: var(--primary2); }
        .it-ol li::marker { color: var(--primary2); font-weight: 700; }
        .it-hr { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
        .it-cursor { display: inline-block; animation: blink 1s step-end infinite; color: var(--primary2); font-size: 1rem; margin-left: 2px; }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
