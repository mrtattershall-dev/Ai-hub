import formatting
assert formatting.rule(3) == "---", formatting.rule(3)
assert formatting.rule(2, "=") == "==", formatting.rule(2, "=")
assert formatting.rule_width() == "--------", formatting.rule_width()
assert formatting.pad("a") == "a       ", "the existing helper must be unchanged"
print("OK")
