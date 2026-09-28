import geolocal
assert geolocal.RADIUS == 2
assert abs(geolocal.area() - 12.566) < 0.01, geolocal.area()
print("OK")
