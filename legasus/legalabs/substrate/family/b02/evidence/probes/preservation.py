import config
r = config.parse_config("a = 1\n\n# note\nb = two")
assert r == {"a": "1", "b": "two"}, r
assert config.parse_config("") == {}
assert config.parse_config("# only a comment") == {}
print("OK")
