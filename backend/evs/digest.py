"""Weekly digest email — sends personalized summaries to users via Resend."""
import os
import sys
import requests
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", os.environ.get("SUPABASE_KEY", ""))
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = "digest@equityvalue.ai"
APP_URL = "https://equityvalue.ai"

sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_top_scores(n=5):
    return sb.table("equity_value_scores") \
        .select("ticker, score, verdict") \
        .order("score", desc=True) \
        .limit(n) \
        .execute().data


def get_biggest_movers(n=5):
    """Get stocks with largest score changes this week."""
    from datetime import timedelta
    week_ago = (datetime.now(timezone.utc).date() - timedelta(days=7)).isoformat()
    current = {r["ticker"]: r["score"] for r in
               sb.table("equity_value_scores").select("ticker, score").execute().data}
    prev = {r["ticker"]: r["score"] for r in
            sb.table("equity_value_score_history").select("ticker, score")
            .gte("computed_at", week_ago).execute().data}
    movers = []
    for ticker, cur_score in current.items():
        prev_score = prev.get(ticker)
        if prev_score is not None:
            change = cur_score - prev_score
            movers.append({"ticker": ticker, "score": cur_score, "change": change})
    movers.sort(key=lambda x: abs(x["change"]), reverse=True)
    return movers[:n]


def get_all_movers():
    """Get all tickers with their score changes this week (for watchlist filtering)."""
    from datetime import timedelta
    week_ago = (datetime.now(timezone.utc).date() - timedelta(days=7)).isoformat()
    current = {r["ticker"]: r for r in
               sb.table("equity_value_scores").select("ticker, score, verdict").execute().data}
    prev = {r["ticker"]: r["score"] for r in
            sb.table("equity_value_score_history").select("ticker, score")
            .gte("computed_at", week_ago).execute().data}
    movers = {}
    for ticker, cur in current.items():
        prev_score = prev.get(ticker)
        change = (cur["score"] - prev_score) if prev_score is not None else 0
        movers[ticker] = {"ticker": ticker, "score": cur["score"],
                          "verdict": cur["verdict"], "change": change}
    return movers


def get_user_watchlist_tickers(user_id):
    """Get unique tickers from a user's alert subscriptions."""
    rows = sb.table("user_alerts") \
        .select("ticker") \
        .eq("user_id", user_id) \
        .eq("enabled", True) \
        .execute().data
    return list({r["ticker"] for r in rows})


def get_new_strong_buys():
    """Get tickers that changed to Strong Buy verdict this week."""
    from datetime import timedelta
    week_ago = (datetime.now(timezone.utc).date() - timedelta(days=7)).isoformat()
    current = {r["ticker"]: r for r in
               sb.table("equity_value_scores").select("ticker, score, verdict").execute().data}
    prev_rows = sb.table("equity_value_score_history") \
        .select("ticker, verdict") \
        .gte("computed_at", week_ago) \
        .execute().data
    # Get earliest verdict for each ticker from the week
    prev_verdicts = {}
    for r in prev_rows:
        if r["ticker"] not in prev_verdicts:
            prev_verdicts[r["ticker"]] = r["verdict"]
    new_strong = []
    for ticker, cur in current.items():
        if cur["verdict"] == "Strong Buy" and prev_verdicts.get(ticker) != "Strong Buy":
            new_strong.append({"ticker": ticker, "score": cur["score"]})
    new_strong.sort(key=lambda x: x["score"], reverse=True)
    return new_strong


def get_sector_summary(movers_dict, n=3):
    """Group top movers by sector and return top N sectors."""
    from collections import defaultdict
    fund_rows = sb.table("stock_fundamentals").select("ticker, sector").execute().data
    sector_map = {f["ticker"]: f.get("sector", "Unknown") for f in fund_rows}
    sector_movers = defaultdict(list)
    for ticker, data in movers_dict.items():
        sector = sector_map.get(ticker, "Unknown")
        if abs(data["change"]) > 0:
            sector_movers[sector].append(data)
    # Compute avg change per sector
    sector_stats = []
    for sector, items in sector_movers.items():
        avg_change = sum(m["change"] for m in items) / len(items) if items else 0
        top_mover = max(items, key=lambda x: abs(x["change"]))
        sector_stats.append({
            "sector": sector,
            "avg_change": round(avg_change, 1),
            "count": len(items),
            "top_mover": top_mover["ticker"],
            "top_change": top_mover["change"],
        })
    sector_stats.sort(key=lambda x: abs(x["avg_change"]), reverse=True)
    return sector_stats[:n]


def build_html(top_scores, movers, is_pro=True, watchlist_movers=None,
               sector_summary=None, new_strong_buys=None):
    """Build digest HTML email. Free users get limited version.

    Pro/Max users get personalized sections:
    - watchlist_movers: score changes for tickers the user watches
    - sector_summary: top moving sectors
    - new_strong_buys: tickers that flipped to Strong Buy this week
    """
    display_top = top_scores if is_pro else top_scores[:3]
    top_rows = "".join(
        f'<tr><td style="padding:8px;border-bottom:1px solid #eee"><a href="{APP_URL}/company/{s["ticker"]}" style="color:#2563eb;font-weight:600">{s["ticker"]}</a></td>'
        f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:700">{s["score"]}</td>'
        f'<td style="padding:8px;border-bottom:1px solid #eee">{s["verdict"]}</td></tr>'
        for s in display_top
    )

    movers_section = ""
    if is_pro and movers:
        mover_rows = "".join(
            f'<tr><td style="padding:8px;border-bottom:1px solid #eee"><a href="{APP_URL}/company/{m["ticker"]}" style="color:#2563eb;font-weight:600">{m["ticker"]}</a></td>'
            f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center">{m["score"]}</td>'
            f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:{"#22c55e" if m["change"] > 0 else "#ef4444"}">'
            f'{"+" if m["change"] > 0 else ""}{m["change"]}</td></tr>'
            for m in movers
        )
        movers_section = f"""
        <h2 style="font-size:16px;margin:24px 0 12px">Biggest Score Movers</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:#f8fafc"><th style="padding:8px;text-align:left">Ticker</th><th style="padding:8px">Score</th><th style="padding:8px">Change</th></tr>
          {mover_rows}
        </table>
        """

    # Personalized: Your Watchlist Movers
    watchlist_section = ""
    if is_pro and watchlist_movers:
        wl_rows = "".join(
            f'<tr><td style="padding:8px;border-bottom:1px solid #eee"><a href="{APP_URL}/company/{w["ticker"]}" style="color:#2563eb;font-weight:600">{w["ticker"]}</a></td>'
            f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center">{w["score"]}</td>'
            f'<td style="padding:8px;border-bottom:1px solid #eee">{w["verdict"]}</td>'
            f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:{"#22c55e" if w["change"] > 0 else "#ef4444" if w["change"] < 0 else "#64748b"}">'
            f'{"+" if w["change"] > 0 else ""}{w["change"]}</td></tr>'
            for w in watchlist_movers
        )
        watchlist_section = f"""
        <h2 style="font-size:16px;margin:24px 0 12px">Your Watchlist Movers</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:#f8fafc"><th style="padding:8px;text-align:left">Ticker</th><th style="padding:8px">Score</th><th style="padding:8px;text-align:left">Verdict</th><th style="padding:8px">Change</th></tr>
          {wl_rows}
        </table>
        """

    # Sector Summary
    sector_section = ""
    if is_pro and sector_summary:
        sector_rows = "".join(
            f'<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">{s["sector"]}</td>'
            f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:{"#22c55e" if s["avg_change"] > 0 else "#ef4444" if s["avg_change"] < 0 else "#64748b"}">'
            f'{"+" if s["avg_change"] > 0 else ""}{s["avg_change"]}</td>'
            f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center">{s["count"]}</td>'
            f'<td style="padding:8px;border-bottom:1px solid #eee"><a href="{APP_URL}/company/{s["top_mover"]}" style="color:#2563eb">{s["top_mover"]}</a></td></tr>'
            for s in sector_summary
        )
        sector_section = f"""
        <h2 style="font-size:16px;margin:24px 0 12px">Sector Summary</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:#f8fafc"><th style="padding:8px;text-align:left">Sector</th><th style="padding:8px">Avg Change</th><th style="padding:8px">Stocks</th><th style="padding:8px;text-align:left">Top Mover</th></tr>
          {sector_rows}
        </table>
        """

    # New Strong Buy Highlights
    strong_buy_section = ""
    if is_pro and new_strong_buys:
        sb_items = "".join(
            f'<span style="display:inline-block;margin:4px 6px 4px 0;padding:6px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px">'
            f'<a href="{APP_URL}/company/{s["ticker"]}" style="color:#15803d;text-decoration:none;font-weight:600">{s["ticker"]}</a>'
            f' <span style="color:#22c55e;font-size:12px">({s["score"]})</span></span>'
            for s in new_strong_buys[:10]
        )
        strong_buy_section = f"""
        <h2 style="font-size:16px;margin:24px 0 12px">New Strong Buy Ratings</h2>
        <p style="font-size:13px;color:#64748b;margin:0 0 8px">These tickers moved to Strong Buy this week</p>
        <div>{sb_items}</div>
        """

    upgrade_cta = "" if is_pro else """
        <div style="margin:20px 0;padding:16px;background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;text-align:center">
          <p style="margin:0 0 8px;font-size:14px;color:#1e40af;font-weight:600">Upgrade to Pro for the full digest</p>
          <p style="margin:0 0 12px;font-size:12px;color:#64748b">See all top scores, biggest movers, and score alerts</p>
          <a href="{APP_URL}/dashboard" style="display:inline-block;padding:8px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;font-weight:600;font-size:13px">Upgrade Now</a>
        </div>
    """.replace("{APP_URL}", APP_URL)

    return f"""
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;color:#1e293b">
      <div style="padding:24px;background:#2563eb;color:white;text-align:center;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:20px">Equity Value Weekly Digest</h1>
        <p style="margin:4px 0 0;opacity:0.8;font-size:13px">{datetime.now().strftime("%B %d, %Y")}</p>
      </div>
      <div style="padding:24px;background:white;border:1px solid #e2e8f0;border-top:none">
        {watchlist_section}
        <h2 style="font-size:16px;margin:0 0 12px">Top Scoring Stocks</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:#f8fafc"><th style="padding:8px;text-align:left">Ticker</th><th style="padding:8px">EVS</th><th style="padding:8px;text-align:left">Verdict</th></tr>
          {top_rows}
        </table>
        {movers_section}
        {strong_buy_section}
        {sector_section}
        {upgrade_cta}
        <div style="margin-top:24px;text-align:center">
          <a href="{APP_URL}/dashboard" style="display:inline-block;padding:10px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">View Dashboard</a>
        </div>
      </div>
      <div style="padding:16px;text-align:center;font-size:11px;color:#94a3b8">
        Equity Value is an educational tool, not investment advice.<br/>
        <a href="{APP_URL}/unsubscribe" style="color:#94a3b8">Unsubscribe</a>
      </div>
    </div>
    """


def send_digest():
    if not RESEND_API_KEY:
        print("RESEND_API_KEY not set, skipping digest")
        return
    top = get_top_scores()
    movers = get_biggest_movers()
    all_movers = get_all_movers()
    new_strong = get_new_strong_buys()
    sectors = get_sector_summary(all_movers)

    # Pre-build free HTML (no personalization needed)
    free_html = build_html(top, movers, is_pro=False)

    # Get all users with profiles
    users = sb.table("user_profiles").select("id, plan").execute().data
    sent = 0
    for user in users:
        try:
            auth_user = sb.auth.admin.get_user_by_id(user["id"])
            email = auth_user.user.email if auth_user and auth_user.user else None
            if not email:
                continue
            is_pro = user.get("plan", "trial") in ("pro", "lifetime")
            if is_pro:
                # Build personalized watchlist movers for this user
                watchlist_tickers = get_user_watchlist_tickers(user["id"])
                wl_movers = []
                for t in watchlist_tickers:
                    if t in all_movers:
                        wl_movers.append(all_movers[t])
                # Sort by absolute change descending
                wl_movers.sort(key=lambda x: abs(x["change"]), reverse=True)
                html = build_html(top, movers, is_pro=True,
                                  watchlist_movers=wl_movers if wl_movers else None,
                                  sector_summary=sectors,
                                  new_strong_buys=new_strong if new_strong else None)
            else:
                html = free_html
            requests.post("https://api.resend.com/emails", json={
                "from": FROM_EMAIL,
                "to": email,
                "subject": f"Weekly Digest: Top EVS Scores | {datetime.now().strftime('%b %d')}",
                "html": html,
            }, headers={"Authorization": f"Bearer {RESEND_API_KEY}"})
            sent += 1
        except Exception as e:
            print(f"  EMAIL ERROR {user['id']}: {e}")
    print(f"Sent {sent} digest emails")


if __name__ == "__main__":
    send_digest()
