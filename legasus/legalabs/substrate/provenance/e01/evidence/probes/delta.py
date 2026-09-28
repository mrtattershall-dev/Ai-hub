import shapes
assert shapes.valid_kinds(["rect"]), "the new kind must be admitted"
assert shapes.describe("rect") == "four right angles", shapes.describe("rect")
assert shapes.area({"kind": "rect", "w": 2, "h": 3}) == 6, shapes.area({"kind": "rect", "w": 2, "h": 3})
assert shapes.area({"kind": "rect"}) == 0
assert shapes.area({"kind": "square", "side": 3}) == 9, "existing kinds unchanged"
print("OK")
