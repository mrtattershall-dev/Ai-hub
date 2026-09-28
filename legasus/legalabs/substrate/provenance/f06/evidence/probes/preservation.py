import audit
assert audit.fmt_event({"kind": "login", "who": "ann"}) == "login:ann", audit.fmt_event({"kind": "login", "who": "ann"})
assert audit.fmt_event({}) == "?:?"
assert audit.is_error({"kind": "error"})
assert not audit.is_error({"kind": "login"})
assert audit.summary([{"kind": "a", "who": "b"}]) == "a:b"
print("OK")
