import formatting
assert formatting.WIDTH == 8
assert formatting.pad("ab") == "ab      ", repr(formatting.pad("ab"))
assert formatting.trim("  a ") == "a", formatting.trim("  a ")
print("OK")
