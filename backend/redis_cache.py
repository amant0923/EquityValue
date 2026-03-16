"""Unified cache layer: Upstash Redis when configured, in-memory dict fallback.

Env vars:
  UPSTASH_REDIS_URL   – Upstash REST URL (e.g. https://xxx.upstash.io)
  UPSTASH_REDIS_TOKEN  – Upstash REST token

If either is missing the module silently falls back to a local dict with LRU
eviction, preserving the exact behaviour the app had before.
"""

import json
import os
import time

# ── Configuration ────────────────────────────────────────────────────────────
UPSTASH_URL = os.environ.get("UPSTASH_REDIS_URL", "")
UPSTASH_TOKEN = os.environ.get("UPSTASH_REDIS_TOKEN", "")
CACHE_TTL = 3600   # 1 hour default
CACHE_MAX = 2000   # max in-memory entries

# ── Try to initialise Upstash Redis ──────────────────────────────────────────
_redis = None
if UPSTASH_URL and UPSTASH_TOKEN:
    try:
        from upstash_redis import Redis
        _redis = Redis(url=UPSTASH_URL, token=UPSTASH_TOKEN)
        print("[cache] Using Upstash Redis")
    except Exception as e:
        print(f"[cache] Upstash init failed, falling back to in-memory: {e}")
        _redis = None
else:
    print("[cache] No UPSTASH_REDIS_URL/TOKEN — using in-memory cache")

# ── In-memory fallback ───────────────────────────────────────────────────────
_mem_cache: dict = {}


def cache_get(key: str):
    """Return cached value or None."""
    if _redis is not None:
        try:
            raw = _redis.get(key)
            if raw is None:
                return None
            # upstash-redis may return already-decoded str or dict
            if isinstance(raw, str):
                return json.loads(raw)
            return raw
        except Exception as e:
            print(f"[cache get] redis error: {e}")
            return None

    # In-memory path
    entry = _mem_cache.get(key)
    if entry and (time.time() - entry["ts"]) < CACHE_TTL:
        return entry["data"]
    return None


def cache_set(key: str, data, ttl: int = CACHE_TTL):
    """Store a value in the cache."""
    if _redis is not None:
        try:
            _redis.set(key, json.dumps(data, default=str), ex=ttl)
            return
        except Exception as e:
            print(f"[cache set] redis error: {e}")
            return

    # In-memory path with LRU eviction
    if len(_mem_cache) >= CACHE_MAX:
        oldest = min(_mem_cache, key=lambda k: _mem_cache[k]["ts"])
        del _mem_cache[oldest]
    _mem_cache[key] = {"data": data, "ts": time.time()}


def cache_clear():
    """Flush all cached entries."""
    if _redis is not None:
        try:
            _redis.flushdb()
            return
        except Exception as e:
            print(f"[cache clear] redis error: {e}")
            return
    _mem_cache.clear()
