import csvfmt
assert csvfmt.valid_types(["plain", "quoted"])
assert not csvfmt.valid_types(["nope"])
assert csvfmt.label("plain") == "text"
assert csvfmt.label("nope") == "unknown"
row = csvfmt.format_row(["a", "b,c"], ["plain", "quoted"])
assert row == 'a,"b,c"', row
print("OK")
