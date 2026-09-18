import palette
assert palette.COLORS == ["red", "green"], palette.COLORS
assert palette.DEFAULT == "red"
assert palette.known("green")
assert not palette.known("blue")
print("OK")
