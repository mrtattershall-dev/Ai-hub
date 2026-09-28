import config
r = config.parse_config("a = one...\ntwo")
assert r == {"a": "onetwo"}, r
r2 = config.parse_config("x = 1\nb = left...\nright\ny = 2")
assert r2 == {"x": "1", "b": "leftright", "y": "2"}, r2
assert config.parse_config("k = plain") == {"k": "plain"}
print("OK")
