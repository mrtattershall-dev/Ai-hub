# Reference solution (final state of chain r5) - used only to prove checks-D.mjs can pass.
import json
import time

_MISSING = object()


class Store:
    def __init__(self, max_keys=None, now=time.time):
        self._data = {}
        self._tx = []
        self._now = now
        self._max = max_keys
        self._stats = {"sets": 0, "gets": 0, "hits": 0}

    def _live(self, key):
        e = self._data.get(key, _MISSING)
        if e is _MISSING:
            return _MISSING
        if e[1] is not None and self._now() >= e[1]:
            return _MISSING
        return e

    def _record(self, key):
        if self._tx:
            self._tx[-1].append((key, self._data.get(key, _MISSING)))

    def set(self, key, value, ttl=None):
        if self._max is not None and self._live(key) is _MISSING and len(self) >= self._max:
            raise OverflowError("store is full")
        self._record(key)
        self._data[key] = (value, None if ttl is None else self._now() + ttl)
        self._stats["sets"] += 1

    def get(self, key, default=None):
        self._stats["gets"] += 1
        e = self._live(key)
        if e is _MISSING:
            return default
        self._stats["hits"] += 1
        return e[0]

    def delete(self, key):
        if self._live(key) is _MISSING:
            return False
        self._record(key)
        del self._data[key]
        return True

    def keys(self):
        return sorted(k for k in self._data if self._live(k) is not _MISSING)

    def begin(self):
        self._tx.append([])

    def commit(self):
        if not self._tx:
            raise RuntimeError("no transaction")
        log = self._tx.pop()
        if self._tx:
            self._tx[-1].extend(log)

    def rollback(self):
        if not self._tx:
            raise RuntimeError("no transaction")
        for key, prev in reversed(self._tx.pop()):
            if prev is _MISSING:
                self._data.pop(key, None)
            else:
                self._data[key] = prev

    def count_prefix(self, prefix):
        return sum(1 for k in self.keys() if k.startswith(prefix))

    def items(self, prefix=""):
        return [(k, self._data[k][0]) for k in self.keys() if k.startswith(prefix)]

    def save(self, path):
        if self._tx:
            raise RuntimeError("cannot save during a transaction")
        with open(path, "w", encoding="utf-8") as f:
            json.dump({k: [v, exp] for k, (v, exp) in self._data.items()}, f)

    @classmethod
    def load(cls, path, now=time.time):
        s = cls(now=now)
        with open(path, encoding="utf-8") as f:
            for k, (v, exp) in json.load(f).items():
                s._data[k] = (v, exp)
        return s

    def incr(self, key, by=1):
        e = self._live(key)
        cur = 0 if e is _MISSING else e[0]
        if not isinstance(cur, int):
            raise TypeError("value is not an int")
        self.set(key, cur + by)
        return cur + by

    def stats(self):
        return {"keys": len(self), **self._stats}

    def __contains__(self, key):
        return self._live(key) is not _MISSING

    def __len__(self):
        return len(self.keys())
