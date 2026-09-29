import datetime

# Check what day January 1, 2026 is
date = datetime.date(2026, 1, 1)
print(f"2026-01-01 is a {date.strftime('%A')} (weekday {date.weekday()})")

# Check what days are in the range (2026-01-01, 2026-01-05]
for i in range(1, 6):
    d = datetime.date(2026, 1, i)
    print(f"2026-01-{i:02d} is a {d.strftime('%A')} (weekday {d.weekday()})")