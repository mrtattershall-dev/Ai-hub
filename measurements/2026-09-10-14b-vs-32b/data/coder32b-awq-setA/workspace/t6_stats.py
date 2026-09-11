def mean(xs):
    if not xs:
        raise ValueError("The list is empty")
    return sum(xs) / len(xs)
def median(xs):
    if not xs:
        raise ValueError("The list is empty")
    sorted_xs = sorted(xs)
    n = len(sorted_xs)
    mid = n // 2
    if n % 2 == 0:
        return (sorted_xs[mid - 1] + sorted_xs[mid]) / 2
    else:
        return sorted_xs[mid]
from collections import Counter

def mode(xs):
    if not xs:
        raise ValueError("The list is empty")
    count = Counter(xs)
    max_count = max(count.values())
    modes = [k for k, v in count.items() if v == max_count]
    if len(modes) > 1:
        raise ValueError("The list has multiple modes")
    return modes[0]
# Test cases
assert mean([1, 2, 3, 4, 5]) == 3
assert median([1, 2, 3, 4, 5]) == 3
assert median([1, 2, 3, 4]) == 2.5
assert mode([1, 2, 2, 3, 4]) == 2
try:
    mean([])
except ValueError as e:
    assert str(e) == "The list is empty"
try:
    median([])
except ValueError as e:
    assert str(e) == "The list is empty"
try:
    mode([])
except ValueError as e:
    assert str(e) == "The list is empty"
try:
    mode([1, 2, 3, 4])
except ValueError as e:
    assert str(e) == "The list has multiple modes"
