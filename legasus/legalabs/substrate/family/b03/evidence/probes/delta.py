import scan
assert scan.tokens("1 (* c *) 2") == [("num", "1"), ("num", "2")], scan.tokens("1 (* c *) 2")
assert scan.tokens("1 (* a (* b *) c *) 2") == [("num", "1"), ("num", "2")], scan.tokens("1 (* a (* b *) c *) 2")
assert scan.tokens("(* only *)") == []
assert scan.tokens("5") == [("num", "5")]
try:
    scan.tokens("1 (* never closed")
    raise AssertionError("an unclosed comment must raise")
except ValueError:
    pass
print("OK")
