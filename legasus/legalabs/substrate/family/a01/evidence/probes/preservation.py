import tally
t = tally.Tally()
t.add("a"); t.add("a"); t.add("b")
assert t.count("a") == 2, t.count("a")
assert t.count("z") == 0
assert t.total() == 3, t.total()
print("OK")
