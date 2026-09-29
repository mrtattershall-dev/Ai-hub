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
    for i, line in enumerate(lines, 1):
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
    
    Returns 0.0 when there are no entries.
    """
    if not entries:
        return 0.0
    
    error_count = 0
    for entry in entries:
        if entry['status'] >= 500:
            error_count += 1
    
    return round(error_count / len(entries), 4)


def top_paths(entries, n=3):
    """Return a list of (path, count) tuples for the most requested paths.
    
    Paths with query strings are stripped of the query part.
    Results are sorted by count (descending) and then by path (ascending) for ties.
    """
    # Count paths
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
    
    # Sort by count (descending) then by path (ascending)
    sorted_paths = sorted(path_counts.items(), key=lambda x: (-x[1], x[0]))
    
    # Return top n
    return sorted_paths[:n]


def percentile(entries, p):
    """Return the p-th percentile of the seconds values by nearest rank.
    
    The smallest value such that at least p percent of the values are less than or equal to it.
    Raises ValueError unless 0 < p <= 100 and there is at least one value.
    """
    if not entries:
        raise ValueError("No entries provided")
    
    if not (0 < p <= 100):
        raise ValueError("p must be greater than 0 and less than or equal to 100")
    
    # Extract seconds values
    seconds_values = [entry['seconds'] for entry in entries]
    
    # Sort the values
    sorted_values = sorted(seconds_values)
    
    # Calculate the index using nearest rank method
    # For p-th percentile, we want the smallest value such that at least p% of values are <= it
    # This is equivalent to finding the smallest value at or after index (p/100 * (n-1))
    n = len(sorted_values)
    index = (p / 100.0) * (n - 1)
    
    # For nearest rank, we want the smallest value such that at least p% of values are <= it
    # This means we take the smallest index such that the percentile rank is <= p
    # So we use floor of the index (but we need to be careful about the edge case)
    import math
    rank_index = int(math.floor(index))
    
    # Ensure the index is within bounds
    if rank_index >= n:
        rank_index = n - 1
    
    return sorted_values[rank_index]
def by_hour(entries):
    """Return a dictionary mapping "YYYY-MM-DD HH" to total bytes for that hour.
    
    The time field is in the format "01/Jan/1970:00:00:00 +0000".
    The returned keys are in the format "YYYY-MM-DD HH".
    """
    result = {}
    
    for entry in entries:
        # Extract time from the entry
        time_str = entry['time']
        
        # Parse the time string to extract date and hour
        # Format: "01/Jan/1970:00:00:00 +0000"
        # We want to extract "01/Jan/1970:00" and convert to "YYYY-MM-DD HH"
        date_part, time_part = time_str.split(':', 1)
        hour_part = time_part.split(':', 1)[0]  # Get just the hour part
        
        # Format the date part: "01/Jan/1970" -> "1970-01-01"
        day, month_str, year = date_part.split('/')
        month_names = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        }
        month = month_names[month_str]
        formatted_date = f"{year}-{month}-{day}"
        
        # Combine to form the key: "YYYY-MM-DD HH"
        key = f"{formatted_date} {hour_part}"
        
        # Add bytes to the total for this hour
        if key in result:
            result[key] += entry['bytes']
        else:
            result[key] = entry['bytes']
    
    return result
