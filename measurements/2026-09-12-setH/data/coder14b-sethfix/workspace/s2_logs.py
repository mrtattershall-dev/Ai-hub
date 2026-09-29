import re

def parse_line(line):
    # Define the regex pattern for the log line
    pattern = r'(\S+) - - \[(.*?)\] "(GET|POST|PUT|DELETE) (\S+)" (\d+) (\d+|-) (\d+\.\d+)'
    
    # Match the line against the pattern
    match = re.match(pattern, line)
    
    if not match:
        raise ValueError("Line does not match the expected format")
    
    # Extract the fields from the match
    ip = match.group(1)
    time = match.group(2)
    method = match.group(3)
    path = match.group(4)
    status = int(match.group(5))
    bytes = int(match.group(6)) if match.group(6) != '-' else 0
    seconds = float(match.group(7))
    
    # Return the parsed data as a dictionary
    return {
        'ip': ip,
        'time': time,
        'method': method,
        'path': path,
        'status': status,
        'bytes': bytes,
        'seconds': seconds
    }

if __name__ == "__main__":
    # Test cases
    test_line = '127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045'
    try:
        parsed = parse_line(test_line)
        assert parsed == {
            'ip': '127.0.0.1',
            'time': '10/Oct/2023:13:55:36 +0000',
            'method': 'GET',
            'path': '/index.html',
            'status': 200,
            'bytes': 2326,
            'seconds': 0.045
        }
        print("Test passed")
    except AssertionError:
        print("Test failed")
    except ValueError as e:
        print(f"ValueError: {e}")
def parse_log(text):
    lines = text.splitlines()
    parsed_logs = []
    for line_number, line in enumerate(lines, start=1):
        try:
            parsed_line = parse_line(line)
            if parsed_line:
                parsed_logs.append(parsed_line)
                print(f"Parsed line {line_number}: {parsed_line}")
        except Exception as e:
            print(f"Error parsing line {line_number}: {e}")
            continue
    return parsed_logs
def status_counts(entries):
    status_dict = {}
    for entry in entries:
        status = entry.get('status')
        if status in status_dict:
            status_dict[status] += 1
        else:
            status_dict[status] = 1
    return status_dict

def error_rate(entries):
    if not entries:
        return 0.0
    error_count = sum(1 for entry in entries if entry.get('status', 0) >= 500)
    return round(error_count / len(entries), 4)

def bad_lines(text):
    pass

def percentile(entries, p):
    if not 0 < p <= 100:
        raise ValueError("p must be between 0 and 100")
    if not entries:
        raise ValueError("There must be at least one value")
    
    sorted_entries = sorted(entries, key=lambda x: x['seconds'])
    index = int(len(sorted_entries) * (p / 100))
    return sorted_entries[index]['seconds']

def top_paths(entries, n=3):
    path_counts = {}
    for entry in entries:
        path = entry.split()[1].split('?')[0]  # Extract path and remove query string
        if path in path_counts:
            path_counts[path] += 1
        else:
            path_counts[path] = 1

    # Sort by count and then by path
    sorted_paths = sorted(path_counts.items(), key=lambda x: (-x[1], x[0]))

    return sorted_paths[:n]
    lines = text.splitlines()
    malformed_lines = []
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            print(f"Blank line at line {line_number}")
        elif not parse_line(line):
            print(f"Malformed line at line {line_number}: {line}")
            malformed_lines.append(line_number)
    return malformed_lines
