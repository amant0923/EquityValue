# Landing Page Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the landing page with Tailwind CSS + shadcn/ui while keeping the dark glassmorphism aesthetic, using 21st.dev component patterns as inspiration.

**Architecture:** Add Tailwind via `@tailwindcss/vite` plugin. Create a `cn()` utility and minimal shadcn-style components (Button). Rewrite `LandingPage.jsx` section by section. All other components remain untouched.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 4, lucide-react, framer-motion, shadcn/ui patterns (manual, not CLI)

---

### Task 1: Install Tailwind CSS + Dependencies

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.js`
- Modify: `frontend/src/index.css` (add Tailwind import)
- Create: `frontend/src/lib/utils.js`

**Step 1: Install npm packages**

```bash
cd /Users/a/Desktop/stock_valuation_app/frontend
npm install tailwindcss @tailwindcss/vite lucide-react clsx tailwind-merge
```

**Step 2: Add Tailwind Vite plugin**

Edit `frontend/vite.config.js`:

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
});
```

**Step 3: Add Tailwind import to index.css**

Add this line at the very top of `frontend/src/index.css` (before the Google Fonts import):

```css
@import "tailwindcss";
```

**Step 4: Create cn() utility**

Create `frontend/src/lib/utils.js`:

```js
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

**Step 5: Verify Tailwind works**

```bash
cd /Users/a/Desktop/stock_valuation_app/frontend
npm run dev
```

Open http://localhost:5173 — the existing app should render exactly as before (no visual changes). Check browser console for errors.

**Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/src/index.css frontend/src/lib/utils.js
git commit -m "chore: add Tailwind CSS 4, lucide-react, cn() utility"
```

---

### Task 2: Configure Tailwind Theme to Match Existing Design Tokens

**Files:**
- Modify: `frontend/src/index.css`

**Step 1: Add Tailwind theme configuration**

In `frontend/src/index.css`, right after the `@import "tailwindcss";` line, add a `@theme` block that maps CSS variables to Tailwind utilities:

```css
@theme {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface2: var(--surface2);
  --color-surface3: var(--surface3);
  --color-glass: var(--glass);
  --color-glass2: var(--glass2);

  --color-border-default: var(--border);
  --color-border2: var(--border2);
  --color-glass-border: var(--glass-border);
  --color-glass-border2: var(--glass-border2);

  --color-primary: var(--primary);
  --color-primary2: var(--primary2);
  --color-primary-glow: var(--primary-glow);
  --color-primary-glow2: var(--primary-glow2);
  --color-indigo: var(--indigo);
  --color-indigo2: var(--indigo2);
  --color-accent: var(--accent);

  --color-green: var(--green);
  --color-green2: var(--green2);
  --color-green-glow: var(--green-glow);
  --color-red: var(--red);
  --color-red2: var(--red2);
  --color-yellow: var(--yellow);
  --color-yellow2: var(--yellow2);

  --color-text: var(--text);
  --color-text2: var(--text2);
  --color-text3: var(--text3);
  --color-muted: var(--muted);

  --font-sans: "DM Sans", "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;

  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 20px;
}
```

This lets you use classes like `bg-surface`, `text-text2`, `border-border-default`, `text-primary2`, `font-mono`, `rounded-md` etc. in the new landing page.

**Step 2: Verify no visual regression**

```bash
cd /Users/a/Desktop/stock_valuation_app/frontend
npm run dev
```

Existing pages should look identical. Test by navigating around the app.

**Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "chore: configure Tailwind theme with existing CSS design tokens"
```

---

### Task 3: Rewrite Hero Section

**Files:**
- Modify: `frontend/src/pages/LandingPage.jsx`

**Step 1: Replace the imports and data constants**

Replace lines 1-4 of `LandingPage.jsx` with:

```jsx
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, Clock, Star, LayoutGrid,
  BarChart3, FileText, Check, X, ArrowRight
} from "lucide-react";
import { cn } from "../lib/utils";
import SearchBar from "../components/SearchBar";
```

Keep the existing `FEATURES`, `PRICING`, `TICKERS` data arrays BUT replace the inline SVG icons in FEATURES with lucide-react components:

```jsx
const FEATURES = [
  { icon: <Activity className="w-5 h-5" />, title: "12 Valuation Models", desc: "DCF, comparables, Graham Number, DDM — all run simultaneously and synthesised into one verdict." },
  { icon: <Clock className="w-5 h-5" />, title: "Live Market Data", desc: "Real-time prices from Finnhub. Fundamental data refreshed continuously from financial databases." },
  { icon: <Star className="w-5 h-5" />, title: "AI Investment Thesis", desc: "Claude-powered investment memos that synthesise the quantitative data into qualitative insight." },
  { icon: <LayoutGrid className="w-5 h-5" />, title: "Monte Carlo & LBO", desc: "10,000-path Monte Carlo simulation and private-equity LBO return modelling, automated." },
  { icon: <BarChart3 className="w-5 h-5" />, title: "Peer Comparables", desc: "Sector peer analysis with live comps, median multiples, and position relative to industry." },
  { icon: <FileText className="w-5 h-5" />, title: "PDF Export", desc: "Download a full institutional-quality PDF report for every analysis you run." },
];
```

Keep PRICING and TICKERS arrays exactly as-is.

**Step 2: Rewrite the hero section JSX**

Replace the hero `<motion.section>` block (lines ~134-190) with:

```jsx
{/* ── Hero ── */}
<motion.section
  className="flex flex-col items-center text-center pt-20 md:pt-24"
  initial="hidden"
  animate="visible"
  variants={stagger}
>
  {/* Radial glow behind hero */}
  <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_50%_50%_at_50%_30%,rgba(59,130,246,0.12),transparent_70%)]" />

  <motion.div variants={fadeUp} className="mb-6">
    <span className="inline-flex items-center gap-2 text-[0.72rem] font-semibold tracking-wider uppercase text-primary2 bg-primary-glow2 border border-primary/20 px-4 py-1.5 rounded-full">
      <span className="w-1.5 h-1.5 bg-primary2 rounded-full shadow-[0_0_8px_var(--primary2)] animate-pulse" />
      S&amp;P 500 · 12 Models · Real-Time
    </span>
  </motion.div>

  <motion.h1
    variants={fadeUp}
    className="text-[clamp(2.4rem,5vw,3.8rem)] font-extrabold leading-[1.1] tracking-[-0.04em] mb-5"
  >
    Know what a stock is
    <br />
    <span className="bg-gradient-to-r from-primary2 to-indigo2 bg-clip-text text-transparent">
      actually worth
    </span>
  </motion.h1>

  <motion.p variants={fadeUp} className="text-[1.05rem] text-text2 leading-relaxed max-w-[560px] mb-9">
    Equity Valuation runs up to 12 institutional valuation models simultaneously — DCF, comparables,
    Graham Number, and more — synthesising them into a single consensus verdict in seconds.
  </motion.p>

  <motion.div variants={fadeUp} className="w-full max-w-[560px] mb-4">
    <SearchBar ticker={ticker} setTicker={setTicker} onSearch={(t) => { onEnterApp(); onSearch(t); }} loading={loading} />
  </motion.div>

  <motion.div variants={fadeUp} className="flex items-center gap-1.5 flex-wrap justify-center mb-12">
    <span className="text-xs text-text3 mr-1">Try:</span>
    {TICKERS.map(t => (
      <button
        key={t}
        className="bg-white/[0.03] backdrop-blur-sm border border-white/10 text-text2 px-3.5 py-1.5 rounded-full text-[0.78rem] font-bold font-mono tracking-wide transition-all hover:border-primary/50 hover:text-primary2 hover:bg-primary-glow2 hover:shadow-[0_0_16px_rgba(59,130,246,0.15)]"
        onClick={() => { setTicker(t); onEnterApp(); onSearch(t); }}
      >
        {t}
      </button>
    ))}
  </motion.div>

  <motion.div variants={fadeUp} className="flex border border-border2 rounded-xl overflow-hidden bg-surface">
    {[
      { val: "12", label: "Models" },
      { val: "500", label: "Stocks" },
      { val: "~3s", label: "Per analysis" },
      { val: "3", label: "Methodologies" },
    ].map((s, i) => (
      <div key={i} className={cn("flex flex-col items-center px-8 py-4", i < 3 && "border-r border-border2")}>
        <span className="text-[1.4rem] font-bold text-text tracking-tight font-mono">{s.val}</span>
        <span className="text-[0.68rem] text-text3 uppercase tracking-wider mt-0.5">{s.label}</span>
      </div>
    ))}
  </motion.div>
</motion.section>
```

**Step 3: Verify hero renders correctly**

```bash
cd /Users/a/Desktop/stock_valuation_app/frontend
npm run dev
```

Check: hero section renders at http://localhost:5173 with gradient text, glass ticker pills, radial glow. Search bar still works.

**Step 4: Commit**

```bash
git add frontend/src/pages/LandingPage.jsx
git commit -m "feat: rewrite hero section with Tailwind + lucide-react icons"
```

---

### Task 4: Rewrite Methodology Section (Bento Grid)

**Files:**
- Modify: `frontend/src/pages/LandingPage.jsx`

**Step 1: Replace the methodology section**

Replace the "How it works" `<section>` block with:

```jsx
{/* ── How it works ── */}
<section>
  <div className="text-center mb-12">
    <h2 className="text-[clamp(1.4rem,3vw,1.9rem)] font-bold text-text tracking-tight mb-3">
      Institutional methodology, democratised
    </h2>
    <p className="text-[0.92rem] text-text2 leading-relaxed max-w-[520px] mx-auto">
      Three valuation categories. Each captures a distinct dimension of value. Professionals triangulate all three.
    </p>
  </div>

  <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 max-w-5xl mx-auto">
    {/* Income-Based — tall card spanning 2 rows on left */}
    <motion.div
      className="lg:row-span-2 backdrop-blur-lg bg-white/[0.04] border border-white/10 rounded-xl p-7 flex flex-col gap-4 transition-all hover:-translate-y-1 hover:border-white/20 shadow-[0_-20px_80px_-20px_rgba(255,255,255,0.03)_inset]"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex justify-between items-center">
        <span className="text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full tracking-wider uppercase bg-blue-500/10 text-blue-300 border border-blue-500/20">Income-Based</span>
        <span className="text-[0.7rem] text-text3 font-medium">4 models</span>
      </div>
      <p className="text-[0.83rem] text-text2 leading-relaxed">
        Values a company by its capacity to generate future earnings or cash flows, discounted to present value.
      </p>
      <ul className="flex flex-col gap-2 mt-auto">
        {["DCF (Discounted Cash Flow)", "Capitalisation of Earnings", "Gordon Growth Model", "Residual Income"].map((m, j) => (
          <li key={j} className="flex items-center gap-2 text-[0.8rem] text-text3">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            {m}
          </li>
        ))}
      </ul>
    </motion.div>

    {/* Market-Based — top right */}
    <motion.div
      className="backdrop-blur-lg bg-white/[0.04] border border-white/10 rounded-xl p-7 flex flex-col gap-4 transition-all hover:-translate-y-1 hover:border-white/20 shadow-[0_-20px_80px_-20px_rgba(255,255,255,0.03)_inset]"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <div className="flex justify-between items-center">
        <span className="text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full tracking-wider uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">Market-Based</span>
        <span className="text-[0.7rem] text-text3 font-medium">6 models</span>
      </div>
      <p className="text-[0.83rem] text-text2 leading-relaxed">
        Compares the company against sector peers using standardised market multiples.
      </p>
      <ul className="flex flex-col gap-2">
        {["EV/EBITDA", "EV/EBIT", "EV/Sales", "P/E Ratio", "P/S Ratio", "PEG Ratio"].map((m, j) => (
          <li key={j} className="flex items-center gap-2 text-[0.8rem] text-text3">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
            {m}
          </li>
        ))}
      </ul>
    </motion.div>

    {/* Asset-Based — bottom right */}
    <motion.div
      className="backdrop-blur-lg bg-white/[0.04] border border-white/10 rounded-xl p-7 flex flex-col gap-4 transition-all hover:-translate-y-1 hover:border-white/20 shadow-[0_-20px_80px_-20px_rgba(255,255,255,0.03)_inset]"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div className="flex justify-between items-center">
        <span className="text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full tracking-wider uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Asset-Based</span>
        <span className="text-[0.7rem] text-text3 font-medium">2 models</span>
      </div>
      <p className="text-[0.83rem] text-text2 leading-relaxed">
        Values the company on the basis of its net asset position — what it owns minus what it owes.
      </p>
      <ul className="flex flex-col gap-2">
        {["Price-to-Book (P/B)", "Graham Number"].map((m, j) => (
          <li key={j} className="flex items-center gap-2 text-[0.8rem] text-text3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            {m}
          </li>
        ))}
      </ul>
    </motion.div>
  </div>
</section>
```

**Step 2: Verify bento grid renders**

Check: 3 cards in asymmetric grid on desktop (Income tall left, Market top-right, Asset bottom-right). All fit within viewport at 1280px. Single column on mobile.

**Step 3: Commit**

```bash
git add frontend/src/pages/LandingPage.jsx
git commit -m "feat: rewrite methodology section as bento grid with glass cards"
```

---

### Task 5: Rewrite Features Section

**Files:**
- Modify: `frontend/src/pages/LandingPage.jsx`

**Step 1: Replace the features section**

Replace the features `<section>` block with:

```jsx
{/* ── Features ── */}
<section>
  <div className="text-center mb-12">
    <h2 className="text-[clamp(1.4rem,3vw,1.9rem)] font-bold text-text tracking-tight mb-3">
      Everything you need for serious equity research
    </h2>
    <p className="text-[0.92rem] text-text2 leading-relaxed max-w-[520px] mx-auto">
      Built for investors who want institutional rigour without the institutional cost.
    </p>
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
        <h3 className="text-[0.92rem] font-bold text-text tracking-tight">{f.title}</h3>
        <p className="text-[0.8rem] text-text2 leading-relaxed">{f.desc}</p>
      </motion.div>
    ))}
  </div>
</section>
```

**Step 2: Verify features render**

Check: 6 glass cards, 3-col on desktop, 2-col on tablet, 1-col on mobile. Lucide icons render in blue. Hover scale works.

**Step 3: Commit**

```bash
git add frontend/src/pages/LandingPage.jsx
git commit -m "feat: rewrite features section with glass cards + lucide icons"
```

---

### Task 6: Rewrite Pricing Section

**Files:**
- Modify: `frontend/src/pages/LandingPage.jsx`

**Step 1: Replace the pricing section**

Replace the pricing `<section>` block with:

```jsx
{/* ── Pricing ── */}
<section id="pricing">
  <div className="text-center mb-12">
    <h2 className="text-[clamp(1.4rem,3vw,1.9rem)] font-bold text-text tracking-tight mb-3">
      Simple, transparent pricing
    </h2>
    <p className="text-[0.92rem] text-text2 leading-relaxed max-w-[520px] mx-auto">
      Start free. Upgrade when you need the full suite.
    </p>
  </div>

  <div className="flex flex-col lg:flex-row gap-5 items-center lg:items-stretch justify-center max-w-[960px] mx-auto">
    {PRICING.map((plan, i) => {
      const isFeatured = plan.ctaStyle === "primary";
      const isMax = plan.ctaStyle === "featured";

      return (
        <motion.div
          key={i}
          className={cn(
            "relative backdrop-blur-lg rounded-2xl p-8 flex flex-col gap-1.5 w-full max-w-xs transition-all",
            isFeatured
              ? "bg-white/[0.07] border-2 border-primary/30 ring-2 ring-primary/10 lg:scale-105 shadow-[0_0_40px_rgba(59,130,246,0.1)]"
              : isMax
                ? "bg-white/[0.04] border border-indigo/30"
                : "bg-white/[0.04] border border-white/10"
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

          <div className="text-[0.8rem] font-bold tracking-wider uppercase text-text3 mb-1.5">{plan.name}</div>

          <div className="flex items-baseline gap-1 mb-1.5">
            <span className="text-[2.8rem] font-bold tracking-tighter text-text font-mono">{plan.price}</span>
            <span className="text-[0.9rem] text-text3">{plan.period}</span>
          </div>

          <p className="text-[0.82rem] text-text2 mb-5">{plan.desc}</p>

          <button
            className={cn(
              "w-full py-3 rounded-lg font-bold text-[0.88rem] tracking-wide cursor-pointer transition-all mb-5",
              isFeatured && "bg-gradient-to-r from-primary to-indigo text-white border-none shadow-[0_4px_24px_rgba(59,130,246,0.2)] hover:opacity-90 hover:-translate-y-0.5",
              plan.ctaStyle === "outline" && "bg-transparent text-text border border-border2 hover:border-primary hover:text-primary2",
              isMax && "bg-gradient-to-r from-indigo to-[#7c3aed] text-white border-none shadow-[0_4px_24px_rgba(129,140,248,0.25)] hover:opacity-90 hover:-translate-y-0.5"
            )}
            onClick={onEnterApp}
          >
            {plan.cta}
          </button>

          {/* Gradient divider */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-white/15 to-transparent mb-5" />

          <ul className="flex flex-col gap-2.5">
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
      );
    })}
  </div>
</section>
```

**Step 2: Verify pricing renders**

Check: 3 pricing cards. Pro is elevated with blue border glow and "Most Popular" badge. Free has outline CTA. Cards stack on mobile.

**Step 3: Commit**

```bash
git add frontend/src/pages/LandingPage.jsx
git commit -m "feat: rewrite pricing section with glass cards + gradient dividers"
```

---

### Task 7: Rewrite CTA Banner + Remove Old Styles

**Files:**
- Modify: `frontend/src/pages/LandingPage.jsx`

**Step 1: Replace the CTA banner**

Replace the CTA `<motion.section>` block with:

```jsx
{/* ── CTA Banner ── */}
<motion.section
  className="relative text-center flex flex-col items-center gap-4 py-20 max-w-3xl mx-auto"
  initial={{ opacity: 0, y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.4 }}
>
  {/* Subtle radial glow */}
  <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,rgba(59,130,246,0.08),transparent_70%)]" />

  <h2 className="text-[clamp(1.4rem,3vw,2rem)] font-bold tracking-tight">
    <span className="bg-gradient-to-r from-primary2 to-indigo2 bg-clip-text text-transparent">
      Ready to see what the market is missing?
    </span>
  </h2>
  <p className="text-[0.92rem] text-text2">Run your first valuation in seconds. No sign-up required.</p>
  <button
    className="flex items-center gap-2 bg-gradient-to-r from-primary to-indigo text-white border-none px-8 py-3.5 rounded-lg font-bold text-[0.92rem] cursor-pointer transition-all shadow-[0_4px_24px_rgba(59,130,246,0.2)] mt-2 hover:opacity-90 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(59,130,246,0.35)]"
    onClick={onEnterApp}
  >
    Start Analysing — It's Free
    <ArrowRight className="w-4 h-4" />
  </button>
</motion.section>
```

**Step 2: Replace the wrapper div and remove old styles**

Replace the outer wrapper `<div className="lp-wrap">` with:

```jsx
<div className="relative max-w-[1100px] mx-auto px-8 pb-20 flex flex-col gap-24 md:gap-28">
```

**Delete the entire `<style>{...}</style>` block** (lines 344-712 in the original file). All styling is now in Tailwind classes.

**Step 3: Add responsive adjustments**

The Tailwind classes already handle responsive via `md:` and `lg:` prefixes. But verify the stats row wraps on mobile by adding:

In the stats container div, update classes to:

```jsx
<motion.div variants={fadeUp} className="flex flex-wrap border border-border2 rounded-xl overflow-hidden bg-surface">
```

And update each stat div to handle mobile wrapping:

```jsx
<div key={i} className={cn(
  "flex flex-col items-center px-8 py-4 min-w-[120px] flex-1",
  i < 3 && "border-r border-border2 max-sm:border-r-0 max-sm:border-b max-sm:border-border2"
)}>
```

**Step 4: Remove unused `activeTab` state**

The original component has `const [activeTab, setActiveTab] = useState("free");` on line 128 which is never used. Remove it.

**Step 5: Verify full page renders**

```bash
cd /Users/a/Desktop/stock_valuation_app/frontend
npm run dev
```

Check all sections at http://localhost:5173:
- Hero: gradient text, glass pills, radial glow, search works
- Methodology: bento grid, asymmetric layout, fits viewport
- Features: 3-col glass cards, icons render
- Pricing: Pro elevated, badge shows, buttons work
- CTA: gradient text, button works
- Mobile: resize to 640px, all sections stack properly
- Light mode: toggle theme, verify it still works

**Step 6: Commit**

```bash
git add frontend/src/pages/LandingPage.jsx
git commit -m "feat: complete landing page redesign — CTA banner + remove legacy CSS"
```

---

### Task 8: Final Polish and Build Verification

**Files:**
- Modify: `frontend/src/pages/LandingPage.jsx` (if needed)

**Step 1: Production build test**

```bash
cd /Users/a/Desktop/stock_valuation_app/frontend
npm run build
```

Verify no build errors. Check output size is reasonable.

**Step 2: Preview production build**

```bash
npm run preview
```

Open http://localhost:4173, verify landing page renders correctly in production mode.

**Step 3: Visual check at key breakpoints**

Test in browser dev tools at:
- 1440px (desktop)
- 1280px (laptop — verify bento grid fits)
- 768px (tablet)
- 375px (mobile)

Fix any overflow, text clipping, or layout issues found.

**Step 4: Final commit if any fixes needed**

```bash
git add frontend/src/pages/LandingPage.jsx
git commit -m "fix: landing page responsive polish"
```
