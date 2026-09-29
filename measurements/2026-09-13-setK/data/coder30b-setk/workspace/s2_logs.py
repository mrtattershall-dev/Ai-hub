import re

def parse_line(line):
    # Regular expression to match the access log format
    pattern = r'(\S+) - - \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+|-) (\d+\.\d+)'
    match = re.match(pattern, line)
    
    if not match:
        raise ValueError("Line does not match expected format")
    
    ip, time, method, path, protocol, status, bytes_val, seconds = match.groups()
    
    # Convert status to int
    status = int(status)
    
    # Convert bytes to int, handling "-" case
    if bytes_val == "-":
        bytes_val = 0
    else:
        bytes_val = int(bytes_val)
    
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

def status_counts(entries):
    """Return a dictionary mapping status codes to their counts."""
    counts = {}
    for entry in entries:
        status = entry['status']
        if status in counts:
            counts[status] += 1
        else:
            counts[status] = 1
    return counts

def error_rate(entries):
    """Return the fraction of entries whose status is 500 or more, rounded to 4 decimals.
    Returns 0.0 when there are no entries."""
    if not entries:
        return 0.0
    
    error_count = 0
    for entry in entries:
        if entry['status'] >= 500:
            error_count += 1
    
    return round(error_count / len(entries), 4)

def top_paths(entries, n=3):
    """Return a list of (path, count) tuples for the n most requested paths,
    sorted by count (descending) and then by path (ascending) for ties.
    Query strings are not counted as part of the path."""
    # Extract paths and count them
    path_counts = {}
    for entry in entries:
        path = entry['path']
        # Remove query string if present
        if '?' in path:
            path = path.split('?', 1)[0]
        if path in path_counts:
            path_counts[path] += 1
        else:
            path_counts[path] = 1
    
    # Sort by count (descending) then by path (ascending) for ties
    sorted_paths = sorted(path_counts.items(), key=lambda x: (-x[1], x[0]))
    
    # Return top n paths
    return sorted_paths[:n]

if __name__ == "__main__":
    # Test with the example line
    line = '127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045'
    result = parse_line(line)
    
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
    
    # Test with "-" in bytes field
    line2 = '192.168.1.1 - - [11/Oct/2023:14:56:37 +0000] "POST /api/data HTTP/1.1" 201 - 0.123'
    result2 = parse_line(line2)
    
    expected2 = {
        'ip': '192.168.1.1',
        'time': '11/Oct/2023:14:56:37 +0000',
        'method': 'POST',
        'path': '/api/data',
        'status': 201,
        'bytes': 0,
        'seconds': 0.123
    }
    
    assert result2 == expected2, f"Expected {expected2}, got {result2}"
    
    # Test invalid line - should raise ValueError
    try:
        parse_line('invalid line format')
        assert False, "Should have raised ValueError"
    except ValueError:
        pass  # Expected
    
    print("All tests passed!")
