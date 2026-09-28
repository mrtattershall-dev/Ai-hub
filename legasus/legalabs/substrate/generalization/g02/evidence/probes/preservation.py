import units
assert units.to_cm(1) == 2.54, units.to_cm(1)
assert abs(units.to_inches(2.54) - 1) < 1e-9
assert units.round_cm(1) == 2.5, units.round_cm(1)
print("OK")
