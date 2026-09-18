# Aggregation.


def summarize(items):
    total = 0
    for it in items:
        total += int(it)
    return total


def count(items):
    return len(items)
