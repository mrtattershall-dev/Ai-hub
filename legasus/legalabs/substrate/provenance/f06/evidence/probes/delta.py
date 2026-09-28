import audit
assert audit.MAX_LOG == 50, audit.MAX_LOG
assert audit.history() == [], audit.history()
assert audit.record({"kind": "k0", "who": "w"}) == {"kind": "k0", "who": "w"}
for i in range(1, 60):
    audit.record({"kind": "k" + str(i), "who": "w"})
h = audit.history()
assert len(h) == 50, len(h)
assert h[0]["kind"] == "k10", h[0]["kind"]
assert h[-1]["kind"] == "k59", h[-1]["kind"]
h.append("junk")
assert len(audit.history()) == 50, "history must return a copy"
assert audit.is_error({"kind": "error"}), "the existing helpers must be unchanged"
print("OK")
