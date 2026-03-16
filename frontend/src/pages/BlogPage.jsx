import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const BLOG_POSTS = [
  {
    slug: "11-valuation-models-ranked-by-accuracy",
    title: "11 Valuation Models Ranked by Accuracy: 6-Month Results",
    excerpt: "We ran 11 institutional valuation models on every S&P 500 stock for 6 months. Here's which ones actually predicted price direction.",
    date: "2026-03-18",
    category: "Research",
    readTime: "8 min",
  },
  {
    slug: "why-sector-relative-evs-matters",
    title: "Why Sector-Relative EVS Matters",
    excerpt: "A stock scoring 75 in Tech means something different than 75 in Utilities. How sector-relative scoring changes the game.",
    date: "2026-03-15",
    category: "Methodology",
    readTime: "5 min",
  },
  {
    slug: "problem-with-chatgpt-stock-valuation",
    title: "The Problem with ChatGPT for Stock Valuation",
    excerpt: "LLMs are great at many things. Consistent, reproducible equity valuation isn't one of them. Here's why a structured approach wins.",
    date: "2026-03-12",
    category: "Opinion",
    readTime: "6 min",
  },
  {
    slug: "q1-2026-earnings-500-stock-analysis",
    title: "Q1 2026 Earnings: Our 500-Stock Analysis",
    excerpt: "Every S&P 500 stock run through our models after Q1 earnings. The biggest surprises, sector trends, and model performance.",
    date: "2026-03-10",
    category: "Analysis",
    readTime: "12 min",
  },
];

const CATEGORY_COLORS = {
  Research: "var(--primary2)",
  Methodology: "#22c55e",
  Opinion: "#eab308",
  Analysis: "#a855f7",
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

export default function BlogPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");
  const categories = ["All", ...new Set(BLOG_POSTS.map(p => p.category))];
  const filtered = filter === "All" ? BLOG_POSTS : BLOG_POSTS.filter(p => p.category === filter);

  return (
    <div className="blog-wrap">
      <motion.div initial="hidden" animate="visible" variants={stagger}>
        <motion.div variants={fadeUp} className="blog-header">
          <h1 className="blog-title">Blog</h1>
          <p className="blog-sub">Research, methodology, and market analysis from the Equity Value team</p>
        </motion.div>

        <motion.div variants={fadeUp} className="blog-filters">
          {categories.map(cat => (
            <button
              key={cat}
              className={`blog-filter-btn${filter === cat ? " blog-filter-btn--active" : ""}`}
              onClick={() => setFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </motion.div>

        <motion.div variants={fadeUp} className="blog-grid">
          {filtered.map((post) => (
            <motion.article
              key={post.slug}
              className="blog-card"
              onClick={() => navigate(`/blog/${post.slug}`)}
              whileHover={{ y: -3, transition: { duration: 0.15 } }}
            >
              <div className="blog-card-meta">
                <span className="blog-card-cat" style={{ color: CATEGORY_COLORS[post.category] || "var(--text3)" }}>
                  {post.category}
                </span>
                <span className="blog-card-date">{new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
              <h2 className="blog-card-title">{post.title}</h2>
              <p className="blog-card-excerpt">{post.excerpt}</p>
              <div className="blog-card-footer">
                <span className="blog-card-read">{post.readTime} read</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </div>
            </motion.article>
          ))}
        </motion.div>

        {filtered.length === 0 && (
          <motion.div variants={fadeUp} className="blog-empty">
            <p>No posts in this category yet.</p>
          </motion.div>
        )}
      </motion.div>

      <style>{`
        .blog-wrap { max-width: 900px; margin: 0 auto; }
        .blog-header { margin-bottom: 32px; }
        .blog-title { font-size: 1.6rem; font-weight: 700; color: var(--text); letter-spacing: -0.8px; margin-bottom: 6px; }
        .blog-sub { font-size: 0.85rem; color: var(--text2); }

        .blog-filters { display: flex; gap: 8px; margin-bottom: 28px; flex-wrap: wrap; }
        .blog-filter-btn {
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text3);
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }
        .blog-filter-btn:hover { border-color: var(--primary); color: var(--text); }
        .blog-filter-btn--active { background: var(--primary); color: #fff; border-color: var(--primary); }

        .blog-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 640px) { .blog-grid { grid-template-columns: 1fr; } }

        .blog-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 24px;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .blog-card:hover { border-color: var(--primary); background: var(--surface2); }

        .blog-card-meta { display: flex; align-items: center; justify-content: space-between; }
        .blog-card-cat { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .blog-card-date { font-size: 0.72rem; color: var(--text3); }
        .blog-card-title { font-size: 1rem; font-weight: 700; color: var(--text); line-height: 1.35; letter-spacing: -0.3px; }
        .blog-card-excerpt { font-size: 0.82rem; color: var(--text2); line-height: 1.6; flex: 1; }
        .blog-card-footer {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 0.72rem; color: var(--primary2); font-weight: 500;
          padding-top: 8px; border-top: 1px solid var(--border);
        }

        .blog-empty { text-align: center; padding: 48px; color: var(--text3); font-size: 0.85rem; }
      `}</style>
    </div>
  );
}
