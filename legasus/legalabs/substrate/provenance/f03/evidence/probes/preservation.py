import matrix
m = [[1, 2], [3, 4]]
assert matrix.shape(m) == (2, 2), matrix.shape(m)
assert matrix.shape([]) == (0, 0)
assert matrix.row(m, 0) == [1, 2], matrix.row(m, 0)
assert matrix.col(m, 1) == [2, 4], matrix.col(m, 1)
print("OK")
