EVENT_TYPES = ["click", "key"]

EVENT_LABELS = {"click": "mouse click", "key": "key press"}


def _render_click(e):
    return "click at " + str(e.get("x", 0)) + "," + str(e.get("y", 0))


def _render_key(e):
    return "key " + str(e.get("code", ""))


def label(t):
    return EVENT_LABELS.get(t, "unknown")


def valid_types(types):
    return all(t in EVENT_TYPES for t in types)


def render(e):
    t = e.get("type")
    if t == "click":
        return _render_click(e)
    if t == "key":
        return _render_key(e)
    return "unknown event"
