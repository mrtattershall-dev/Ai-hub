import registry
registry.add(1); registry.add(2)
assert registry.clear() == 2, "clear reports how many were removed"
assert registry.size() == 0, registry.size()
assert registry.reset([7, 8, 9]) == 3, "reset empties then adds"
assert registry.size() == 3, registry.size()
assert registry.reset([]) == 0
assert registry.add(3) and registry.size() == 1, "the existing helpers must be unchanged"
print("OK")
