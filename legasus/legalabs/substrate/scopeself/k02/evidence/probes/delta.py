import statistics
assert statistics.TOTAL == 6, statistics.TOTAL
assert statistics.total() == 6, statistics.total()
assert statistics.size() == 3, "the existing helper must be unchanged"
print("OK")
