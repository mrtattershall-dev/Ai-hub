import geolocal
assert geolocal.TAU == 6.28, geolocal.TAU
assert geolocal.tau() == 6.28, geolocal.tau()
assert abs(geolocal.area() - 12.566) < 0.01, "the existing helper must be unchanged"
print("OK")
