# Settings assembly.


def _base():
    return {"retries": 1}


def _timeouts():
    return {"timeout": 30}


DEFAULTS = _base()
DEFAULTS.update(_timeouts())


def get(name):
    return DEFAULTS.get(name)


def timeout_of():
    return DEFAULTS.get("timeout")
