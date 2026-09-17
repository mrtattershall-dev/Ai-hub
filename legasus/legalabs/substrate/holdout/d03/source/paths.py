# Path helpers.


def clean(p):
    return str(p).strip().strip("/")


def join_path(a, b):
    left = clean(a)
    right = clean(b)
    if not left:
        return right
    if not right:
        return left
    return left + "/" + right


def depth(p):
    c = clean(p)
    return len(c.split("/")) if c else 0
