def parse_line(line):
    parts = line.split()
    if len(parts) != 10:
        raise ValueError("Invalid log line format")
    
    ip = parts[0]
    time = parts[3][1:-1]
    request = parts[5][1:-1]
    method, path = request.split()
    status = int(parts[8])
    bytes_str = parts[9]
    bytes_ = int(bytes_str) if bytes_str != "-" else 0
    seconds = float(parts[7])
    
    return {
        "ip": ip,
        "time": time,
        "method": method,
        "path": path,
        "status": status,
        "bytes": bytes_,
        "seconds": seconds
    }

if __name__ == "__main__":
    # Add assertions here to test the parse_line function
    test_line = '127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045'
    expected_output = {
        "ip": "127.0.0.1",
        "time": "10/Oct/2023:13:55:36 +0000",
        "method": "GET",
        "path": "/index.html",
        "status": 200,
        "bytes": 2326,
        "seconds": 0.045
    }
    assert parse_line(test_line) == expected_output, "Test failed"
    print("Test passed")
import json

def parse_log(text):
    lines = text.splitlines()
    parsed_logs = []
    bad_lines = []

    for i, line in enumerate(lines):
        if line.strip() == "":
            continue
        try:
            # Assuming log lines are in JSON format
            parsed_logs.append(json.loads(line))
        except json.JSONDecodeError:
            bad_lines.append(i + 1)

    return parsed_logs, bad_lines
def bad_lines(text):
    lines = text.splitlines()
    bad_lines = []

    for i, line in enumerate(lines):
        if line.strip() == "":
            continue
        try:
            # Assuming log lines are in JSON format
            json.loads(line)
        except json.JSONDecodeError:
            bad_lines.append(i + 1)

    return bad_lines
def parse_line(line):
    parts = line.split()
    if len(parts) != 10:
        raise ValueError("Invalid log line format")
    
    ip = parts[0]
    time = parts[3][1:-1]
    request = parts[5][1:-1]
    method, path = request.split()
    status = int(parts[8])
    bytes_str = parts[9]
    bytes_ = int(bytes_str) if bytes_str != "-" else 0
    seconds = float(parts[7])
    
    return {
        "ip": ip,
        "time": time,
        "method": method,
        "path": path,
        "status": status,
        "bytes": bytes_,
        "seconds": seconds
    }
def status_counts(entries):
    status_dict = {}
    for entry in entries:
        status = entry['status']
        if status in status_dict:
            status_dict[status] += 1
        else:
            status_dict[status] = 1
    return status_dict
def error_rate(entries):
    pass

def top_paths(entries, n=3):
    from collections import Counter
    from urllib.parse import urlparse

    path_counts = Counter()

    for entry in entries:
        parsed_url = urlparse(entry['path'])
        path = parsed_url.path
        path_counts[path] += 1

    return path_counts.most_common(n)
    if not entries:
        return 0.0
    error_count = sum(1 for entry in entries if entry['status'] >= 500)
    return round(error_count / len(entries), 4)
