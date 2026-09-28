import running
assert running.TOTAL == 6, running.TOTAL
assert running.bumped() == 6, running.bumped()
assert running.total() == 6, "the accessor reads the same name"
print("OK")
