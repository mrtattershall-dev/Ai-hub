SCALE = 100


def mean(xs):
    return sum(xs) / len(xs) if xs else 0


def scaled(xs):
    return [x * SCALE for x in xs]


def spread(xs):
    return max(xs) - min(xs) if xs else 0
