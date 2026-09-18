# Formatting defaults.

WIDTH = 8


def _dash():
    return "-"


def pad(s):
    return str(s).ljust(WIDTH)


def rule(n, ch=_dash()):
    return ch * n


def trim(s):
    return str(s).strip()


def rule_width(ch=_dash()):
    return ch * WIDTH
