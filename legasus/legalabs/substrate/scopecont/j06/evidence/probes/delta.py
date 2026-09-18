import nested
assert nested.DOUBLE == 6, nested.DOUBLE
assert nested.double() == 6, nested.double()
assert nested.base() == 3, "the existing helper must be unchanged"
print("OK")
