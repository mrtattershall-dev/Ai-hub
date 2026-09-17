import matrix
assert matrix.MAX_DIM == 64, matrix.MAX_DIM
ok = [[1, 2], [3, 4]]
assert matrix.checked(ok) == ok
try:
    matrix.checked([[1, 2], [3]])
    raise AssertionError("a ragged matrix must raise ShapeError")
except matrix.ShapeError:
    pass
try:
    matrix.checked([[0] * 65])
    raise AssertionError("exceeding MAX_DIM must raise ShapeError")
except matrix.ShapeError:
    pass
assert matrix.checked_all([ok, ok]) == [ok, ok], matrix.checked_all([ok, ok])
assert matrix.col(ok, 1) == [2, 4], "the existing helpers must be unchanged"
print("OK")
