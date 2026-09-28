import geolocalconst
assert abs(geolocalconst.TAU - 6.2832) < 0.001, geolocalconst.TAU
assert abs(geolocalconst.tau() - 6.2832) < 0.001, geolocalconst.tau()
assert geolocalconst.box() == 12, "the existing helpers must be unchanged"
print("OK")
