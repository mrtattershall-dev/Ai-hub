import classify
assert classify.classify(3) == "small", classify.classify(3)
assert classify.classify(50) == "positive", classify.classify(50)
assert classify.classify(0) == "zero", "zero must still win over small"
assert classify.is_small(3)
assert not classify.is_small(50)
print("OK")
