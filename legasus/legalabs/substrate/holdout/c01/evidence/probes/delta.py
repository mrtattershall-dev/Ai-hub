import roster
r = roster.Roster()
r.wait("a"); r.wait("a"); r.wait("b")
assert r.waiting_count() == 2, r.waiting_count()
assert r.is_waiting("a")
assert not r.is_waiting("z")
r.join("c")
assert r.active_count() == 1, r.active_count()
assert r.waiting_count() == 2, "the two lists must stay separate"
assert not r.is_waiting("c")
print("OK")
