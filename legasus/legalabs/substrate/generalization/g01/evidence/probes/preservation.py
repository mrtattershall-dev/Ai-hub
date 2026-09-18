import counter
c = counter.Counter()
assert c.scan([" A ", "a", "", "b"]) == 2, c.scan([" A ", "a", "", "b"])
assert c.seen_count("A") == 2, c.seen_count("A")
assert c.seen_count("zz") == 0
print("OK")
