import csvfmt
assert csvfmt.valid_types(["date"]), "date must be a valid type"
assert csvfmt.label("date") == "date", csvfmt.label("date")
row = csvfmt.format_row([(2026, 9, 5)], ["date"])
assert row == "2026-09-05", row
mixed = csvfmt.format_row(["x", (2026, 12, 31)], ["plain", "date"])
assert mixed == "x,2026-12-31", mixed
print("OK")
