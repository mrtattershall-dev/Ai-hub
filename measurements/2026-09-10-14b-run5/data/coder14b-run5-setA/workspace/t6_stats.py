def mean(xs):
    if not xs:
        raise ValueError("empty list")
    return sum(xs) / len(xs)

def median(xs):
    if not xs:
        raise ValueError("empty list")
    xs = sorted(xs)
    n = len(xs)
    mid = n // 2
    if n % 2 == 0:
        return (xs[mid - 1] + xs[mid]) / 2
    else:
        return xs[mid]

def mode(xs):
    if not xs:
        raise ValueError("empty list")
    from collections import Counter
    counts = Counter(xs)
    max_count = max(counts.values())
    modes = [x for x, count in counts.items() if count == max_count]
    if len(modes) == 1:
        return modes[0]
    else:
        raise ValueError("no unique mode")

# tests
assert mean([1, 2, 3]) == 2
assert median([1, 2, 3]) == 2
assert mode([1, 2, 2, 3]) == 2

print("stats: OK")