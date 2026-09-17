import stats
assert stats.running_mean(2) == 2.0, stats.running_mean(2)
assert stats.running_mean(4) == 3.0, "mean of 2 and 4"
assert stats.running_mean(6) == 4.0, "mean of 2, 4 and 6"
assert stats.mean([1, 2, 3]) == 2, "the existing helpers must be unchanged"
print("OK")
