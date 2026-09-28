# Text tools.


def shout(s):
    return _emph(s).upper()


def shout_twice(s):
    return shout(s) + shout(s)


def plain(s):
    return str(s).strip()


def _emph(s):
    return str(s) + "!"
