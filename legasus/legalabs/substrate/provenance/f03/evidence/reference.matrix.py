# Small matrix helpers.

MAX_DIM = 64


def shape(m):
    return (len(m), len(m[0]) if m else 0)


class ShapeError(Exception):
    pass


def row(m, i):
    return list(m[i])


def checked(m):
    widths = set(len(r) for r in m)
    if len(widths) > 1:
        raise ShapeError("ragged")
    if len(m) > MAX_DIM or (widths and max(widths) > MAX_DIM):
        raise ShapeError("too big")
    return m


def col(m, j):
    return [r[j] for r in m]


def checked_all(ms):
    return [checked(m) for m in ms]
