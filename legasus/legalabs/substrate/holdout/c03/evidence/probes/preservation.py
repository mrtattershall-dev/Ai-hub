import events
assert events.valid_types(["click", "key"])
assert not events.valid_types(["nope"])
assert events.label("click") == "mouse click", events.label("click")
assert events.render({"type": "click", "x": 1, "y": 2}) == "click at 1,2", events.render({"type": "click", "x": 1, "y": 2})
assert events.render({"type": "key", "code": "Esc"}) == "key Esc"
assert events.render({"type": "nope"}) == "unknown event"
print("OK")
