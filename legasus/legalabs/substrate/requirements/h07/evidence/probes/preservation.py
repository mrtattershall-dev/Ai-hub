import geometry
assert geometry.RADIUS == 2
assert abs(geometry.area() - 12.566) < 0.01, geometry.area()
print("OK")
