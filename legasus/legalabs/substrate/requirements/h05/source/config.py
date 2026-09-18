# Config assembly.

CONFIG = {"a": 1}


def get(k):
    return CONFIG.get(k)


def names():
    return sorted(CONFIG)
