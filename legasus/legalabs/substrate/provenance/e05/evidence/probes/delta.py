import board
b = board.Board()
assert b.draft_count() == 0, b.draft_count()
b.add_draft("x"); b.add_draft("y")
assert b.draft_count() == 2, b.draft_count()
b.pin("a")
assert b.draft_count() == 2, "the two lists must stay separate"
assert b.pin_count() == 1 and b.pin_report() == "a"
print("OK")
