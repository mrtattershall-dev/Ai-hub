import paths
assert paths.MAX_HOPS == 16, paths.MAX_HOPS
assert paths.resolve({"a": "b", "b": "c"}, "a") == "c", paths.resolve({"a": "b", "b": "c"}, "a")
assert paths.resolve({}, "solo") == "solo"
try:
    paths.resolve({"a": "b", "b": "a"}, "a")
    raise AssertionError("a cycle must raise PathCycle")
except paths.PathCycle:
    pass
assert paths.resolve_all({"a": "b"}, ["a", "z"]) == ["b", "z"], paths.resolve_all({"a": "b"}, ["a", "z"])
assert paths.depth("a/b") == 2, "the existing helpers must be unchanged"
print("OK")
