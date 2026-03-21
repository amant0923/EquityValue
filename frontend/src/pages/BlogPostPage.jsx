import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DOMPurify from "dompurify";

const POSTS = {
  "11-valuation-models-ranked-by-accuracy": {
    title: "11 Valuation Models Ranked by Accuracy: 6-Month Results",
    date: "2026-03-18",
    category: "Research",
    readTime: "8 min",
    content: `## Summary

We tracked the directional accuracy of 11 institutional valuation models across all S&P 500 stocks over 6 months. The results challenge common assumptions about which models work best.

## Methodology

Every night, our pipeline computes intrinsic value estimates from 11 different models for each S&P 500 stock. We snapshot these predictions and compare them against actual price movements 6 months later. A prediction is "correct" if the model's predicted direction (above or below current price) matches reality.

## Key Findings

**Top 3 by Directional Accuracy:**
1. **EV/EBITDA Comparables** — 62.3% accuracy (n=487)
2. **DCF (Discounted Cash Flow)** — 59.8% accuracy (n=492)
3. **P/E Comparables** — 58.1% accuracy (n=489)

**Bottom 3:**
- Graham Number — 48.2% (biased toward deep value)
- Gordon Growth Model — 47.9% (sensitive to growth assumptions)
- Residual Income — 46.1% (requires clean accounting data)

## What This Means

Market-based models (comparables) consistently outperform income-based and asset-based models for 6-month directional predictions. This makes intuitive sense: comparables reflect what the market is actually willing to pay, while intrinsic models rely heavily on assumptions.

However, the consensus of all applicable models (our EVS approach) outperformed any individual model at **64.7% accuracy**. Diversification works in valuation just as it does in investing.

## Limitations

- 6 months is a short window; 12-month data will be more robust
- Directional accuracy doesn't measure magnitude
- Sample sizes vary by model applicability
- Market conditions during this period were relatively bullish

*Check our [accuracy dashboard](/accuracy) for live, continuously updated results.*`,
  },
  "why-sector-relative-evs-matters": {
    title: "Why Sector-Relative EVS Matters",
    date: "2026-03-15",
    category: "Methodology",
    readTime: "5 min",
    content: `## The Problem with Absolute Scores

An EVS score of 75 sounds great. But is it? That depends entirely on context. A Tech stock scoring 75 might be at the 40th percentile of its sector — merely average. A Utilities stock scoring 75 might be in the 95th percentile — exceptional for that sector.

## How Sector Percentiles Work

Every night after computing EVS scores, we rank each stock within its GICS sector. This produces a sector percentile (0-100) that answers: "How does this stock compare to its direct peers?"

This matters because:
- **Different sectors have different score distributions.** High-growth Tech stocks tend to cluster around 50-70. Stable Utilities cluster around 55-80.
- **Sector dynamics affect all companies.** A rising tide lifts all boats — if the entire Tech sector re-rates upward, individual absolute scores increase but relative positioning stays informative.
- **Investors compare within sectors.** If you're choosing between two Consumer Staples companies, sector percentile tells you which one is the better value within that universe.

## Best-in-Sector Badge

When a stock ranks #1 in its sector by EVS score, we award a "Best in Sector" badge on the screener. This isn't just the highest absolute score — it's the best risk-adjusted value within a comparable peer group.

## How to Use This

1. **Start with screener.** Sort by sector percentile to find the best values within each sector.
2. **Check the company page.** The peer comparison shows exactly where a stock sits vs. industry peers.
3. **Track trends.** A rising sector percentile means the stock is improving relative to peers, even if the absolute score hasn't changed much.

*Sector percentile is available to all users on the [screener](/screener).*`,
  },
  "problem-with-chatgpt-stock-valuation": {
    title: "The Problem with ChatGPT for Stock Valuation",
    date: "2026-03-12",
    category: "Opinion",
    readTime: "6 min",
    content: `## LLMs Are Not Spreadsheets

ChatGPT and similar LLMs are remarkable tools. They can explain financial concepts, summarize earnings calls, and help you think through investment theses. But when it comes to quantitative stock valuation, they have fundamental limitations.

## The Three Problems

### 1. No Consistent Methodology
Ask ChatGPT to value AAPL today, and again tomorrow. You'll likely get different numbers, different models referenced, and different conclusions — even if nothing about Apple changed. There's no reproducible methodology being applied.

### 2. No Real-Time Data
LLMs work with training data that's months or years old. They don't have access to live market prices, current financial statements, or recent analyst estimates. Any valuation they produce is based on stale information.

### 3. No Accountability
When ChatGPT says a stock is "undervalued at $180," there's no way to track whether that prediction was correct 6 or 12 months later. Without accountability, there's no way to improve.

## What Works Better

A structured approach that:
- **Runs the same models consistently** — DCF, comparables, and asset-based models with the same methodology every time
- **Uses live data** — current prices, latest financials, real-time analyst estimates
- **Tracks accuracy** — every prediction is recorded and measured against reality

This is exactly what Equity Value does. We run 11 institutional models nightly on every S&P 500 stock and publicly track our accuracy.

## Where AI Does Help

We use Claude AI for investment thesis generation — the qualitative analysis that benefits from LLM reasoning. But the quantitative valuation is always model-driven, not AI-generated. AI synthesizes the numbers; it doesn't produce them.

*See our live accuracy data at [/accuracy](/accuracy).*`,
  },
  "q1-2026-earnings-500-stock-analysis": {
    title: "Q1 2026 Earnings: Our 500-Stock Analysis",
    date: "2026-03-10",
    category: "Analysis",
    readTime: "12 min",
    content: `## Overview

As Q1 2026 earnings reports roll in, we've run our full 11-model valuation suite on every S&P 500 company. Here are the headline findings.

## Sector Highlights

### Technology
The sector remains polarized. AI-adjacent companies (NVDA, MSFT, GOOGL) continue to show elevated valuations that our models flag as stretched, while traditional tech (CSCO, IBM, INTC) shows consistent undervaluation. The median Tech EVS score is 52 — slightly below the market average of 55.

### Healthcare
The standout sector this quarter. Biotech M&A activity and strong pharma pipelines have pushed the sector median EVS to 63. Three healthcare stocks received "Strong Buy" verdicts this week, the most of any sector.

### Financials
Bank earnings beat expectations broadly, but our models suggest the rally is fairly priced. The sector median EVS sits at 54, with regional banks showing more upside potential than money-center banks.

### Energy
The most undervalued sector by our models, with a median EVS of 67. However, this comes with the caveat that energy valuations are heavily dependent on commodity price assumptions.

## Biggest Surprises

1. **Consumer Discretionary weakness** — Despite strong consumer spending data, our models flag several retailers as overvalued. The sector has the lowest median EVS at 44.
2. **Utilities strength** — Typically a defensive sector, Utilities are showing unusual value with a median EVS of 65, driven by data center energy demand.
3. **Model consensus convergence** — For the first time, more than 60% of S&P 500 stocks have at least 8 of 11 models agreeing on direction. The market is becoming easier to value.

## What We're Watching

- Earnings revisions for Q2 guidance
- Fed rate decision impact on DCF discount rates
- AI capex sustainability for Tech valuations

*Explore all 500 stocks on the [screener](/screener) or check individual companies for detailed analysis.*`,
  },
};

export default function BlogPostPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const post = POSTS[slug];

  if (!post) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <h2 style={{ color: "var(--text)", marginBottom: 12 }}>Post not found</h2>
        <button onClick={() => navigate("/blog")} style={{
          background: "var(--primary)", color: "#fff", border: "none",
          padding: "10px 24px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>
          Back to Blog
        </button>
      </div>
    );
  }

  return (
    <div className="bp-wrap">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <button className="bp-back" onClick={() => navigate("/blog")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back to Blog
        </button>

        <div className="bp-meta">
          <span className="bp-cat">{post.category}</span>
          <span className="bp-date">{new Date(post.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
          <span className="bp-read">{post.readTime} read</span>
        </div>

        <h1 className="bp-title">{post.title}</h1>

        <div className="bp-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(post.content)) }} />
      </motion.div>

      <style>{`
        .bp-wrap { max-width: 700px; margin: 0 auto; }
        .bp-back {
          display: inline-flex; align-items: center; gap: 6px;
          background: none; border: none; color: var(--primary2);
          font-size: 0.82rem; font-weight: 600; cursor: pointer;
          font-family: inherit; padding: 0; margin-bottom: 28px;
        }
        .bp-back:hover { text-decoration: underline; }
        .bp-meta {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 12px; font-size: 0.75rem; color: var(--text3);
        }
        .bp-cat { color: var(--primary2); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .bp-title {
          font-size: 1.8rem; font-weight: 700; color: var(--text);
          letter-spacing: -1px; line-height: 1.25; margin-bottom: 32px;
        }
        .bp-content { color: var(--text2); font-size: 0.9rem; line-height: 1.8; }
        .bp-content h2 { font-size: 1.2rem; font-weight: 700; color: var(--text); margin: 32px 0 12px; letter-spacing: -0.3px; }
        .bp-content h3 { font-size: 1rem; font-weight: 700; color: var(--text); margin: 24px 0 8px; }
        .bp-content p { margin-bottom: 16px; }
        .bp-content strong { color: var(--text); font-weight: 600; }
        .bp-content ol, .bp-content ul { margin: 0 0 16px 20px; }
        .bp-content li { margin-bottom: 6px; }
        .bp-content em { color: var(--text3); }
        .bp-content a { color: var(--primary2); text-decoration: none; }
        .bp-content a:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}

function renderMarkdown(md) {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}
