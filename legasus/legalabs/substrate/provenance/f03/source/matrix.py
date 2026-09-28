# Small matrix helpers.


def shape(m):
    return (len(m), len(m[0]) if m else 0)


def row(m, i):
    return list(m[i])


def col(m, j):
    return [r[j] for r in m]
