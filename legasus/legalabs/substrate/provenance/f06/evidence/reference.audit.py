# Audit helpers.

_LOG = []


def fmt_event(e):
    return str(e.get("kind", "?")) + ":" + str(e.get("who", "?"))


MAX_LOG = 50


def is_error(e):
    return str(e.get("kind", "")) == "error"


def record(e):
    _LOG.append(e)
    while len(_LOG) > MAX_LOG:
        _LOG.pop(0)
    return e


def summary(events):
    return ", ".join(fmt_event(e) for e in events)


def history():
    return list(_LOG)
