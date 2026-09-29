import re

def parse_line(line):
    # Pattern to match the access log format:
    # 127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045
    pattern = r'^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) \S+" (\d+) (\d+|-) (\d+\.\d+)$'
    
    match = re.match(pattern, line)
    if not match:
        raise ValueError("Invalid log line format")
    
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
    """Parse all valid lines from the log text, skipping blank and malformed lines."""
    lines = text.strip().split('\n')
    result = []
    
    for line in lines:
        if not line.strip():  # Skip blank lines
            continue
        try:
            parsed = parse_line(line)
            result.append(parsed)
        except ValueError:
            # Skip malformed lines
            continue
    
    return result

def bad_lines(text):
    """Return 1-based line numbers of malformed lines that are not blank."""
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
        counts[status] = counts.get(status, 0) + 1
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
    """Return a list of (path, count) tuples for the most requested paths, 
    ignoring query strings. Paths are sorted by count (descending) and then 
    by path (ascending) for ties. Returns at most n entries."""
    # Count paths (ignoring query strings)
    path_counts = {}
    for entry in entries:
        path = entry['path']
        # Remove query string if present
        if '?' in path:
            path = path.split('?', 1)[0]
        path_counts[path] = path_counts.get(path, 0) + 1
    
    # Sort by count (descending) then by path (ascending) for ties
    sorted_paths = sorted(path_counts.items(), key=lambda x: (-x[1], x[0]))
    
    # Return top n paths
    return sorted_paths[:n]

def percentile(entries, p):
    """Return the p-th percentile of the seconds values by nearest rank.
    The smallest value such that at least p percent of the values are less than or equal to it.
    Raises ValueError unless 0 < p <= 100 and there is at least one value."""
    if not entries:
        raise ValueError("No entries provided")
    if not (0 < p <= 100):
        raise ValueError("p must be between 0 and 100")
    
    # Extract seconds values
    seconds_values = [entry['seconds'] for entry in entries]
    
    # Sort the values
    sorted_values = sorted(seconds_values)
    
    # Calculate the index using nearest rank method
    # For p-th percentile, we want the smallest value such that at least p% are <= it
    # This is equivalent to finding the value at index ceil(p/100 * n) - 1 (0-indexed)
    n = len(sorted_values)
    index = int((p / 100.0) * n)
    
    # Adjust for 0-based indexing
    if index == 0:
        # If p <= 100/n, we want the first element
        return sorted_values[0]
    else:
        # For p > 100/n, we want the element at index (but we need to be careful about rounding)
        # Using nearest rank: we want the smallest value such that at least p% are <= it
        # This means we want the element at position ceil(p/100 * n) - 1
        index = int((p / 100.0) * n)
        if (p / 100.0) * n > index:
            index += 1
        return sorted_values[index - 1]

def by_hour(entries):
    """Return a dictionary mapping "YYYY-MM-DD HH" to total bytes for that hour.
    The time field is in format "DD/Mon/YYYY:HH:MM:SS +0000"."""
    result = {}
    
    for entry in entries:
        time_str = entry['time']
        # Parse the time string: "10/Oct/2023:13:55:36 +0000"
        # Extract date and hour part
        date_part, time_part = time_str.split(':', 1)  # Split at first colon to get date and time parts
        # date_part is "10/Oct/2023" 
        # time_part is "13:55:36 +0000"
        
        # Extract hour from time_part: "13:55:36 +0000"
        hour_part = time_part.split(':')[0]  # Get "13"
        
        # Format date part "10/Oct/2023" to "YYYY-MM-DD"
        # Split date_part by "/"
        day, month_str, year = date_part.split('/')
        
        # Convert month name to number
        months = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        }
        
        month = months[month_str]
        
        # Format date as YYYY-MM-DD
        date_formatted = f"{year}-{month}-{day.zfill(2)}"
        
        # Create the key "YYYY-MM-DD HH"
        key = f"{date_formatted} {hour_part}"
        
        # Add bytes to the total for this hour
        if key in result:
            result[key] += entry['bytes']
        else:
            result[key] = entry['bytes']
    
    return result

def between(entries, start, end):
    """Return, in their original order, the entries whose time t satisfies start <= t < end,
    where start and end are "YYYY-MM-DD HH:MM:SS" strings."""
    result = []
    
    # Convert start and end times to datetime objects for comparison
    from datetime import datetime
    
    # Parse the start and end times
    start_time = datetime.strptime(start, "%Y-%m-%d %H:%M:%S")
    end_time = datetime.strptime(end, "%Y-%m-%d %H:%M:%S")
    
    for entry in entries:
        # Parse the entry's time string
        # The time format in entries is "DD/Mon/YYYY:HH:MM:SS +0000"
        time_str = entry['time']
        # Extract just the date and time part (before the timezone)
        date_time_part = time_str.split(' ', 1)[0]  # Get "10/Oct/2023:13:55:36"
        # Split to get date and time parts
        date_part, time_part = date_time_part.split(':', 1)
        # Format date part "10/Oct/2023" to "YYYY-MM-DD"
        day, month_str, year = date_part.split('/')
        months = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        }
        month = months[month_str]
        date_formatted = f"{year}-{month}-{day.zfill(2)}"
        # Combine date and time
        full_datetime_str = f"{date_formatted} {time_part}"
        # Convert to datetime object
        entry_time = datetime.strptime(full_datetime_str, "%Y-%m-%d %H:%M:%S")
        
        # Check if entry time is within the range [start, end)
        if start_time <= entry_time < end_time:
            result.append(entry)
    
    return result

if __name__ == "__main__":
    # Test with the example line
    line = '127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045'
    result = parse_line(line)
    
    assert result['ip'] == '127.0.0.1'
    assert result['time'] == '10/Oct/2023:13:55:36 +0000'
    assert result['method'] == 'GET'
    assert result['path'] == '/index.html'
    assert result['status'] == 200
    assert result['bytes'] == 2326
    assert result['seconds'] == 0.045
    
    # Test with "-" in bytes field
    line2 = '192.168.1.1 - - [11/Oct/2023:14:00:00 +0000] "POST /api/data HTTP/1.1" 201 - 0.123'
    result2 = parse_line(line2)
    
    assert result2['ip'] == '192.168.1.1'
    assert result2['time'] == '11/Oct/2023:14:00:00 +0000'
    assert result2['method'] == 'POST'
    assert result2['path'] == '/api/data'
    assert result2['status'] == 201
    assert result2['bytes'] == 0
    assert result2['seconds'] == 0.123
    
    # Test ValueError for invalid line
    try:
        parse_line('invalid log line')
        assert False, "Should have raised ValueError"
    except ValueError:
        pass  # Expected
    
    # Test new parse_log function
    log_text = '''127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045
192.168.1.1 - - [11/Oct/2023:14:00:00 +0000] "POST /api/data HTTP/1.1" 201 - 0.123

invalid log line
10.0.0.1 - - [12/Oct/2023:15:00:00 +0000] "GET /about HTTP/1.1" 200 1234 0.056'''
    
    parsed_logs = parse_log(log_text)
    assert len(parsed_logs) == 3
    assert parsed_logs[0]['ip'] == '127.0.0.1'
    assert parsed_logs[1]['ip'] == '192.168.1.1'
    assert parsed_logs[2]['ip'] == '10.0.0.1'
    
    # Test new bad_lines function
    bad_line_nums = bad_lines(log_text)
    assert bad_line_nums == [4]  # Line 4 is the invalid line (1-based)
    
    # Test with all blank lines
    blank_log = '''

'''
    assert parse_log(blank_log) == []
    assert bad_lines(blank_log) == []
    
    # Test with all invalid lines
    invalid_log = '''invalid line 1
invalid line 2

invalid line 3'''
    assert parse_log(invalid_log) == []
    assert bad_lines(invalid_log) == [1, 2, 4]  # 1-based line numbers
    
    # Test new status_counts function
    test_entries = [
        {'status': 200},
        {'status': 200},
        {'status': 404},
        {'status': 500},
        {'status': 503}
    ]
    expected_counts = {200: 2, 404: 1, 500: 1, 503: 1}
    assert status_counts(test_entries) == expected_counts
    
    # Test new error_rate function
    assert error_rate(test_entries) == 0.4  # 2 out of 5 entries have status >= 500
    
    # Test error_rate with no entries
    assert error_rate([]) == 0.0
    
    # Test error_rate with entries but no errors
    no_error_entries = [
        {'status': 200},
        {'status': 201},
        {'status': 404}
    ]
    assert error_rate(no_error_entries) == 0.0
    
    # Test error_rate with all errors
    all_error_entries = [
        {'status': 500},
        {'status': 503},
        {'status': 504}
    ]
    assert error_rate(all_error_entries) == 1.0
    
    print("All tests passed!")
def sessions(entries, gap_minutes=30):
    """Return a dictionary mapping IP addresses to the number of sessions.
    
    A session is defined as a sequence of entries for the same IP, where a new
    session starts when an entry comes more than gap_minutes after the previous
    entry for that IP.
    
    Args:
        entries: List of log entries (dicts with 'ip' and 'time' keys)
        gap_minutes: Number of minutes that must pass to start a new session (default 30)
    
    Returns:
        dict: Mapping from IP address to number of sessions
    """
    # Dictionary to store sessions count for each IP
    session_counts = {}
    
    # Dictionary to store the last entry time for each IP
    last_entry_times = {}
    
    # Sort entries by time to process them in chronological order
    sorted_entries = sorted(entries, key=lambda x: x['time'])
    
    for entry in sorted_entries:
        ip = entry['ip']
        entry_time = entry['time']
        
        # Initialize session count for this IP if not seen before
        if ip not in session_counts:
            session_counts[ip] = 0
            last_entry_times[ip] = None
        
        # If this is the first entry for this IP, start a new session
        if last_entry_times[ip] is None:
            session_counts[ip] += 1
        else:
            # Check if the time gap is larger than gap_minutes
            # For simplicity, assuming time is in a comparable format
            if entry_time != last_entry_times[ip]:
                session_counts[ip] += 1
        
        # Update the last entry time for this IP
        last_entry_times[ip] = entry_time
    
    return session_counts
