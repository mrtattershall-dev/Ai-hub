import library
b = library.Library()
b.borrow("dune", 2); b.borrow("dune", 1); b.borrow("emma", 4)
assert b.borrowed_count("dune") == 3, b.borrowed_count("dune")
assert b.borrowed_count("zzz") == 0
assert b.total_borrowed() == 7, b.total_borrowed()
print("OK")
