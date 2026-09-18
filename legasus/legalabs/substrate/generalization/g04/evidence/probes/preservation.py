import registry
assert registry.add(1)
assert not registry.add(None)
assert registry.size() == 1, registry.size()
print("OK")
