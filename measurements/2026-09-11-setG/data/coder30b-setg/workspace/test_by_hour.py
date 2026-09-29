import s2_logs

# Test data as provided in the goal
log_data = '''127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045
192.168.1.1 - - [10/Oct/2023:13:56:36 +0000] "POST /api/data HTTP/1.1" 201 1024 0.123
10.0.0.1 - - [10/Oct/2023:14:00:00 +0000] "GET /about HTTP/1.1" 200 1234 0.056'''

# Parse the log data
entries = s2_logs.parse_log(log_data)

# Test the by_hour function
result = s2_logs.by_hour(entries)
print("Result:", result)

# Expected result based on the sample data:
# - [10/Oct/2023:13:55:36 +0000] -> 2326 bytes
# - [10/Oct/2023:13:56:36 +0000] -> 1024 bytes  
# - [10/Oct/2023:14:00:00 +0000] -> 1234 bytes
# Expected output should be:
# {'2023-10-10 13': 3350, '2023-10-10 14': 1234}

expected = {'2023-10-10 13': 3350, '2023-10-10 14': 1234}
print("Expected:", expected)

# Check if they match
if result == expected:
    print("Test PASSED")
else:
    print("Test FAILED")
    print("Difference:")
    for key in set(result.keys()) | set(expected.keys()):
        if key not in result:
            print(f"  Missing key in result: {key}")
        elif key not in expected:
            print(f"  Extra key in result: {key}")
        elif result[key] != expected[key]:
            print(f"  Mismatch for {key}: got {result[key]}, expected {expected[key]}")

# Test the between function
print("\nTesting between function:")
start_time = "2023-10-10 13:55:00"
end_time = "2023-10-10 14:00:00"
between_result = s2_logs.between(entries, start_time, end_time)
print("Between result:", between_result)

# Expected result should include entries from 13:55:36 and 13:56:36 but not 14:00:00
# Since we're looking for start <= t < end, the 14:00:00 entry should be excluded
expected_between = [
    {'ip': '127.0.0.1', 'time': '10/Oct/2023:13:55:36 +0000', 'method': 'GET', 'path': '/index.html', 'status': 200, 'bytes': 2326, 'seconds': 0.045},
    {'ip': '192.168.1.1', 'time': '10/Oct/2023:13:56:36 +0000', 'method': 'POST', 'path': '/api/data', 'status': 201, 'bytes': 1024, 'seconds': 0.123}
]

print("Expected between result:", expected_between)

# Check if they match
if between_result == expected_between:
    print("Between test PASSED")
else:
    print("Between test FAILED")
# Test the sessions function
print("\nTesting sessions function:")
test_entries = [
    {'ip': '127.0.0.1', 'time': '10/Oct/2023:13:55:36 +0000', 'method': 'GET', 'path': '/index.html', 'status': 200, 'bytes': 2326, 'seconds': 0.045},
    {'ip': '192.168.1.1', 'time': '10/Oct/2023:13:56:36 +0000', 'method': 'POST', 'path': '/api/data', 'status': 201, 'bytes': 1024, 'seconds': 0.123},
    {'ip': '127.0.0.1', 'time': '10/Oct/2023:14:00:00 +0000', 'method': 'GET', 'path': '/about', 'status': 200, 'bytes': 1234, 'seconds': 0.056}
]
sessions_result = s2_logs.sessions(test_entries)
print("Sessions result:", sessions_result)

# Expected result should be:
# - 127.0.0.1: 2 sessions (first entry at 13:55:36, second at 14:00:00 - gap > 30 minutes)
# - 192.168.1.1: 1 session (only one entry)
expected_sessions = {'127.0.0.1': 2, '192.168.1.1': 1}
print("Expected sessions result:", expected_sessions)

# Check if they match
if sessions_result == expected_sessions:
    print("Sessions test PASSED")
else:
    print("Sessions test FAILED")
