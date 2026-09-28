import stats
assert stats.mean([1, 2, 3]) == 2, stats.mean([1, 2, 3])
assert stats.mean([]) == 0
assert stats.scaled([1, 2]) == [100, 200], stats.scaled([1, 2])
assert stats.spread([1, 5]) == 4, stats.spread([1, 5])
print("OK")
