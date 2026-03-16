# Help/Tutorial Page Design

**Date:** 2026-03-16
**Status:** Approved

## Goal

Add a public help/tutorial page at `/help` that combines a Getting Started guide (numbered visual cards) with collapsible FAQ sections covering every feature.

## Route & Access

- **URL:** `/help`
- **Auth:** Public — no login required
- **Navigation:** Accessible from landing page header, app sidebar ("Help" nav item), and footer links
- **Layout:** When accessed without auth, renders inside the app shell (AppLayout) like other pages

## Section 1: Getting Started

Numbered visual cards in a responsive grid (3 columns on desktop, 1 on mobile). Each card contains:
- Circular step number badge
- SVG icon
- Title (bold)
- 2-sentence description
- "Learn more →" link to the relevant page

### Steps

1. **Search a Stock** — Enter any S&P 500 ticker to get started. We run 11 institutional valuation models instantly. → `/analysis`
2. **Read the EVS Score** — Every stock gets a 1-100 Equity Value Score combining valuation, health, analyst consensus, growth, and risk. → `/screener`
3. **Explore the Company** — Dive into financials, analyst ratings, insider trades, and earnings history on the company page. → `/company/AAPL`
4. **Get an AI Thesis** — Pro users get a Claude-powered investment memo that synthesizes all the quantitative data into qualitative insight. → `/analysis`
5. **Track with Watchlist** — Add stocks to your watchlist and organize them into custom groups. Get alerts on score changes. → `/dashboard`
6. **Compare & Screen** — Use the screener to filter by sector, EVS score, and fundamentals. Compare stocks side by side. → `/screener`

## Section 2: Feature FAQ

Collapsible accordion grouped by topic. Click title to expand/collapse. Body text uses simple formatted paragraphs.

### Groups

**EVS Score**
- What is the Equity Value Score?
- How is the EVS calculated?
- What do the verdicts (Strong Buy, Buy, Hold, Sell, Strong Sell) mean?
- How often is the EVS updated?
- What is sector percentile?

**Valuation Models**
- Which 11 models does Equity Value use?
- How does the consensus work?
- What does "not applicable" mean for a model?
- What are income-based, market-based, and asset-based models?

**Company Pages**
- What does the Summary tab show?
- What's in the Financials tab?
- What's in the Intelligence tab?
- What's in the Valuation tab?

**Screener**
- How do screener filters work?
- What is the "Best in Sector" badge?
- How do I sort by sector percentile?

**AI Thesis**
- What is the AI investment thesis?
- Which AI model generates it?
- How often does the thesis refresh?

**Plans & Billing**
- What can I do on the free plan?
- What does Pro include?
- Is there a lifetime deal?
- Do you offer a student discount?
- How does the referral program work?

**Data & Accuracy**
- Where does the data come from?
- How is accuracy tracked?
- How often is data refreshed?

## Section 3: Contact

Simple centered block: "Still have questions? Email support@equityvalue.ai" with mailto link.

## Technical Approach

- **File:** `frontend/src/pages/HelpPage.jsx` (single new file)
- **Route:** Add to `App.jsx` inside AppLayout routes
- **Sidebar:** Add "Help" item to `Sidebar.jsx` NAV array (question-mark icon)
- **Landing page:** Add "Help" link to header nav
- **Styling:** Inline `<style>` tag following existing page patterns (no external CSS)
- **State:** Local `useState` for accordion open/close (array of open section IDs)
- **No backend changes** — all content is static, hardcoded in the component
