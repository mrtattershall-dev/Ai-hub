import metrics
m = metrics.Metrics()
assert m.busiest_hour() is None
m.record_hour(9, 4); m.record_hour(9, 1); m.record_hour(17, 2)
assert m.hour_total(9) == 5, m.hour_total(9)
assert m.hour_total(3) == 0
assert m.busiest_hour() == 9, m.busiest_hour()
m.record_day("mon", 7)
assert m.day_total("mon") == 7 and m.hour_total(9) == 5, "daily and hourly must stay separate"
print("OK")
