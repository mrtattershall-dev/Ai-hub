import patterns
assert patterns.TOTAL == 2, patterns.TOTAL
assert patterns.first() == "a[b", patterns.first()
assert patterns.described() == "see ] here2", patterns.described()
assert patterns.size() == 2, "the existing helper must be unchanged"
print("OK")
