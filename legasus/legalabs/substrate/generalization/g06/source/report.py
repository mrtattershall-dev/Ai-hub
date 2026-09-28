# Report formatting.


def title(s):
    return str(s).strip().upper()


def describe(s):
    return title(s) + " | " + _suffix(s)


def plain(s):
    return str(s).strip()
