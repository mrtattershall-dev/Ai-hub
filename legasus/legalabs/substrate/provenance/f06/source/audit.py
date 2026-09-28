# Audit helpers.


def fmt_event(e):
    return str(e.get("kind", "?")) + ":" + str(e.get("who", "?"))


def is_error(e):
    return str(e.get("kind", "")) == "error"


def summary(events):
    return ", ".join(fmt_event(e) for e in events)
