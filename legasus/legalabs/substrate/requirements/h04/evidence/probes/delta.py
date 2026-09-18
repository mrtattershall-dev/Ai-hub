import border
assert border.star(2) == "**", border.star(2)
assert border.star_thick() == "***", border.star_thick()
assert border.line(1) == "-", "the existing helper must be unchanged"
print("OK")
