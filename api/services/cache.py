"""Simple in-memory TTL cache for expensive BigQuery results."""
from __future__ import annotations
import time
import functools
from typing import Any

_store: dict[str, tuple[float, Any]] = {}


def ttl_cache(seconds: int = 600):
    """Decorator: cache function result for `seconds`. Key = func name + args."""
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            key = f"{fn.__qualname__}:{args[1:]}:{kwargs}"
            entry = _store.get(key)
            if entry and time.monotonic() - entry[0] < seconds:
                return entry[1]
            result = fn(*args, **kwargs)
            _store[key] = (time.monotonic(), result)
            return result
        return wrapper
    return decorator
