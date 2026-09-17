import session
s = session.Session()
s.record_hit("a"); s.record_hit("a"); s.record_hit("b")
assert s.hit_count("a") == 2, s.hit_count("a")
assert s.hit_count("z") == 0
assert s.total_hits() == 3, s.total_hits()
s.add_name("ann")
assert s.name_count() == 1, s.name_count()
print("OK")
