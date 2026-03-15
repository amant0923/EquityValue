from collections import defaultdict


def compute_sector_percentiles(scores: list[dict]) -> list[dict]:
    """Compute sector rank and percentile for each ticker.

    Args:
        scores: list of dicts with ticker, score, sector

    Returns:
        Same list enriched with sector_rank, sector_percentile, sector_total
    """
    by_sector = defaultdict(list)
    for s in scores:
        by_sector[s["sector"]].append(s)

    for sector, tickers in by_sector.items():
        sorted_tickers = sorted(tickers, key=lambda x: x["score"], reverse=True)
        total = len(sorted_tickers)
        for rank, t in enumerate(sorted_tickers, 1):
            t["sector_rank"] = rank
            t["sector_total"] = total
            t["sector_percentile"] = round((total - rank + 1) / total * 100, 1)

    return scores


def get_peer_context(ticker: str, scores: list[dict]) -> dict:
    """Get peer comparison context for a ticker (same industry).

    Returns dict with peer_group, peer_rank, peer_avg_score, peer_spread.
    """
    target = next((s for s in scores if s["ticker"] == ticker), None)
    if not target:
        return {"peer_group": [], "peer_rank": 0, "peer_avg_score": 0, "peer_spread": 0}

    industry = target.get("industry", "")
    peers = [s for s in scores if s.get("industry") == industry]
    peers_sorted = sorted(peers, key=lambda x: x["score"], reverse=True)

    avg = sum(p["score"] for p in peers) / len(peers) if peers else 0
    rank = next((i + 1 for i, p in enumerate(peers_sorted) if p["ticker"] == ticker), 0)

    return {
        "peer_group": [{"ticker": p["ticker"], "score": p["score"]} for p in peers_sorted],
        "peer_rank": rank,
        "peer_avg_score": round(avg, 1),
        "peer_spread": round(target["score"] - avg, 1),
    }


def get_sector_summaries(scores: list[dict]) -> list[dict]:
    """Compute summary stats per sector.

    Returns list of dicts: sector, avg_score, top_ticker, count, buy_count, sell_count
    """
    by_sector = defaultdict(list)
    for s in scores:
        by_sector[s["sector"]].append(s)

    summaries = []
    for sector, tickers in sorted(by_sector.items()):
        sorted_t = sorted(tickers, key=lambda x: x["score"], reverse=True)
        avg = sum(t["score"] for t in tickers) / len(tickers)
        buy_count = sum(1 for t in tickers if t["score"] >= 60)
        sell_count = sum(1 for t in tickers if t["score"] < 40)
        summaries.append({
            "sector": sector,
            "avg_score": round(avg, 1),
            "top_ticker": sorted_t[0]["ticker"],
            "top_score": sorted_t[0]["score"],
            "count": len(tickers),
            "buy_count": buy_count,
            "sell_count": sell_count,
        })

    return summaries
