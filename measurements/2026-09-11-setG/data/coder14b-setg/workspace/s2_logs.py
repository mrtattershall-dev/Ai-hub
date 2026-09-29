import datetime

def parse_line(line):
    # Existing code
    pass

def parse_log(text):
    # Existing code
    pass

def status_counts(entries):
    # Existing code
    pass

def error_rate(entries):
    # Existing code
    pass

def top_paths(entries, n=3):
    # Existing code
    pass

def percentile(entries, p):
    # Existing code
    pass

def bad_lines(text):
    # Existing code
    pass

def by_hour(entries):
    result = {}
    for entry in entries:
        time_str = entry['time'].split('+')[0]  # Remove the +0000 offset
        time_obj = datetime.datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S')
        time_key = time_obj.strftime('%Y-%m-%d %H')
        if time_key in result:
            result[time_key] += entry['bytes']
        else:
            result[time_key] = entry['bytes']
    return result
def test_by_hour():
    entries = [
        {'time': '2023-10-01 12:30:00+0000', 'bytes': 100},
        {'time': '2023-10-01 12:45:00+0000', 'bytes': 200},
        {'time': '2023-10-01 13:00:00+0000', 'bytes': 150},
        {'time': '2023-10-02 12:30:00+0000', 'bytes': 300},
    ]
    expected = {
        '2023-10-01 12': 300,
        '2023-10-01 13': 150,
        '2023-10-02 12': 300,
    }
    result = by_hour(entries)
    assert result == expected, f"Expected {expected}, but got {result}"

if __name__ == "__main__":
    test_by_hour()
    print("All tests passed.")
