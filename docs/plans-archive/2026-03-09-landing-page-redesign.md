# Landing Page Redesign — Visual Upgrade with Tailwind + shadcn/ui + 21st.dev

**Date:** 2026-03-09
**Status:** Approved
**Scope:** `frontend/src/pages/LandingPage.jsx` rewrite. No changes to other components.

## Goal

Polish the landing page from custom CSS to Tailwind + shadcn/ui, keeping the existing dark glassmorphism aesthetic but making it more modern and professional. Use 21st.dev component patterns as inspiration.

## Infrastructure

### New dependencies
- `tailwindcss` + `@tailwindcss/vite` (Vite plugin)
- `shadcn/ui` CLI → `cn()` utility, Button, Card base components
- `class-variance-authority`, `clsx`, `tailwind-merge` (shadcn deps)
- `lucide-react` (replaces inline SVG icons)

### Tailwind config
- Map existing CSS variables (`--primary`, `--text`, `--surface`, `--border`, etc.) into Tailwind theme
- Dark mode is default; light mode override stays in `index.css`

### Coexistence
- Only `LandingPage.jsx` uses Tailwind in this phase
- All other components keep their inline `<style>` tags unchanged
- No migration of existing components

## Section Designs

### 1. Hero
- **Announcement pill:** rounded-full glass badge ("S&P 500 · 12 Models · Real-Time") with subtle border glow
- **Headline:** `text-5xl md:text-6xl font-bold`, gradient text (`bg-clip-text text-transparent`, white → white/60), tight letter-spacing
- **Subheading:** `text-lg text-muted-foreground`, max-w-2xl centered
- **SearchBar:** existing component, unchanged
- **Ticker pills:** rounded-full glass buttons with `backdrop-blur` and hover glow
- **Stats row:** 4 stats horizontal with dividers, `font-mono` for numbers
- **Background:** Subtle radial gradient glow (blue/indigo ~10% opacity) centered behind hero
- **Animation:** Framer Motion stagger (0.08s delay), fade-up entrance

### 2. Methodology (Bento Grid)
- **Layout:** Asymmetric bento grid within `max-w-6xl`:
  - Income-Based (4 models) — tall card, 2 rows left
  - Market-Based (6 models) — wide card, top right
  - Asset-Based (2 models) — smaller card, bottom right
- **Card style:** `backdrop-blur-lg bg-white/5 border border-white/10`, inset shadow
- **Per card:** Color-coded icon container (blue/purple/green), category title + model count badge, bullet list of models
- **Hover:** `-translate-y-1` + border brightens
- **Responsive:** Single column on mobile, equal height cards
- **Fit:** All content fits within viewport at 1280px+ with `min-h` constraints

### 3. Features
- **Layout:** `lg:grid-cols-3 md:grid-cols-2 grid-cols-1`, 6 equal cards
- **Card style:** `backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-6`
- **Per card:** `lucide-react` icon in `rounded-lg bg-white/10 p-2.5` container, title (`text-base font-semibold`), description (`text-sm text-muted-foreground`)
- **Hover:** border brightens + `hover:scale-[1.02]`
- **Section header:** Centered `text-3xl font-bold` + subtitle
- **Features:** 12 Valuation Models, Live Market Data, AI Investment Thesis, Monte Carlo & LBO, Peer Comparables, PDF Export

### 4. Pricing
- **Layout:** 3 cards in `lg:flex-row flex-col`, centered
- **Free & Max cards:** `backdrop-blur-lg bg-white/5 border border-white/10 rounded-2xl p-8`
- **Pro card (featured):** `scale-105`, `bg-white/10 border-primary/30 ring-2 ring-primary/20`, inset glow, floating gradient "Most Popular" badge
- **Card content:** Plan name → price (`text-5xl font-bold font-mono`) → gradient divider line → feature list (green checkmarks / dim X marks) → CTA button
- **Button variants:** Free = `outline`, Pro = solid gradient `bg-primary`, Max = `secondary`
- **Responsive:** Cards stack vertically on mobile, Pro keeps brighter border but no scale

### 5. CTA Banner
- **Layout:** Full-width, centered content, `max-w-3xl`, `py-20`
- **Headline:** `text-3xl font-bold`, gradient text matching hero
- **Subheading:** `text-muted-foreground`, one line
- **Button:** Solid gradient, `size="lg"`, hover scale
- **Background:** Subtle radial gradient glow (softer than hero)

## What's NOT Changing
- All 23+ non-landing-page components
- App.jsx routing and state management
- AuthContext, Supabase integration
- Backend API
- Dark/light theme toggle logic
- Framer Motion dependency (still used for animations)
