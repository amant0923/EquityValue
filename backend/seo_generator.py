"""Generate static HTML pages for SEO from EVS scores.

Outputs to frontend/public/stocks/ for Vercel to serve as static files.
"""
import os
import sys
import json
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

OUTPUT_DIR = Path(__file__).parent.parent / "frontend" / "public" / "stocks"
TEMPLATE_DIR = Path(__file__).parent / "seo_templates"


def generate():
    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    stock_tpl = env.get_template("stock.html")
    index_tpl = env.get_template("index.html")

    scores = sb.table("equity_value_scores").select("*").execute().data
    fundamentals = {r["ticker"]: r for r in
                    sb.table("stock_fundamentals").select("ticker, name, sector, current_price").execute().data}

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

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
            app_url="https://equityvalue.ai",
        )
        (OUTPUT_DIR / f"{ticker.lower()}.html").write_text(html)

    sorted_by_score = sorted(scores, key=lambda x: x["score"], reverse=True)
    index_html = index_tpl.render(stocks=sorted_by_score, fundamentals=fundamentals, app_url="https://equityvalue.ai")
    (OUTPUT_DIR / "index.html").write_text(index_html)

    top = [s for s in sorted_by_score if s["score"] >= 70][:20]
    (OUTPUT_DIR / "undervalued.html").write_text(
        index_tpl.render(stocks=top, fundamentals=fundamentals, title="Most Undervalued Stocks", app_url="https://equityvalue.ai"))

    bottom = sorted(scores, key=lambda x: x["score"])[:20]
    (OUTPUT_DIR / "overvalued.html").write_text(
        index_tpl.render(stocks=bottom, fundamentals=fundamentals, title="Most Overvalued Stocks", app_url="https://equityvalue.ai"))

    print(f"Generated {len(scores)} stock pages + 3 index pages")


if __name__ == "__main__":
    generate()
