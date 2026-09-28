import shapes
assert shapes.valid_kinds(["circle", "square"])
assert not shapes.valid_kinds(["blob"])
assert shapes.describe("circle") == "round shape", shapes.describe("circle")
assert shapes.area({"kind": "square", "side": 3}) == 9, shapes.area({"kind": "square", "side": 3})
assert abs(shapes.area({"kind": "circle", "r": 1}) - 3.14159) < 1e-9
assert shapes.area({"kind": "blob"}) == 0
print("OK")
