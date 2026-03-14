# Equity Value — Market Viability Analysis Prompt

> A meticulously engineered prompt to conduct competitive analysis and market research determining whether **Equity Value** (equityvalue.ai) can produce profit in the retail investment tools market.
>
> **Prompt patterns used:** Role-based system prompt, chain-of-thought with self-verification, structured output (JSON schema), progressive disclosure, few-shot examples, error recovery guardrails.

---

## The Prompt

Copy everything below the line into Claude (or any frontier LLM). Replace bracketed `[PLACEHOLDERS]` with current data before running.

---

```
<system>
You are a senior strategy consultant with 15 years at McKinsey's Technology, Media & Telecom practice and 5 years as a fintech venture partner. You have deep expertise in SaaS unit economics, retail investor product-market fit, and competitive moats in financial data services.

Your analysis must be:
- Data-driven: cite specific numbers, name specific competitors, reference actual pricing
- Brutally honest: identify fatal flaws as clearly as opportunities
- Actionable: every finding must link to a "so what" for the founder
- Structured: follow the exact output schema provided

You are NOT a cheerleader. If the product cannot produce profit, say so clearly and explain why.
</system>

<context>
## Product Under Analysis: Equity Value

**What it is:** A B2C SaaS platform providing institutional-grade equity valuation for S&P 500 stocks. Runs 12 simultaneous valuation models (DCF, Gordon Growth, EV/EBITDA, P/E, PEG, Graham Number, etc.), generates AI-powered investment theses via Claude, and includes Monte Carlo simulations, LBO modeling, peer comps, financial statement deep dives, insider/senate trade tracking, and PDF report export.

**Pricing tiers:**
| Plan | Price | Daily Limit | Key Gated Features |
|------|-------|-------------|-------------------|
| Free | $0/mo | 1 analysis/day | 8 of 12 models, basic chart, peer table |
| Pro | $30/mo | 5 analyses/day | All 12 models, AI thesis, Monte Carlo, LBO, PDF, compare, full screener |
| Max | $50/mo | Unlimited | Everything + priority data, DCF sensitivity, 3-statement projections, early access |

**Tech stack:** React/Vite frontend (Vercel), FastAPI backend (Render), Supabase Postgres, Finnhub + FMP API data, Stripe billing, Anthropic Claude for AI.

**Data coverage:** S&P 500 universe. Refreshed daily (analyst, insider, scores), weekly (metrics, growth, dividends, segments), quarterly (financials, earnings).

**Current stage:** Live product, pre-revenue / early revenue. Solo founder.

**Target users:** Active retail investors, self-directed traders, finance students, independent analysts who want professional-grade analysis without Bloomberg/FactSet costs.

**Variable costs per user (estimated):**
- Finnhub API: ~$[FINNHUB_MONTHLY_COST]/mo (shared across all users)
- FMP API: ~$[FMP_MONTHLY_COST]/mo (shared across all users)
- Anthropic API: ~$[AVG_COST_PER_AI_THESIS] per AI thesis generation
- Render hosting: ~$[RENDER_MONTHLY_COST]/mo
- Vercel hosting: ~$[VERCEL_MONTHLY_COST]/mo
- Supabase: ~$[SUPABASE_MONTHLY_COST]/mo
</context>

<task>
Conduct a comprehensive competitive analysis and market viability assessment for Equity Value. Your analysis must answer ONE core question:

**"Can Equity Value generate sustainable profit, and if so, under what conditions?"**

Think through this step by step. For each section, show your reasoning before reaching conclusions.

## SECTION 1: Market Definition & Sizing

Step 1: Define the exact market Equity Value competes in. Be specific — not "fintech" but the precise segment.

Step 2: Size the market using TAM → SAM → SOM methodology.
- TAM: Total retail investment tools/platforms market globally
- SAM: The segment Equity Value can actually serve (self-directed US investors who pay for analysis tools)
- SOM: Realistic obtainable market share in years 1-3 given current product and resources

Step 3: Identify the growth trajectory. Is this market expanding, contracting, or stable? What CAGR? What's driving the trend?

Cite specific data sources for all numbers. If you must estimate, label it "[ESTIMATE]" and explain your methodology.

## SECTION 2: Competitive Landscape

### 2A: Direct Competitors
Identify and analyze 8-12 direct competitors that offer stock valuation / fundamental analysis tools to retail investors. For EACH competitor, provide:

| Field | Detail Required |
|-------|----------------|
| Name | Company/product name |
| Pricing | Exact tiers and prices |
| Coverage | Number of stocks, markets |
| Valuation models | Which models, how many |
| AI features | What AI capabilities |
| Data freshness | Real-time, daily, delayed? |
| User base | Estimated users or revenue |
| Funding/backing | VC funding, acquirer, bootstrapped |
| Moat | What makes them hard to displace |
| Weakness | Where they fall short |

Include at minimum: Simply Wall St, Stock Analysis, GuruFocus, Finbox, Alpha Spread, Wisesheets, Macroaxis, Intrinio, Koyfin, Finviz, TipRanks, Seeking Alpha.

### 2B: Indirect Competitors & Substitutes
Analyze threats from:
- Free alternatives (Yahoo Finance, Google Finance, Finviz free tier)
- Brokerage built-in tools (Schwab, Fidelity, Interactive Brokers research)
- AI-native competitors (ChatGPT/Perplexity doing stock analysis on demand)
- Spreadsheet/DIY approach (investors who build their own DCF in Excel)
- Social/community platforms (r/wallstreetbets, StockTwits, Commonstock)

### 2C: Competitive Positioning Matrix
Place Equity Value and all identified competitors on TWO 2x2 matrices:

**Matrix 1:** X-axis = Price (Free → Premium), Y-axis = Depth of Analysis (Surface → Institutional-grade)

**Matrix 2:** X-axis = Automation (Manual → Fully Automated), Y-axis = Coverage (Narrow → Broad market)

For each matrix, identify which quadrant is most crowded and which has whitespace.

### 2D: Porter's Five Forces
Rate each force as High / Medium / Low with specific justification:
1. Threat of new entrants
2. Bargaining power of suppliers (data providers)
3. Bargaining power of buyers (retail investors)
4. Threat of substitutes
5. Competitive rivalry

## SECTION 3: Product-Market Fit Assessment

Step 1: Define the Ideal Customer Profile (ICP). Who is the ONE persona most likely to pay $30-50/mo for Equity Value? Be specific about demographics, behavior, current tools, pain points, and willingness to pay.

Step 2: Assess product-market fit signals. Based on the product description:
- What is the "hair on fire" problem Equity Value solves?
- How often does the ICP need this? (Daily? Weekly? Quarterly?)
- What is the switching cost FROM current solutions?
- What is the "aha moment" that converts free → paid?

Step 3: Identify the 3 biggest product-market fit risks and how each could be mitigated.

## SECTION 4: Unit Economics & Profitability Model

Build a unit economics model with these scenarios:

### Scenario A: Conservative (Year 1)
- 500 free users, 25 Pro ($30), 10 Max ($50)
- Calculate: MRR, ARR, gross margin, CAC assumptions, LTV, LTV:CAC ratio
- Verdict: Profitable? Break-even? Cash-burning?

### Scenario B: Moderate (Year 2)
- 5,000 free users, 250 Pro, 100 Max
- Same calculations

### Scenario C: Ambitious (Year 3)
- 25,000 free users, 1,500 Pro, 500 Max
- Same calculations

For each scenario, calculate:
- Monthly recurring revenue (MRR)
- Variable costs (API, hosting, AI inference scaled by usage)
- Gross margin %
- Required CAC to hit these numbers
- Estimated LTV at 8% monthly churn (industry average for consumer SaaS)
- LTV:CAC ratio
- Months to profitability

### Break-even Analysis
What is the minimum number of paying subscribers needed to cover fixed + variable costs? Show the math.

## SECTION 5: Moat & Defensibility Analysis

Evaluate Equity Value's competitive moat across these dimensions:

| Moat Type | Rating (None/Weak/Moderate/Strong) | Evidence |
|-----------|-------------------------------------|----------|
| Proprietary data | | |
| Proprietary algorithms | | |
| Network effects | | |
| Switching costs | | |
| Brand recognition | | |
| Scale economics | | |
| Regulatory advantage | | |

Be honest. If the moat is weak, say so and explain what it would take to build one.

## SECTION 6: Strategic Threats & Risks

Identify and rate the top 10 risks to Equity Value's profitability:

For each risk:
1. Description (what could go wrong)
2. Probability: High / Medium / Low
3. Impact: Critical / Major / Minor
4. Timeframe: Immediate / 1-2 years / 3-5 years
5. Mitigation strategy

Pay special attention to:
- AI commoditization (ChatGPT/Perplexity replacing the need for dedicated tools)
- Data provider risk (Finnhub/FMP changing pricing or terms)
- Platform risk (Vercel/Render/Supabase pricing changes)
- Regulatory risk (SEC rules on AI-generated investment advice)
- Solo founder risk (bus factor = 1)

## SECTION 7: Strategic Recommendations

Based on ALL preceding analysis, provide:

### 7A: Go / No-Go Verdict
State clearly: Should the founder continue investing time and money in Equity Value? Frame as one of:
- **Strong Go**: Clear path to profitability with current approach
- **Conditional Go**: Viable IF specific changes are made (list them)
- **Pivot**: The core product isn't viable but adjacent opportunities exist
- **No-Go**: The market/competitive dynamics make profitability unlikely

### 7B: If Go — Top 5 Priority Actions
Ranked by impact, with specific implementation guidance:
1. [Action] — Why, How, Expected Impact, Timeline
2. ...

### 7C: If Go — Pricing Strategy Recommendation
Should the pricing change? Analyze:
- Is $30/mo the right Pro price point vs competitors?
- Should there be an annual discount?
- Is the free tier giving away too much?
- Is the feature gate between tiers optimal?

### 7D: If Go — Growth Strategy
What is the most capital-efficient path to 1,000 paying subscribers?
- Channel recommendations (SEO, content, community, partnerships, paid)
- Estimated CAC by channel
- Timeline to 1,000 paid users

### 7E: If Go — 18-Month Roadmap
What features or capabilities would most improve the competitive position and justify the price point?

## SECTION 8: Verification & Confidence Assessment

Review your entire analysis and:
1. Flag any claims where your confidence is below 70%
2. Identify the 3 assumptions most likely to be wrong
3. State what additional data would most improve this analysis
4. Rate your overall confidence in the Go/No-Go verdict (1-10 scale with justification)
</task>

<output_format>
Structure your response using the exact section numbers above (1-8). Use markdown formatting.

For quantitative claims, use this format:
- **Verified data**: "Simply Wall St has 3M+ users (source: company website)"
- **Estimated**: "[ESTIMATE] Market size ~$2.8B based on [methodology]"
- **Unknown**: "[UNKNOWN — would need X data to determine]"

For competitor comparisons, use tables wherever possible for scanability.

For the Go/No-Go verdict, use a colored callout:
> **VERDICT: [Strong Go / Conditional Go / Pivot / No-Go]**
> [One-sentence summary of rationale]
</output_format>

<verification>
Before submitting your response, verify:
✓ Every competitor has specific pricing listed (not "varies" or "competitive")
✓ TAM/SAM/SOM numbers have methodologies explained
✓ Unit economics math is internally consistent (check arithmetic)
✓ Porter's Five Forces ratings are justified with market-specific evidence
✓ Recommendations are specific enough to act on this week
✓ You've addressed the AI commoditization threat honestly
✓ The verdict is supported by the preceding analysis, not just vibes
</verification>
```

---

## How to Use This Prompt

### Step 1: Fill in your actual costs
Replace the `[PLACEHOLDER]` values in the `<context>` block with your real numbers:
- `[FINNHUB_MONTHLY_COST]` — your Finnhub API plan cost
- `[FMP_MONTHLY_COST]` — your FMP API plan cost
- `[AVG_COST_PER_AI_THESIS]` — average Anthropic API cost per thesis call
- `[RENDER_MONTHLY_COST]` — your Render bill
- `[VERCEL_MONTHLY_COST]` — your Vercel bill
- `[SUPABASE_MONTHLY_COST]` — your Supabase bill

### Step 2: Run the prompt
Paste the entire prompt (system + context + task + output_format + verification) into Claude Opus or GPT-4o. Use the longest context model available — this prompt needs ~100K+ token output capacity.

### Step 3: Follow up with targeted drilldowns
After getting the initial analysis, use these follow-up prompts:

**Drilldown 1 — Deep competitor teardown:**
```
Take competitor [NAME] from your analysis. Do a full teardown:
- Sign up for their free tier and document the onboarding flow
- List every feature with screenshots
- Identify their top 3 reviews on G2/Capterra and what users praise/complain about
- Analyze their SEO strategy (top ranking keywords)
- Estimate their MRR based on publicly available signals
```

**Drilldown 2 — Pricing experiment design:**
```
Design 3 pricing experiments I can run in the next 30 days to validate willingness to pay. For each: hypothesis, test design, success metric, sample size needed, and implementation steps.
```

**Drilldown 3 — AI threat scenario planning:**
```
Model 3 scenarios for how AI assistants (ChatGPT, Perplexity, Gemini) evolve in stock analysis over the next 24 months. For each scenario: probability, impact on Equity Value, and defensive strategy.
```

### Step 4: Generate the full market research report
If the analysis warrants it, use the market-research-reports skill to produce a 50+ page PDF with visuals, using the competitive analysis output as source material.

---

## Prompt Engineering Patterns Applied

| Pattern | Where Used | Why |
|---------|-----------|-----|
| **Role-based system prompt** | `<system>` block | Anchors the model in McKinsey-style analytical rigor, prevents cheerleading |
| **Chain-of-thought** | "Step 1... Step 2... Step 3" in each section | Forces structured reasoning, prevents jumping to conclusions |
| **Self-verification** | Section 8 + `<verification>` checklist | Catches errors, flags low-confidence claims, identifies wrong assumptions |
| **Structured output** | Table schemas, exact section numbering, output_format block | Ensures completeness, makes output scannable and comparable |
| **Progressive disclosure** | Sections build on each other (market → competitors → fit → economics → verdict) | Each section's conclusions feed the next, creating compound insight |
| **Few-shot formatting** | Verified/Estimated/Unknown labeling examples | Shows the model exactly how to handle uncertainty |
| **Error recovery** | Confidence assessment, "what data would improve this" | Graceful handling of knowledge gaps instead of hallucination |
| **Specificity constraints** | "Not 'varies' — list exact pricing", "name specific competitors" | Prevents vague, unhelpful generalities |
| **Adversarial framing** | "You are NOT a cheerleader", "If the moat is weak, say so" | Counteracts sycophancy bias in LLMs |
