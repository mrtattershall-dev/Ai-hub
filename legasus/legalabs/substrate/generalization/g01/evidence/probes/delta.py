import counter
c = counter.Counter()
assert c.rare_count() == 0, c.rare_count()
c.mark_rare(" Xy "); c.mark_rare("xy"); c.mark_rare("q")
assert c.rare_count() == 2, c.rare_count()
assert c.is_rare("XY")
assert not c.is_rare("zz")
c.scan(["a", "a"])
assert c.rare_count() == 2, "the two stores must stay separate"
assert c.seen_count("a") == 2
print("OK")
