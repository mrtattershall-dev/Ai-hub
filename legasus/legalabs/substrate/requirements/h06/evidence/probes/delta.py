import rates
assert rates.SCALED == 200, rates.SCALED
assert rates.scaled() == 200, rates.scaled()
assert rates.apply_rate(1) == 100, "the existing helper must be unchanged"
print("OK")
