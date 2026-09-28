# Tiny registry.

ITEMS = []


def add(x):
    if x is None:
        return False
    ITEMS.append(x)
    return True


def size():
    return len(ITEMS)
