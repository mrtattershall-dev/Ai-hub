import config
assert config.get("a") == 1, config.get("a")
assert config.get("zz") is None
assert "a" in config.names(), config.names()
print("OK")
