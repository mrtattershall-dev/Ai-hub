# Settings assembly.


def _base():
    return {"retries": 1}


DEFAULTS = _base()


def get(name):
    return DEFAULTS.get(name)
