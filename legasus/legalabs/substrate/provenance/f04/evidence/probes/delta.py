import temps
assert temps.extremes() is None, "nothing recorded yet"
assert temps.record_c(5) == 5, temps.record_c(5)
temps.record_c(-2); temps.record_c(9)
assert temps.extremes() == (-2, 9), temps.extremes()
assert temps.to_f(0) == 32.0, "the existing helpers must be unchanged"
print("OK")
