"""Automated Twitter/X posts for weekly top/bottom EVS movers.

Usage: python twitter_bot.py
Requires: TWITTER_BEARER_TOKEN, TWITTER_API_KEY, TWITTER_API_SECRET,
          TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET env vars.

Uses Twitter API v2 via requests (no tweepy dependency).
Runs weekly via GitHub Actions after the digest.
"""
import os
import sys
import json
import hmac
import hashlib
import time
import base64
import urllib.parse
import requests
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", os.environ.get("SUPABASE_KEY", ""))
TWITTER_API_KEY = os.environ.get("TWITTER_API_KEY", "")
TWITTER_API_SECRET = os.environ.get("TWITTER_API_SECRET", "")
TWITTER_ACCESS_TOKEN = os.environ.get("TWITTER_ACCESS_TOKEN", "")
TWITTER_ACCESS_SECRET = os.environ.get("TWITTER_ACCESS_SECRET", "")
APP_URL = "https://equityvalue.ai"


def get_supabase():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Supabase not configured")
        return None
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_weekly_movers(sb, n=5):
    """Get stocks with largest score changes this week."""
    week_ago = (datetime.now(timezone.utc).date() - timedelta(days=7)).isoformat()
    current = {r["ticker"]: r for r in
               sb.table("equity_value_scores").select("ticker, score, verdict").execute().data or []}
    prev = {}
    prev_rows = sb.table("equity_value_score_history").select("ticker, score") \
        .gte("computed_at", week_ago).execute().data or []
    for r in prev_rows:
        prev[r["ticker"]] = r["score"]
    movers = []
    for ticker, data in current.items():
        prev_score = prev.get(ticker)
        if prev_score is not None:
            change = data["score"] - prev_score
            movers.append({
                "ticker": ticker, "score": data["score"],
                "verdict": data["verdict"], "change": change,
            })
    movers.sort(key=lambda x: x["change"], reverse=True)
    top = movers[:n]
    bottom = movers[-n:][::-1]
    return top, bottom


def format_tweet_top(movers):
    """Format top movers tweet."""
    lines = ["📈 Weekly EVS Top Movers (S&P 500)\n"]
    for i, m in enumerate(movers, 1):
        arrow = "🟢" if m["change"] > 0 else "🔴"
        lines.append(f"{arrow} ${m['ticker']}: {m['score']} EVS ({'+' if m['change'] > 0 else ''}{m['change']}) — {m['verdict']}")
    lines.append(f"\nFull rankings: {APP_URL}/screener")
    lines.append("#stocks #investing #valuation #SP500")
    return "\n".join(lines)


def format_tweet_bottom(movers):
    """Format bottom movers tweet."""
    lines = ["📉 Weekly EVS Biggest Declines (S&P 500)\n"]
    for i, m in enumerate(movers, 1):
        lines.append(f"🔴 ${m['ticker']}: {m['score']} EVS ({m['change']}) — {m['verdict']}")
    lines.append(f"\nFull rankings: {APP_URL}/screener")
    lines.append("#stocks #investing #valuation #SP500")
    return "\n".join(lines)


def oauth1_header(method, url, params=None):
    """Generate OAuth 1.0a header for Twitter API v2."""
    oauth_params = {
        "oauth_consumer_key": TWITTER_API_KEY,
        "oauth_nonce": base64.b64encode(os.urandom(32)).decode("ascii").strip("=+/"),
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": str(int(time.time())),
        "oauth_token": TWITTER_ACCESS_TOKEN,
        "oauth_version": "1.0",
    }
    all_params = {**oauth_params}
    if params:
        all_params.update(params)
    sorted_params = "&".join(f"{urllib.parse.quote(k, '')}={urllib.parse.quote(str(v), '')}"
                             for k, v in sorted(all_params.items()))
    base_string = f"{method.upper()}&{urllib.parse.quote(url, '')}&{urllib.parse.quote(sorted_params, '')}"
    signing_key = f"{urllib.parse.quote(TWITTER_API_SECRET, '')}&{urllib.parse.quote(TWITTER_ACCESS_SECRET, '')}"
    signature = base64.b64encode(
        hmac.new(signing_key.encode(), base_string.encode(), hashlib.sha1).digest()
    ).decode()
    oauth_params["oauth_signature"] = signature
    auth_header = "OAuth " + ", ".join(
        f'{urllib.parse.quote(k, "")}="{urllib.parse.quote(v, "")}"'
        for k, v in sorted(oauth_params.items())
    )
    return auth_header


def post_tweet(text):
    """Post a tweet using Twitter API v2."""
    if not all([TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET]):
        print(f"Twitter not configured. Would post:\n{text}")
        return False
    url = "https://api.twitter.com/2/tweets"
    auth = oauth1_header("POST", url)
    resp = requests.post(url, json={"text": text}, headers={
        "Authorization": auth,
        "Content-Type": "application/json",
    })
    if resp.status_code in (200, 201):
        print(f"Tweet posted: {resp.json().get('data', {}).get('id', 'unknown')}")
        return True
    else:
        print(f"Tweet failed ({resp.status_code}): {resp.text}")
        return False


def main():
    sb = get_supabase()
    if not sb:
        return
    top, bottom = get_weekly_movers(sb)
    if top:
        tweet = format_tweet_top(top)
        print(f"--- Top movers tweet ---\n{tweet}\n")
        post_tweet(tweet)
    if bottom:
        tweet = format_tweet_bottom(bottom)
        print(f"--- Bottom movers tweet ---\n{tweet}\n")
        post_tweet(tweet)
    print("Done")


if __name__ == "__main__":
    main()
