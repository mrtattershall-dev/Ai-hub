import palette
assert palette.pick("green") == "green", palette.pick("green")
assert palette.pick("blue") == "red", palette.pick("blue")
assert palette.safe("blue")
assert not palette.safe("green")
assert palette.known("red"), "the existing helper must be unchanged"
print("OK")
