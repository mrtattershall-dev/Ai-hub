# Temperature helpers.


def to_f(c):
    return c * 9.0 / 5.0 + 32.0


def to_c(f):
    return (f - 32.0) * 5.0 / 9.0


def floor_c(c):
    return max(-273.15, c)
