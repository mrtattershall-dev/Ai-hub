import tokens
assert tokens.split_tokens("a b  c") == ["a", "b", "c"], tokens.split_tokens("a b  c")
assert tokens.split_tokens("") == []
assert tokens.split_tokens("  solo  ") == ["solo"]
print("OK")
