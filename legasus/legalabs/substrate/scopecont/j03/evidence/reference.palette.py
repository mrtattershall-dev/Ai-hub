# Palette.

COLORS = [
    "red",
    "green",
]

DEFAULT = "red"


def safe(name):
    return pick(name) == DEFAULT


def known(name):
    return name in COLORS


def pick(name):
    return name if known(name) else DEFAULT
