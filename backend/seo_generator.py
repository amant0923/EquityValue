"""Generate static HTML pages for SEO from EVS scores.

Outputs to frontend/public/stocks/ for Vercel to serve as static files.
"""
import os
import sys
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

OUTPUT_DIR = Path(__file__).parent.parent / "frontend" / "public" / "stocks"
TEMPLATE_DIR = Path(__file__).parent / "seo_templates"
APP_URL = "https://equityvalue.ai"

VERDICT_RANGES = [
    ("Strong Buy", "strong-buy", 80, 100, "80-100"),
    ("Buy", "buy", 60, 79, "60-79"),
    ("Hold", "hold", 40, 59, "40-59"),
    ("Sell", "sell", 20, 39, "20-39"),
    ("Strong Sell", "strong-sell", 0, 19, "< 20"),
]


def _sector_slug(sector_name: str) -> str:
    """Convert sector name to URL slug (e.g. 'Information Technology' -> 'information-technology')."""
    slug = sector_name.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug)
    return slug


def generate():
    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    stock_tpl = env.get_template("stock.html")
    index_tpl = env.get_template("index.html")
    sector_tpl = env.get_template("sector.html")
    verdict_tpl = env.get_template("verdict.html")

    scores = sb.table("equity_value_scores").select("*").execute().data
    fundamentals = {r["ticker"]: r for r in
                    sb.table("stock_fundamentals").select("ticker, name, sector, current_price").execute().data}

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # --- Per-ticker pages ---
    for s in scores:
        ticker = s["ticker"]
        company = fundamentals.get(ticker, {})
        html = stock_tpl.render(
            ticker=ticker,
            score=s["score"],
            verdict=s["verdict"],
            company_name=company.get("name", ticker),
            sector=company.get("sector", ""),
            price=company.get("current_price", 0),
            components=json.loads(s.get("components", "{}")),
            app_url=APP_URL,
        )
        (OUTPUT_DIR / f"{ticker.lower()}.html").write_text(html)

    sorted_by_score = sorted(scores, key=lambda x: x["score"], reverse=True)

    # --- Main index pages ---
    index_html = index_tpl.render(stocks=sorted_by_score, fundamentals=fundamentals, app_url=APP_URL)
    (OUTPUT_DIR / "index.html").write_text(index_html)

    top = [s for s in sorted_by_score if s["score"] >= 70][:20]
    (OUTPUT_DIR / "undervalued.html").write_text(
        index_tpl.render(stocks=top, fundamentals=fundamentals, title="Most Undervalued Stocks", app_url=APP_URL))

    bottom = sorted(scores, key=lambda x: x["score"])[:20]
    (OUTPUT_DIR / "overvalued.html").write_text(
        index_tpl.render(stocks=bottom, fundamentals=fundamentals, title="Most Overvalued Stocks", app_url=APP_URL))

    # --- Sector index pages ---
    sectors = {}
    for s in scores:
        sector = fundamentals.get(s["ticker"], {}).get("sector", "")
        if sector:
            sectors.setdefault(sector, []).append(s)

    sector_count = 0
    sector_slugs = []
    for sector_name, sector_stocks in sorted(sectors.items()):
        sector_stocks_sorted = sorted(sector_stocks, key=lambda x: x["score"], reverse=True)
        slug = _sector_slug(sector_name)
        sector_slugs.append(slug)

        avg_score = round(sum(s["score"] for s in sector_stocks_sorted) / len(sector_stocks_sorted))
        buy_count = sum(1 for s in sector_stocks_sorted if s.get("verdict", "") in ("Buy", "Strong Buy"))
        sell_count = sum(1 for s in sector_stocks_sorted if s.get("verdict", "") in ("Sell", "Strong Sell"))

        sector_dir = OUTPUT_DIR / slug
        sector_dir.mkdir(parents=True, exist_ok=True)
        html = sector_tpl.render(
            sector_name=sector_name,
            sector_slug=slug,
            stocks=sector_stocks_sorted,
            fundamentals=fundamentals,
            avg_score=avg_score,
            buy_count=buy_count,
            sell_count=sell_count,
            app_url=APP_URL,
        )
        (sector_dir / "index.html").write_text(html)
        sector_count += 1

    # --- Verdict index pages ---
    verdict_count = 0
    verdict_slugs = []
    for label, slug, low, high, score_range in VERDICT_RANGES:
        if label == "Strong Sell":
            verdict_stocks = [s for s in sorted_by_score if s["score"] < 20]
        else:
            verdict_stocks = [s for s in sorted_by_score if low <= s["score"] <= high]

        verdict_slugs.append(slug)
        verdict_dir = OUTPUT_DIR / slug
        verdict_dir.mkdir(parents=True, exist_ok=True)
        html = verdict_tpl.render(
            verdict_label=label,
            verdict_slug=slug,
            score_range=score_range,
            stocks=verdict_stocks,
            fundamentals=fundamentals,
            app_url=APP_URL,
        )
        (verdict_dir / "index.html").write_text(html)
        verdict_count += 1

    # --- Sitemap ---
    _generate_sitemap(scores, sector_slugs, verdict_slugs)

    print(f"Generated {len(scores)} stock pages + 3 index pages + {sector_count} sector pages + {verdict_count} verdict pages + sitemap.xml")


def _generate_sitemap(scores, sector_slugs, verdict_slugs):
    """Generate sitemap.xml listing all static and generated pages."""
    sitemap_path = Path(__file__).parent.parent / "frontend" / "public" / "sitemap.xml"
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    urls = []

    # Main pages
    for path in ["", "/screener", "/accuracy"]:
        urls.append(f"  <url><loc>{APP_URL}{path}</loc><lastmod>{today}</lastmod><changefreq>daily</changefreq></url>")

    # Stock index pages
    for page in ["stocks", "stocks/undervalued", "stocks/overvalued"]:
        urls.append(f"  <url><loc>{APP_URL}/{page}</loc><lastmod>{today}</lastmod><changefreq>daily</changefreq></url>")

    # Sector index pages
    for slug in sector_slugs:
        urls.append(f"  <url><loc>{APP_URL}/stocks/{slug}</loc><lastmod>{today}</lastmod><changefreq>daily</changefreq></url>")

    # Verdict index pages
    for slug in verdict_slugs:
        urls.append(f"  <url><loc>{APP_URL}/stocks/{slug}</loc><lastmod>{today}</lastmod><changefreq>daily</changefreq></url>")

    # Per-ticker pages
    for s in sorted(scores, key=lambda x: x["ticker"]):
        urls.append(f"  <url><loc>{APP_URL}/stocks/{s['ticker'].lower()}</loc><lastmod>{today}</lastmod><changefreq>daily</changefreq></url>")

    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    xml += '\n'.join(urls)
    xml += '\n</urlset>\n'

    sitemap_path.write_text(xml)


if __name__ == "__main__":
    generate()
