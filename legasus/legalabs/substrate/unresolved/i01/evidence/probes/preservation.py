import geoconst
assert geoconst.WIDTH == 4 and geoconst.HEIGHT == 3 and geoconst.RADIUS == 2
assert abs(geoconst.area() - 12.566) < 0.01, geoconst.area()
assert geoconst.box() == 12, geoconst.box()
print("OK")
