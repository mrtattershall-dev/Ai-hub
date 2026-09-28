import cache
c = cache.Cache()
c._defaults["b"] = 9
assert c.get("b") == 9, c.get("b")
c._store["a"] = 1
assert c.get("a") == 1, "direct hits must be unchanged"
assert c.get("zz") is None
print("OK")
