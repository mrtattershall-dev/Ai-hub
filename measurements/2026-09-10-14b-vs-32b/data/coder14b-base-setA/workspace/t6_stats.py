def mean(xs):
    if not xs:
        raise ValueError("List is empty")
    return sum(xs) / len(xs)

# Test the mean function
assert mean([1, 2, 3, 4, 5]) == 3.0
assert mean([10, 20, 30]) == 20.0
try:
    mean([])
except ValueError as e:
    assert str(e) == "List is empty"
def median(xs):
    if not xs:
        raise ValueError("List is empty")
    sorted_xs = sorted(xs)
    n = len(sorted_xs)
    mid = n // 2
    if n % 2 == 0:
        return (sorted_xs[mid - 1] + sorted_xs[mid]) / 2
    else:
        return sorted_xs[mid]

# Test the median function
assert median([1, 2, 3, 4, 5]) == 3.0
assert median([10, 20, 30]) == 20.0
try:
    median([])
except ValueError as e:
    assert str(e) == "List is empty"
from collections import Counter

def mode(xs):
    if not xs:
        raise ValueError("List is empty")
    count = Counter(xs)
    max_count = max(count.values())
    modes = [k for k, v in count.items() if v == max_count]
    if len(modes) == 1:
        return modes[0]
    else:
        raise ValueError("No unique mode")

# Test the mode function
assert mode([1, 2, 2, 3, 4]) == 2
try:
    mode([1, 1, 2, 2, 3])
except ValueError as e:
    assert str(e) == "No unique mode"
assert mode([]) == 3.0  # This will raise ValueError
