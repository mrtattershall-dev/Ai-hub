import config
assert config.get("b") == 2, config.get("b")
assert config.get("c") == 3, config.get("c")
assert config.get("a") == 1, "the existing setting must be unchanged"
print("OK")
