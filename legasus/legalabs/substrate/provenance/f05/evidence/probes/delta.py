import colors
assert colors.lookup("brand") is None, "nothing recorded yet"
assert colors.name_color("brand", "#123456") == "#123456"
colors.name_color("accent", "#abcdef")
assert colors.lookup("brand") == "#123456", colors.lookup("brand")
assert colors.lookup("accent") == "#abcdef"
assert colors.lookup("missing") is None
assert colors.is_dark("#000000"), "the existing helpers must be unchanged"
print("OK")
