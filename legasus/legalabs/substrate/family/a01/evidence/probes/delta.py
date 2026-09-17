import tally
t = tally.Tally()
t.add_weighted("a", 5); t.add_weighted("a", 2); t.add_weighted("b", 1)
assert t.weighted_count("a") == 7, t.weighted_count("a")
assert t.weighted_count("z") == 0
assert t.weighted_total() == 8, t.weighted_total()
t.add("a")
assert t.count("a") == 1, t.count("a")
assert t.weighted_count("a") == 7, "plain and weighted must stay separate"
print("OK")
