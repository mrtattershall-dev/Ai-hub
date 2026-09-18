import classify
assert classify.classify(-5) == "negative", classify.classify(-5)
assert classify.classify(0) == "zero"
assert classify.classify(50) == "positive", classify.classify(50)
print("OK")
