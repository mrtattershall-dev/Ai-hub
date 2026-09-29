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
    parsed_lines = []
    bad_lines = []
    
    for i, line in enumerate(lines, start=1):
        if line.strip() == "":
            continue
        try:
            try:
                try:
                    parsed_line = parse_line(line)
                    parsed_lines.append(parsed_line)
                except ValueError as e:
                    bad_lines.append(i)
            except ValueError as e:
                bad_lines.append(i)
        except Exception as e:
            bad_lines.append(i)
    
    return parsed_lines, bad_lines

def bad_lines(text):
    _, bad_lines = parse_log(text)
    return bad_lines
