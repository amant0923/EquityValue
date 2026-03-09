import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Clock, Star, LayoutGrid, BarChart3, FileText, Check, X, ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";
import SearchBar from "../components/SearchBar";

const FEATURES = [
  { icon: <Activity className="w-5 h-5" />, title: "12 Valuation Models", desc: "DCF, comparables, Graham Number, DDM — all run simultaneously and synthesised into one verdict." },
  { icon: <Clock className="w-5 h-5" />, title: "Live Market Data", desc: "Real-time prices from Finnhub. Fundamental data refreshed continuously from financial databases." },
  { icon: <Star className="w-5 h-5" />, title: "AI Investment Thesis", desc: "Claude-powered investment memos that synthesise the quantitative data into qualitative insight." },
  { icon: <LayoutGrid className="w-5 h-5" />, title: "Monte Carlo & LBO", desc: "10,000-path Monte Carlo simulation and private-equity LBO return modelling, automated." },
  { icon: <BarChart3 className="w-5 h-5" />, title: "Peer Comparables", desc: "Sector peer analysis with live comps, median multiples, and position relative to industry." },
  { icon: <FileText className="w-5 h-5" />, title: "PDF Export", desc: "Download a full institutional-quality PDF report for every analysis you run." },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "",
    desc: "Try the platform with limited access",
    cta: "Sign Up Free",
    ctaStyle: "outline",
    features: [
      "1 analysis per day",
      "8 valuation models",
      "Price chart & fundamentals",
      "Peer comparison table",
    ],
    notIncluded: ["AI investment thesis", "Monte Carlo & LBO", "PDF export", "Compare & full screener"],
  },
  {
    name: "Pro",
    price: "$30",
    period: "/month",
    desc: "For active investors and researchers",
    cta: "Get Pro",
    ctaStyle: "primary",
    badge: "Most Popular",
    features: [
      "5 analyses per day",
      "All 12 valuation models",
      "AI investment thesis (Claude)",
      "Monte Carlo simulation",
      "LBO return modelling",
      "PDF report export",
      "Compare stocks",
      "Full screener filters",
    ],
  },
  {
    name: "Max",
    price: "$50",
    period: "/month",
    desc: "Unlimited access for professionals",
    cta: "Get Max",
    ctaStyle: "featured",
    features: [
      "Unlimited analyses",
      "Everything in Pro",
      "Priority data refresh",
      "DCF sensitivity table",
      "Three-statement projections",
      "Early access to new features",
    ],
  },
];

const TICKERS = ["AAPL", "NVDA", "TSLA", "KO", "JPM", "MSFT", "AMZN", "META"];

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export default function LandingPage({ ticker, setTicker, onSearch, loading, onEnterApp }) {
  return (
    <div className="relative max-w-[1100px] mx-auto px-8 pb-20 flex flex-col gap-24 md:gap-28">

      {/* Radial glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_50%_50%_at_50%_30%,rgba(59,130,246,0.12),transparent_70%)]" />

      {/* ── Hero ── */}
      <motion.section
        className="flex flex-col items-center text-center pt-20 gap-0"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <motion.div variants={fadeUp} className="mb-6">
          <span className="inline-flex items-center gap-2 text-[0.72rem] font-semibold tracking-wider uppercase text-primary2 bg-primary-glow2 border border-primary/20 px-4 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-primary2 rounded-full shadow-[0_0_8px_var(--primary2)] animate-pulse" />
            S&amp;P 500 · 12 Models · Real-Time
          </span>
        </motion.div>

        <motion.h1 variants={fadeUp} className="text-[clamp(2.4rem,5vw,3.8rem)] font-extrabold leading-[1.1] tracking-[-0.04em] text-text mb-5.5">
          Know what a stock is
          <br />
          <span className="bg-gradient-to-r from-primary2 to-indigo2 bg-clip-text text-transparent">actually worth</span>
        </motion.h1>

        <motion.p variants={fadeUp} className="text-[1.05rem] text-text2 leading-relaxed max-w-[560px] mb-9">
          Equity Valuation runs up to 12 institutional valuation models simultaneously — DCF, comparables,
          Graham Number, and more — synthesising them into a single consensus verdict in seconds.
        </motion.p>

        {/* Search */}
        <motion.div variants={fadeUp} className="w-full max-w-[560px] mb-4">
          <SearchBar ticker={ticker} setTicker={setTicker} onSearch={(t) => { onEnterApp(); onSearch(t); }} loading={loading} />
        </motion.div>

        <motion.div variants={fadeUp} className="flex gap-1.5 items-center flex-wrap justify-center mb-12">
          <span className="text-[0.75rem] text-text3 mr-1">Try:</span>
          {TICKERS.map(t => (
            <button
              key={t}
              className="bg-white/[0.03] backdrop-blur-sm border border-white/10 text-text2 px-3.5 py-1.5 rounded-full text-[0.78rem] font-bold font-mono tracking-wide transition-all hover:border-primary/50 hover:text-primary2 hover:bg-primary-glow2 hover:shadow-[0_0_16px_rgba(59,130,246,0.15)] cursor-pointer"
              onClick={() => { setTicker(t); onEnterApp(); onSearch(t); }}
            >
              {t}
            </button>
          ))}
        </motion.div>

        {/* Stats */}
        <motion.div variants={fadeUp} className="flex flex-wrap border border-border2 rounded-xl overflow-hidden bg-surface">
          {[
            { val: "12", label: "Models" },
            { val: "500", label: "Stocks" },
            { val: "~3s", label: "Per analysis" },
            { val: "3", label: "Methodologies" },
          ].map((s, i, arr) => (
            <div key={i} className={cn("flex flex-col items-center px-8 py-4", i < arr.length - 1 && "border-r border-border2")}>
              <span className="text-[1.4rem] font-bold text-text tracking-[-0.5px] font-mono">{s.val}</span>
              <span className="text-[0.68rem] text-text3 uppercase tracking-[0.5px] mt-0.5">{s.label}</span>
            </div>
          ))}
        </motion.div>
      </motion.section>

      {/* ── Methodology — Bento Grid ── */}
      <section>
        <div className="text-center mb-12">
          <h2 className="text-[clamp(1.4rem,3vw,1.9rem)] font-bold text-text tracking-[-0.8px] mb-3">Institutional methodology, democratised</h2>
          <p className="text-[0.92rem] text-text2 leading-[1.7] max-w-[520px] mx-auto">
            Three valuation categories. Each captures a distinct dimension of value. Professionals triangulate all three.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 max-w-5xl mx-auto">
          {[
            {
              color: "blue", label: "Income-Based", models: 4, span: true,
              desc: "Values a company by its capacity to generate future earnings or cash flows, discounted to present value.",
              models_list: ["DCF (Discounted Cash Flow)", "Capitalisation of Earnings", "Gordon Growth Model", "Residual Income"],
            },
            {
              color: "indigo", label: "Market-Based", models: 6,
              desc: "Compares the company against sector peers using standardised market multiples.",
              models_list: ["EV/EBITDA", "EV/EBIT", "EV/Sales", "P/E Ratio", "P/S Ratio", "PEG Ratio"],
            },
            {
              color: "emerald", label: "Asset-Based", models: 2,
              desc: "Values the company on the basis of its net asset position — what it owns minus what it owes.",
              models_list: ["Price-to-Book (P/B)", "Graham Number"],
            },
          ].map((cat, i) => (
            <motion.div
              key={i}
              className={cn(
                "backdrop-blur-lg bg-white/[0.04] border border-white/10 rounded-xl p-7 flex flex-col gap-4 transition-all hover:-translate-y-1 hover:border-white/20 shadow-[0_-20px_80px_-20px_rgba(255,255,255,0.03)_inset]",
                cat.span && "lg:row-span-2"
              )}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <div className="flex justify-between items-center">
                <span className={cn(
                  "text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full tracking-[0.5px] uppercase border",
                  cat.color === "blue" && "bg-blue-500/10 text-blue-300 border-blue-500/20",
                  cat.color === "indigo" && "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
                  cat.color === "emerald" && "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
                )}>{cat.label}</span>
                <span className="text-[0.7rem] text-text3 font-medium">{cat.models} models</span>
              </div>
              <p className="text-[0.83rem] text-text2 leading-[1.65]">{cat.desc}</p>
              <ul className="flex flex-col gap-[7px] list-none">
                {cat.models_list.map((m, j) => (
                  <li key={j} className="flex items-center gap-2 text-[0.8rem] text-text3">
                    <span className={cn(
                      "w-[5px] h-[5px] rounded-full shrink-0",
                      cat.color === "blue" && "bg-blue-500",
                      cat.color === "indigo" && "bg-indigo-500",
                      cat.color === "emerald" && "bg-emerald-500",
                    )} />
                    {m}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section>
        <div className="text-center mb-12">
          <h2 className="text-[clamp(1.4rem,3vw,1.9rem)] font-bold text-text tracking-[-0.8px] mb-3">Everything you need for serious equity research</h2>
          <p className="text-[0.92rem] text-text2 leading-[1.7] max-w-[520px] mx-auto">Built for investors who want institutional rigour without the institutional cost.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              className="backdrop-blur-lg bg-white/[0.04] border border-white/10 rounded-xl p-6 flex flex-col gap-3 transition-all hover:scale-[1.02] hover:border-white/20"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.07 }}
            >
              <div className="w-10 h-10 rounded-lg bg-white/[0.08] border border-white/10 flex items-center justify-center text-primary2">
                {f.icon}
              </div>
              <h3 className="text-[0.92rem] font-bold text-text tracking-[-0.2px]">{f.title}</h3>
              <p className="text-[0.8rem] text-text2 leading-[1.65]">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing">
        <div className="text-center mb-12">
          <h2 className="text-[clamp(1.4rem,3vw,1.9rem)] font-bold text-text tracking-[-0.8px] mb-3">Simple, transparent pricing</h2>
          <p className="text-[0.92rem] text-text2 leading-[1.7] max-w-[520px] mx-auto">Start free. Upgrade when you need the full suite.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-5 items-center lg:items-stretch justify-center max-w-[960px] mx-auto">
          {PRICING.map((plan, i) => (
            <motion.div
              key={i}
              className={cn(
                "relative backdrop-blur-lg rounded-2xl p-8 flex flex-col gap-1.5 w-full max-w-xs",
                plan.ctaStyle === "primary" && "bg-white/[0.07] border-2 border-primary/30 ring-2 ring-primary/10 lg:scale-105 shadow-[0_0_40px_rgba(59,130,246,0.1)]",
                plan.ctaStyle === "featured" && "bg-white/[0.04] border border-indigo/30",
                plan.ctaStyle === "outline" && "bg-white/[0.04] border border-white/10",
              )}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-indigo text-white text-[0.65rem] font-bold tracking-wider uppercase px-3.5 py-1 rounded-full whitespace-nowrap">
                  {plan.badge}
                </div>
              )}
              <div className="text-[0.8rem] font-bold tracking-[1px] uppercase text-text3 mb-1.5">{plan.name}</div>
              <div className="flex items-baseline gap-1 mb-1.5">
                <span className="text-[2.8rem] font-bold tracking-[-2px] text-text font-mono">{plan.price}</span>
                <span className="text-[0.9rem] text-text3">{plan.period}</span>
              </div>
              <p className="text-[0.82rem] text-text2 mb-5">{plan.desc}</p>

              <button
                className={cn(
                  "w-full py-3 rounded-lg font-sans text-[0.88rem] font-bold cursor-pointer transition-all tracking-[0.2px] mb-5",
                  plan.ctaStyle === "primary" && "bg-gradient-to-r from-primary to-indigo text-white border-none shadow-[var(--shadow-blue)] hover:opacity-90 hover:-translate-y-px",
                  plan.ctaStyle === "outline" && "bg-transparent text-text border border-border2 hover:border-primary hover:text-primary2",
                  plan.ctaStyle === "featured" && "bg-gradient-to-r from-indigo to-[#7c3aed] text-white border-none shadow-[0_4px_24px_rgba(129,140,248,0.25)] hover:opacity-90 hover:-translate-y-px",
                )}
                onClick={onEnterApp}
              >
                {plan.cta}
              </button>

              {/* Gradient divider */}
              <div className="w-full h-px bg-gradient-to-r from-transparent via-white/15 to-transparent mb-5" />

              <ul className="flex flex-col gap-2.5 list-none">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2.5 text-[0.82rem] text-text2">
                    <Check className="w-3.5 h-3.5 text-green2 shrink-0" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
                {(plan.notIncluded || []).map((f, j) => (
                  <li key={`n${j}`} className="flex items-center gap-2.5 text-[0.82rem] text-text3 line-through opacity-50">
                    <X className="w-3.5 h-3.5 text-text3 shrink-0" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <motion.section
        className="relative text-center flex flex-col items-center gap-4 py-20 max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,rgba(59,130,246,0.08),transparent_70%)]" />
        <h2 className="text-[clamp(1.4rem,3vw,2rem)] font-bold text-text tracking-[-0.8px]">
          Ready to see what the market is <span className="bg-gradient-to-r from-primary2 to-indigo2 bg-clip-text text-transparent">missing</span>?
        </h2>
        <p className="text-[0.92rem] text-text2">Run your first valuation in seconds. No sign-up required.</p>
        <button
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-indigo text-white border-none px-8 py-3.5 rounded-lg font-sans text-[0.92rem] font-bold cursor-pointer transition-all shadow-[var(--shadow-blue)] mt-2 hover:opacity-90 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(59,130,246,0.35)]"
          onClick={onEnterApp}
        >
          Start Analysing — It's Free
          <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </motion.section>
    </div>
  );
}
