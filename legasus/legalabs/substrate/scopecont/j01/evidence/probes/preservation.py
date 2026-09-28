import router
r = router.Router()
r.add("/a", "A")
assert r.resolve("/a") == "A", r.resolve("/a")
assert r.resolve("/zz") is None
print("OK")
