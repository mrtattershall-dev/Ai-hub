import grades
g = grades.Grades()
g.record("ann", 3); g.record("ann", 4); g.record("bo", 5)
assert g.score_of("ann") == 7, g.score_of("ann")
assert g.score_of("zed") == 0
assert g.best() == "ann", g.best()
assert grades.Grades().best() is None
print("OK")
