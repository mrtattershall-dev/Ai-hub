import paths
assert paths.clean("  /a/b/  ") == "a/b", paths.clean("  /a/b/  ")
assert paths.join_path("/a/", "/b/") == "a/b", paths.join_path("/a/", "/b/")
assert paths.join_path("", "b") == "b"
assert paths.depth("a/b/c") == 3, paths.depth("a/b/c")
assert paths.depth("") == 0
print("OK")
