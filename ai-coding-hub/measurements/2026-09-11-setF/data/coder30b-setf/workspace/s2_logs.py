import re
from collections import Counter
from urllib.parse import urlparse

def parse_line(line):
    # Apache access log format: ip - - [time] "request" status bytes time
    # Example: 127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045
    # Example with IPv6: ::1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045
    # Example without seconds: 127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326
    
    # Updated pattern to handle IPv6 addresses and optional seconds
    pattern = r'^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+ \S+ \S+)" (\d+) (\d+|-)(?: (\d+\.\d+))?$'
    match = re.match(pattern, line.strip())
    
    if not match:
        raise ValueError("Line does not match expected format")
    
    ip, time, request, status, bytes_str, seconds_str = match.groups()
    
    # Parse request into method and path
    method, path, _ = request.split(' ')
    
    # Convert status to int
    status = int(status)
    
    # Convert bytes to int, handling "-" case
    if bytes_str == "-":
        bytes_val = 0
    else:
        bytes_val = int(bytes_str)
    
    # Convert seconds to float, or None if not present
    if seconds_str is None:
        seconds = None
    else:
        seconds = float(seconds_str)
    
    return {
        'ip': ip,
        'time': time,
        'method': method,
        'path': path,
        'status': status,
        'bytes': bytes_val,
        'seconds': seconds
    }

def parse_log(text):
    lines = text.strip().split('\n')
    entries = []
    for line in lines:
        if line.strip():
            try:
                entries.append(parse_line(line))
            except ValueError as e:
                # Skip invalid lines
                pass
    return entries

def bad_lines(text):
    lines = text.strip().split('\n')
    bad = []
    for line in lines:
        if line.strip():
            try:
                parse_line(line)
            except ValueError:
                bad.append(line)
    return bad

def status_counts(entries):
    counts = Counter(entry['status'] for entry in entries)
    return dict(counts)

def error_rate(entries):
    if not entries:
        return 0.0
    errors = sum(1 for entry in entries if entry['status'] >= 400)
    return errors / len(entries)

def top_paths(entries, n=3):
    paths = Counter(entry['path'] for entry in entries)
    return paths.most_common(n)

def percentile(entries, p):
    # Filter out entries with None seconds
    valid_entries = [entry for entry in entries if entry['seconds'] is not None]
    
    if not valid_entries:
        return 0.0
    
    sorted_seconds = sorted(entry['seconds'] for entry in valid_entries)
    index = int(len(sorted_seconds) * p / 100)
    return sorted_seconds[index]

def main():
    # Test with the example line
    test_line = '127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045'
    result = parse_line(test_line)
    
    expected = {
        'ip': '127.0.0.1',
        'time': '10/Oct/2023:13:55:36 +0000',
        'method': 'GET',
        'path': '/index.html',
        'status': 200,
        'bytes': 2326,
        'seconds': 0.045
    }
    
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test with "-" bytes
    test_line2 = '192.168.1.1 - - [11/Oct/2023:14:00:00 +0000] "POST /api/data HTTP/1.1" 201 - 0.123'
    result2 = parse_line(test_line2)
    
    expected2 = {
        'ip': '192.168.1.1',
        'time': '11/Oct/2023:14:00:00 +0000',
        'method': 'POST',
        'path': '/api/data',
        'status': 201,
        'bytes': 0,
        'seconds': 0.123
    }
    
    assert result2 == expected2, f"Expected {expected2}, got {result2}"
    
    # Test with IPv6
    test_line3 = '::1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045'
    result3 = parse_line(test_line3)
    
    expected3 = {
        'ip': '::1',
        'time': '10/Oct/2023:13:55:36 +0000',
        'method': 'GET',
        'path': '/index.html',
        'status': 200,
        'bytes': 2326,
        'seconds': 0.045
    }
    
    assert result3 == expected3, f"Expected {expected3}, got {result3}"
    
    # Test without seconds
    test_line4 = '127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326'
    result4 = parse_line(test_line4)
    
    expected4 = {
        'ip': '127.0.0.1',
        'time': '10/Oct/2023:13:55:36 +0000',
        'method': 'GET',
        'path': '/index.html',
        'status': 200,
        'bytes': 2326,
        'seconds': None
    }
    
    assert result4 == expected4, f"Expected {expected4}, got {result4}"
    
    print("All tests passed!")

if __name__ == "__main__":
    main()