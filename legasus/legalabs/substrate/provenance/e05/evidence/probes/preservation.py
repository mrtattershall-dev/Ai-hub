import board
b = board.Board()
b.pin("a"); b.pin("b")
assert b.pin_count() == 2, b.pin_count()
b.unpin("a")
assert b.pin_count() == 1, b.pin_count()
assert b.pin_report() == "b", b.pin_report()
print("OK")
