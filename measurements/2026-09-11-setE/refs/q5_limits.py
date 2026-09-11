# Reference solution (final state of chain q5) - used only to prove checks-E.mjs can pass.
import functools
import time


class RateLimited(Exception):
    pass


def _pos(x, name):
    if isinstance(x, bool) or not isinstance(x, (int, float)) or x <= 0:
        raise ValueError(f"{name} must be a positive number")


class TokenBucket:
    def __init__(self, capacity, refill_per_sec, now=time.monotonic):
        _pos(capacity, "capacity")
        _pos(refill_per_sec, "refill_per_sec")
        self.capacity = capacity
        self.rate = refill_per_sec
        self._now = now
        self._tokens = float(capacity)
        self._t = now()

    def _refill(self):
        t = self._now()
        self._tokens = min(self.capacity, self._tokens + (t - self._t) * self.rate)
        self._t = t

    def tokens(self):
        self._refill()
        return self._tokens

    def allow(self, cost=1):
        _pos(cost, "cost")
        self._refill()
        if self._tokens + 1e-9 >= cost:
            self._tokens -= cost
            return True
        return False

    def wait_time(self, cost=1):
        _pos(cost, "cost")
        if cost > self.capacity:
            raise ValueError("cost is larger than the capacity")
        self._refill()
        need = cost - self._tokens
        return 0.0 if need <= 1e-9 else need / self.rate


class SlidingWindow:
    def __init__(self, limit, window_sec, now=time.monotonic):
        if isinstance(limit, bool) or not isinstance(limit, int) or limit <= 0:
            raise ValueError("limit must be a positive integer")
        _pos(window_sec, "window_sec")
        self.limit = limit
        self.window = window_sec
        self._now = now
        self._calls = []

    def allow(self, cost=1):
        _pos(cost, "cost")
        t = self._now()
        self._calls = [c for c in self._calls if c > t - self.window]
        if len(self._calls) + cost > self.limit:
            return False
        self._calls.extend([t] * int(cost))
        return True


class KeyedLimiter:
    def __init__(self, factory):
        self.factory = factory
        self._limiters = {}
        self._stats = {}

    def allow(self, key, *args, **kwargs):
        if key not in self._limiters:
            self._limiters[key] = self.factory()
        ok = self._limiters[key].allow(*args, **kwargs)
        s = self._stats.setdefault(key, {"allowed": 0, "denied": 0})
        s["allowed" if ok else "denied"] += 1
        return ok

    def keys(self):
        return sorted(self._limiters)

    def reset(self, key):
        self._limiters.pop(key, None)

    def stats(self):
        return {k: dict(v) for k, v in self._stats.items()}


def limited(limiter):
    def deco(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            if not limiter.allow():
                raise RateLimited(fn.__name__)
            return fn(*args, **kwargs)
        return wrapper
    return deco
