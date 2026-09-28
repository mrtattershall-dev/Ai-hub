import tokens
r = tokens.split_tokens('a "b c" d')
assert r == ["a", "b c", "d"], r
u = tokens.split_tokens('a "b c')
assert u == ["a", "b c"], u
assert tokens.split_tokens("x y") == ["x", "y"], "unquoted input is unchanged"
print("OK")
