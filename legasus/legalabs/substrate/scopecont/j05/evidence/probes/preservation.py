import patterns
assert patterns.PATTERNS == ["a[b", "c)d"], patterns.PATTERNS
assert patterns.LABEL == "see ] here", patterns.LABEL
assert patterns.size() == 2, patterns.size()
print("OK")
