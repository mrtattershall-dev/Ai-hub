import temps
assert temps.to_f(100) == 212.0, temps.to_f(100)
assert temps.to_c(32) == 0.0, temps.to_c(32)
assert temps.floor_c(-500) == -273.15, temps.floor_c(-500)
assert temps.floor_c(20) == 20
print("OK")
