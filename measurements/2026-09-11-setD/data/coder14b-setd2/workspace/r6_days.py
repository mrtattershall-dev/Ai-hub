from datetime import datetime, timedelta

def parse(d):
    if isinstance(d, str):
        return datetime.strptime(d, "%Y-%m-%d")
    return d

def fmt(d):
    return d.strftime("%Y-%m-%d")

def add_days(s, n):
    d = parse(s)
    d += timedelta(days=n)
    return fmt(d)

def add_business_days(s, n, holidays=None):
    if holidays is None:
        holidays = []
    d = parse(s)
    while n > 0:
        d += timedelta(days=1)
        if d.weekday() < 5 and fmt(d) not in holidays:
            n -= 1
    return fmt(d)
def test_add_business_days():
    # Test without holidays
    assert add_business_days("2023-10-06", 5) == "2023-10-13"  # No holidays, 5 business days later
    # Test with holidays
    holidays = ["2023-10-09", "2023-10-10"]
    assert add_business_days("2023-10-06", 5, holidays) == "2023-10-17"  # 2 holidays, 5 business days later
    assert add_business_days("2023-10-06", 3, holidays) == "2023-10-13"  # 2 holidays, 3 business days later
    print("All tests passed!")

if __name__ == "__main__":
    test_add_business_days()
from datetime import datetime, timedelta

def business_days_between(a, b, holidays=()):
    if b <= a:
        return 0

    business_days = 0
    current = a
    while current < b:
        current += timedelta(days=1)
        if current.weekday() < 5 and current not in holidays:
            business_days += 1

    return business_days
def test_business_days_between():
    a = datetime(2023, 10, 1)  # Sunday
    b = datetime(2023, 10, 5)  # Thursday
    holidays = (datetime(2023, 10, 3),)  # Monday holiday
    assert business_days_between(a, b, holidays) == 3, "Test case 1 failed"

    a = datetime(2023, 10, 5)  # Thursday
    b = datetime(2023, 10, 1)  # Sunday
    assert business_days_between(a, b, holidays) == 0, "Test case 2 failed"

    a = datetime(2023, 10, 1)  # Sunday
    b = datetime(2023, 10, 1)  # Sunday
    assert business_days_between(a, b, holidays) == 0, "Test case 3 failed"

    print("All test cases passed!")

if __name__ == "__main__":
    test_business_days_between()
def month_end(s):
    from datetime import datetime, timedelta
    d = datetime.strptime(s, "%Y-%m-%d")
    next_month = d.replace(day=28) + timedelta(days=4)
    return next_month - timedelta(days=next_month.day)
def add_months(s, n):
    from datetime import datetime, timedelta
    d = datetime.strptime(s, "%Y-%m-%d")
    month = d.month + n
    year = d.year + month // 12
    month = month % 12 + 1
    last_day = month_end(f"{year}-{month:02d}-01")
    return min(d.replace(year=year, month=month), last_day)
import datetime

def iso_week(s):
    date = datetime.datetime.strptime(s, "%Y-%m-%d")
    year, week = date.isocalendar()[0:2]
    return (year, week)
import datetime

def next_weekday(s, name):
    days = {
        'monday': 0,
        'tuesday': 1,
        'wednesday': 2,
        'thursday': 3,
        'friday': 4,
        'saturday': 5,
        'sunday': 6
    }
    name = name.lower()
    if name not in days:
        raise ValueError("Unknown weekday name")
    
    target_day = days[name]
    current_day = s.weekday()
    days_ahead = (target_day - current_day) % 7
    if days_ahead == 0:
        days_ahead = 7
    return s + datetime.timedelta(days=days_ahead)
