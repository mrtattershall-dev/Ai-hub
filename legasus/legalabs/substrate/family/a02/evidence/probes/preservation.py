import metrics
m = metrics.Metrics()
m.record_day("mon", 2); m.record_day("mon", 3); m.record_day("tue", 1)
assert m.day_total("mon") == 5, m.day_total("mon")
assert m.day_total("sun") == 0
assert m.busiest_day() == "mon", m.busiest_day()
assert metrics.Metrics().busiest_day() is None
print("OK")
