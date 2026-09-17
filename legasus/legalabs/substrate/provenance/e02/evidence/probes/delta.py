import session
s = session.Session()
assert s.role_count() == 0, s.role_count()
s.add_role("admin"); s.add_role("editor")
assert s.role_count() == 2, s.role_count()
assert s.has_role("admin")
assert not s.has_role("guest")
s.add_name("ann")
assert s.role_count() == 2, "the two lists must stay separate"
assert not s.has_role("ann")
print("OK")
