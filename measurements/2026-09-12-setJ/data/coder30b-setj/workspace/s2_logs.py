import re

def parse_line(line):
    # Pattern to match Apache access log format
    # Format: ip - - [time] "method path protocol" status bytes seconds
    pattern = r'^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) \S+" (\d+) (\d+|-) (\d+(?:\.\d+)?)$'
    
    match = re.match(pattern, line.strip())
    
    if not match:
        raise ValueError("Line does not match expected log format")
    
    ip, time, method, path, status, bytes_str, seconds = match.groups()
    
    # Convert status to int
    status = int(status)
    
    # Convert bytes to int, handling "-" case
    if bytes_str == "-":
        bytes_val = 0
    else:
        bytes_val = int(bytes_str)
    
    # Convert seconds to float
    seconds = float(seconds)
    
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
    """Parse log text and return list of valid parsed dictionaries."""
    lines = text.strip().split('\n')
    result = []
    
    for line in lines:
        if not line.strip():  # Skip blank lines
            continue
        try:
            result.append(parse_line(line))
        except ValueError:
            # Skip malformed lines
            continue
    
    return result

def bad_lines(text):
    """Return list of 1-based line numbers of malformed lines (excluding blank lines)."""
    lines = text.strip().split('\n')
    result = []
    
    for i, line in enumerate(lines, 1):  # 1-based indexing
        if not line.strip():  # Skip blank lines
            continue
        try:
            parse_line(line)
        except ValueError:
            result.append(i)
    
    return result

if __name__ == "__main__":
    # Test with the example line
    test_line = '127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045'
    result = parse_line(test_line)
    
    print("Result:", result)
    
    # Verify the expected values
    assert result['ip'] == '127.0.0.1'
    assert result['time'] == '10/Oct/2023:13:55:36 +0000'
    assert result['method'] == 'GET'
    assert result['path'] == '/index.html'
    assert result['status'] == 200
    assert result['bytes'] == 2326
    assert result['seconds'] == 0.045
    
    print("All assertions passed!")
    
    # Test with "-" bytes
    test_line2 = '192.168.1.1 - - [15/Oct/2023:14:30:45 +0000] "POST /api/data HTTP/1.1" 201 - 0.123'
    result2 = parse_line(test_line2)
    
    assert result2['bytes'] == 0
    print("Test with '-' bytes passed!")
    
    # Test ValueError for invalid line
    try:
        parse_line('invalid log line')
        assert False, "Should have raised ValueError"
    except ValueError:
        print("ValueError correctly raised for invalid line")