import library
b = library.Library()
assert b.total_reserved() == 0, b.total_reserved()
b.reserve("dune", 2); b.reserve("dune", 3); b.reserve("emma", 1)
assert b.reserved_count("dune") == 5, b.reserved_count("dune")
assert b.reserved_count("zzz") == 0
assert b.total_reserved() == 6, b.total_reserved()
b.borrow("dune", 1)
assert b.reserved_count("dune") == 5, "borrowing and reserving must stay separate"
print("OK")
