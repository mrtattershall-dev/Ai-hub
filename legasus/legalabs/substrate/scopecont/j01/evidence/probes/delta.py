import router
r = router.Router()
r.add("/a", "A")
r.alias("/b", "/a")
assert r.resolve("/b") == "A", r.resolve("/b")
assert r.resolve("/a") == "A", "direct resolution must be unchanged"
assert r.resolve("/zz") is None
print("OK")
