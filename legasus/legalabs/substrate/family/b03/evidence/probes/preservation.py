import scan
assert scan.tokens("12 + 7") == [("num", "12"), ("sym", "+"), ("num", "7")], scan.tokens("12 + 7")
assert scan.tokens("") == []
assert scan.tokens("   ") == []
print("OK")
