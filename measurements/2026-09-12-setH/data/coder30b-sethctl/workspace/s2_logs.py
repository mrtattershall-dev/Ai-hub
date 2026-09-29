import re

def parse_line(line):
    # Pattern to match access-log format
    pattern = r'(\S+) - - \[(.*?)\] "(\S+) (\S+) (\S+)" (\d+) (\d+|-) (\d+\.\d+)'
    
    match = re.match(pattern, line)
    if not match:
        raise ValueError("Invalid log line format")
    
    ip, time, method, path, protocol, status, bytes_str, seconds = match.groups()
    
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
            parsed = parse_line(line)
            result.append(parsed)
        except ValueError:
            # Skip malformed lines
            continue
    
    return result

def bad_lines(text):
    """Return list of 1-based line numbers of malformed lines (excluding blank lines)."""
    lines = text.strip().split('\n')
    result = []
    
    for i, line in enumerate(lines):
        if not line.strip():  # Skip blank lines
            continue
        try:
            parse_line(line)
        except ValueError:
            # Record 1-based line number
            result.append(i + 1)
    
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
    """Return a list of (path, count) tuples, most requested first and ties by path.
    A query string does not count as part of the path ("/a?x=1" counts as "/a")."""
    # Count occurrences of each path
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
    # Test cases
    pass
def percentile(entries, p):
    """Return the p-th percentile of the seconds values by nearest rank.
    
    The p-th percentile is the smallest value such that at least p percent of 
    the values are less than or equal to it.
    
    Args:
        entries: List of log entry dictionaries, each with a 'seconds' key
        p: Percentile to compute (0 < p <= 100)
        
    Returns:
        The p-th percentile value as a float
        
    Raises:
        ValueError: If p is not in range (0, 100] or if entries is empty
    """
    if not entries:
        raise ValueError("No entries provided")
    
    if not (0 < p <= 100):
        raise ValueError("Percentile p must be in range (0, 100]")
    
    # Extract seconds values
    seconds_list = [entry['seconds'] for entry in entries]
    
    # Sort the values
    sorted_seconds = sorted(seconds_list)
    
    # Calculate the rank using nearest rank method
    # For p-th percentile, we want the smallest value such that at least p% 
    # of values are <= that value
    n = len(sorted_seconds)
    rank = (p / 100.0) * n
    
    # Using nearest rank method: find the smallest value such that at least 
    # p percent of values are less than or equal to it
    # This means we want the smallest index where the percentile rank is <= index
    # or we want the value at index ceil(rank) - 1 (0-indexed)
    import math
    index = math.ceil(rank) - 1
    
    # Clamp index to valid range
    index = max(0, min(index, n - 1))
    
    return sorted_seconds[index]
def by_hour(entries):
    """Return a dictionary mapping "YYYY-MM-DD HH" to total bytes for that hour.
    
    The time field is in format "01/Jan/1970:00:00:00 +0000".
    The key format is "YYYY-MM-DD HH" (24-hour format).
    """
    result = {}
    
    for entry in entries:
        # Extract time string from entry
        time_str = entry['time']
        
        # Parse the time string to extract date and hour
        # Format: "01/Jan/1970:00:00:00 +0000"
        # We want: "1970-01-01 00"
        date_part, time_part = time_str.split(':', 1)
        # Remove the timezone part (+0000)
        time_part = time_part.split(' ')[0]
        
        # Parse date part: "01/Jan/1970"
        day, month_str, year = date_part.split('/')
        
        # Convert month name to number
        months = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        }
        
        month = months[month_str]
        
        # Format date as YYYY-MM-DD
        date_formatted = f"{year}-{month}-{day}"
        
        # Format hour as HH
        hour = time_part.split(':')[0]
        
        # Create key in format "YYYY-MM-DD HH"
        key = f"{date_formatted} {hour}"
        
        # Add bytes to the total for this hour
        if key in result:
            result[key] += entry['bytes']
        else:
            result[key] = entry['bytes']
    
    return result
