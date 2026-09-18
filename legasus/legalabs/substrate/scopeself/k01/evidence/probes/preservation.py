import cache
c = cache.Cache()
c._store["a"] = 1
assert c.get("a") == 1, c.get("a")
assert c.get("zz") is None
print("OK")
