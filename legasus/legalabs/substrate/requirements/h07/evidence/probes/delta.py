import geometry
assert geometry.TAU == 6.28, geometry.TAU
assert geometry.tau() == 6.28, geometry.tau()
assert abs(geometry.area() - 12.566) < 0.01, "the existing helper must be unchanged"
print("OK")
