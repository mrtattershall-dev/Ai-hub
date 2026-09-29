from datetime import datetime

def parse(s):
    try:
        return datetime.strptime(s, '%Y-%m-%d').date().date().date()
    except ValueError:
        raise ValueError("Invalid date format or impossible date")

def fmt(d):
    return d.strftime('%Y-%m-%d')

if __name__ == "__main__":
    # Test cases
    assert parse("2023-10-05") == datetime.date(2023, 10, 5)
    assert parse("2023-02-29") == datetime.date(2023, 2, 29)
    try:
        parse("2026-02-30")
    except ValueError:
        pass
    else:
        raise AssertionError("Failed to raise ValueError for impossible date")
    assert fmt(datetime.date(2023, 10, 5)) == "2023-10-05"
    assert fmt(datetime.date(2023, 2, 29)) == "2023-02-29"