import geolocalconst
assert geolocalconst.WIDTH == 4 and geolocalconst.HEIGHT == 3 and geolocalconst.RADIUS == 2
assert abs(geolocalconst.area() - 12.566) < 0.01, geolocalconst.area()
assert geolocalconst.box() == 12, geolocalconst.box()
print("OK")
