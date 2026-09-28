import events
assert events.valid_types(["scroll"]), "the new type must be admitted"
assert events.label("scroll") == "scroll wheel", events.label("scroll")
assert events.render({"type": "scroll", "delta": 3}) == "scroll 3", events.render({"type": "scroll", "delta": 3})
assert events.render({"type": "scroll"}) == "scroll 0", events.render({"type": "scroll"})
assert events.render({"type": "key", "code": "Esc"}) == "key Esc", "existing types unchanged"
print("OK")
