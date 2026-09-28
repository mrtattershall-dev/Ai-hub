import roster
r = roster.Roster()
r.join("a"); r.join("a"); r.join("b")
assert r.active_count() == 2, r.active_count()
assert r.is_active("a")
assert not r.is_active("z")
print("OK")
