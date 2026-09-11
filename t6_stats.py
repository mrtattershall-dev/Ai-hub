def mean(xs):
    """Calculate the mean of a list of numbers."""
    if not xs:
        raise ValueError("Cannot calculate mean of an empty list")
    return sum(xs) / len(xs)

def median(xs):
    """Calculate the median of a list of numbers."""
    if not xs:
        raise ValueError("Cannot calculate median of an empty list")
    sorted_xs = sorted(xs)
    n = len(sorted_xs)
    if n % 2 == 0:
        return (sorted_xs[n//2 - 1] + sorted_xs[n//2]) / 2
    else:
        return sorted_xs[n//2]

def mode(xs):
    """Calculate the mode of a list of numbers."""
    if not xs:
        raise ValueError("Cannot calculate mode of an empty list")
    frequency = {}
    for x in xs:
        frequency[x] = frequency.get(x, 0) + 1
    max_frequency = max(frequency.values())
    modes = [k for k, v in frequency.items() if v == max_frequency]
    return modes[0] if len(modes) == 1 else modes

# Asserts
assert mean([1, 2, 3, 4, 5]) == 3.0
assert median([1, 2, 3, 4, 5]) == 3
assert mode([1, 2, 2, 3, 3, 3]) == 3
assert mode([1, 1, 2, 2]) == 1  # Returns first mode when multiple

# Test empty list raises ValueError
try:
    mean([])
    assert False, "Should have raised ValueError"
except ValueError:
    pass

try:
    median([])
    assert False, "Should have raised ValueError"
except ValueError:
    pass

try:
    mode([])
    assert False, "Should have raised ValueError"
except ValueError:
    pass

print("All tests passed!")