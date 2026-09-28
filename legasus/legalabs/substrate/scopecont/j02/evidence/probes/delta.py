import aggregation
assert aggregation.SCALE == 2
assert aggregation.summarize(["1", "2"]) == 6, aggregation.summarize(["1", "2"])
assert aggregation.scaled_count([1, 2]) == 4, aggregation.scaled_count([1, 2])
assert aggregation.count([1, 2]) == 2, "the existing helper must be unchanged"
print("OK")
