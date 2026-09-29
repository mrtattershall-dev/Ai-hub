def parse_line(line):
    import re
    pattern = r'(?P<ip>\S+) - - \[(?P<time>[^\]]+)\] "(?P<method>\S+) (?P<path>\S+) \S+" (?P<status>\d+) (?P<bytes>\S+) (?P<seconds>\S+)'
    match = re.match(pattern, line)
    if not match:
        raise ValueError("Line does not match the expected format")
    
    data = match.groupdict()
    data['status'] = int(data['status'])
    data['bytes'] = int(data['bytes']) if data['bytes'] != '-' else 0
    data['seconds'] = float(data['seconds'])
    
    return data

def parse_log(text):
    import json
    parsed_logs = []
    lines = text.splitlines()
    for line in lines:
        try:
            if line.strip():  # Skip blank lines
                parsed_logs.append(json.loads(line))
        except json.JSONDecodeError:
            continue  # Skip malformed lines
    return parsed_logs

def bad_lines(text):
    import json
    bad_line_numbers = []
    lines = text.splitlines()
    for i, line in enumerate(lines, start=1):
        try:
            if line.strip():  # Skip blank lines
                json.loads(line)
        except json.JSONDecodeError:
            bad_line_numbers.append(i)  # Record malformed lines
    return bad_line_numbers

if __name__ == "__main__":
    # Test cases
    valid_line = '127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045'
    invalid_line = '127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326'
    
    # Valid line test
    parsed_data = parse_line(valid_line)
    assert parsed_data == {
        'ip': '127.0.0.1',
        'time': '10/Oct/2023:13:55:36 +0000',
        'method': 'GET',
        'path': '/index.html',
        'status': 200,
        'bytes': 2326,
        'seconds': 0.045
    }
    
    # Invalid line test
    try:
        parse_line(invalid_line)
    except ValueError as e:
        assert str(e) == "Line does not match the expected format"
    else:
        assert False, "Expected ValueError for invalid line"