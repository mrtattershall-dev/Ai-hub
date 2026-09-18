import geoconst
assert abs(geoconst.TAU - 6.2832) < 0.001, geoconst.TAU
assert abs(geoconst.tau() - 6.2832) < 0.001, geoconst.tau()
assert geoconst.box() == 12, "the existing helpers must be unchanged"
print("OK")
