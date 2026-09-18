import stepping
assert stepping.DOUBLE == 8, stepping.DOUBLE
assert stepping.doubled() == 8, stepping.doubled()
assert stepping.step() == 4, "the existing helper must be unchanged"
print("OK")
