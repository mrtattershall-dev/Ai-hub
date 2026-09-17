import grades
g = grades.Grades()
assert g.most_attempts() is None, "nothing recorded yet"
g.record_attempt("ann", 2); g.record_attempt("ann", 1); g.record_attempt("bo", 5)
assert g.attempts_of("ann") == 3, g.attempts_of("ann")
assert g.attempts_of("zed") == 0
assert g.most_attempts() == "bo", g.most_attempts()
g.record("ann", 9)
assert g.attempts_of("ann") == 3, "scores and attempts must stay separate"
print("OK")
