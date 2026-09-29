#!/usr/bin/env python3

import s2_logs

def test_parse_log():
    # Test with valid log lines
    log_text = '''127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045
192.168.1.1 - - [11/Oct/2023:14:56:37 +0000] "POST /api/data HTTP/1.1" 201 - 0.123
invalid line format
10.0.0.1 - - [12/Oct/2023:15:57:38 +0000] "PUT /api/update HTTP/1.1" 204 512 0.089'''
    
    result = s2_logs.parse_log(log_text)
    
    # Should have 3 valid entries (skip blank line and invalid line)
    assert len(result) == 3, f"Expected 3 valid entries, got {len(result)}"
    
    # Check first entry
    assert result[0]['ip'] == '127.0.0.1'
    assert result[0]['method'] == 'GET'
    assert result[0]['path'] == '/index.html'
    assert result[0]['status'] == 200
    assert result[0]['bytes'] == 2326
    assert result[0]['seconds'] == 0.045
    
    # Check second entry
    assert result[1]['ip'] == '192.168.1.1'
    assert result[1]['method'] == 'POST'
    assert result[1]['path'] == '/api/data'
    assert result[1]['status'] == 201
    assert result[1]['bytes'] == 0  # "-" converted to 0
    assert result[1]['seconds'] == 0.123
    
    # Check third entry
    assert result[2]['ip'] == '10.0.0.1'
    assert result[2]['method'] == 'PUT'
    assert result[2]['path'] == '/api/update'
    assert result[2]['status'] == 204
    assert result[2]['bytes'] == 512
    assert result[2]['seconds'] == 0.089
    
    print("parse_log test passed!")

def test_bad_lines():
    # Test with mixed valid and invalid lines
    log_text = '''127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045
invalid line format
192.168.1.1 - - [11/Oct/2023:14:56:37 +0000] "POST /api/data HTTP/1.1" 201 - 0.123
another invalid line
   # blank line
10.0.0.1 - - [12/Oct/2023:15:57:38 +0000] "PUT /api/update HTTP/1.1" 204 512 0.089'''
    
    result = s2_logs.bad_lines(log_text)
    print(f"Bad lines result: {result}")
    
    # Let's understand what's happening:
    # Line 1: valid log line - should NOT be bad
    # Line 2: invalid line format - should be bad (line 2)
    # Line 3: valid log line - should NOT be bad
    # Line 4: another invalid line - should be bad (line 4)
    # Line 5: "   # blank line" - has content (spaces + #) so not blank, but doesn't match pattern - should be bad (line 5)
    # Line 6: valid log line - should NOT be bad
    
    # So bad lines should be [2, 4, 5]
    assert result == [2, 4, 5], f"Expected [2, 4, 5], got {result}"
    
    print("bad_lines test passed!")

def test_empty_and_blank_lines():
    # Test with empty and blank lines
    log_text = '''
127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045

192.168.1.1 - - [11/Oct/2023:14:56:37 +0000] "POST /api/data HTTP/1.1" 201 - 0.123

'''
    
    result = s2_logs.parse_log(log_text)
    assert len(result) == 2, f"Expected 2 valid entries, got {len(result)}"
    
    bad_result = s2_logs.bad_lines(log_text)
    assert bad_result == [], f"Expected empty list for bad lines, got {bad_result}"
    
    print("Empty/blank lines test passed!")

def test_status_counts():
    # Test status_counts function
    entries = [
        {'status': 200},
        {'status': 200},
        {'status': 404},
        {'status': 500},
        {'status': 500},
        {'status': 500}
    ]
    
    result = s2_logs.status_counts(entries)
    expected = {200: 2, 404: 1, 500: 3}
    
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test with empty list
    empty_result = s2_logs.status_counts([])
    assert empty_result == {}, f"Expected empty dict, got {empty_result}"
    
    print("status_counts test passed!")

def test_error_rate():
    # Test error_rate function
    entries = [
        {'status': 200},
        {'status': 200},
        {'status': 404},
        {'status': 500},
        {'status': 500},
        {'status': 500}
    ]
    
    result = s2_logs.error_rate(entries)
    # 3 out of 6 entries have status >= 500
    # 3/6 = 0.5
    assert result == 0.5, f"Expected 0.5, got {result}"
    
    # Test with all 200 status codes
    entries_200 = [
        {'status': 200},
        {'status': 200},
        {'status': 200}
    ]
    
    result_200 = s2_logs.error_rate(entries_200)
    assert result_200 == 0.0, f"Expected 0.0, got {result_200}"
    
    # Test with all 500 status codes
    entries_500 = [
        {'status': 500},
        {'status': 500},
        {'status': 500}
    ]
    
    result_500 = s2_logs.error_rate(entries_500)
    assert result_500 == 1.0, f"Expected 1.0, got {result_500}"
    
    # Test with empty list
    empty_result = s2_logs.error_rate([])
    assert empty_result == 0.0, f"Expected 0.0, got {empty_result}"
    
    # Test with status 499 (should not count as error)
    entries_499 = [
        {'status': 499},
        {'status': 200}
    ]
    
    result_499 = s2_logs.error_rate(entries_499)
    assert result_499 == 0.0, f"Expected 0.0, got {result_499}"
    
    print("error_rate test passed!")

if __name__ == "__main__":
    test_parse_log()
    test_bad_lines()
    test_empty_and_blank_lines()
    test_status_counts()
    test_error_rate()
    print("All tests passed!")
def test_top_paths():
    # Test top_paths function
    entries = [
        {'path': '/index.html'},
        {'path': '/about'},
        {'path': '/index.html'},
        {'path': '/contact'},
        {'path': '/index.html'},
        {'path': '/about'},
        {'path': '/api/data?param=value'},
        {'path': '/api/data?other=param'},
        {'path': '/api/data'},
    ]
    
    result = s2_logs.top_paths(entries)
    # After processing, we have:
    # '/index.html': 3 occurrences
    # '/about': 2 occurrences
    # '/contact': 1 occurrence  
    # '/api/data': 3 occurrences (from 3 entries with query strings)
    # Sorted by count desc, then path asc for ties
    # So: '/api/data' (3), '/index.html' (3), '/about' (2)
    expected = [('/api/data', 3), ('/index.html', 3), ('/about', 2)]
    
    # Check that we get the right paths and counts
    assert len(result) == 3, f"Expected 3 paths, got {len(result)}"
    
    # Check the first three (most frequent)
    assert result[0] == ('/api/data', 3), f"Expected ('/api/data', 3), got {result[0]}"
    assert result[1] == ('/index.html', 3), f"Expected ('/index.html', 3), got {result[1]}"
    assert result[2] == ('/about', 2), f"Expected ('/about', 2), got {result[2]}"
    
    # Check that query strings are ignored
    # Both '/api/data?param=value' and '/api/data?other=param' should count as '/api/data'
    
    # Test with n=2
    result_2 = s2_logs.top_paths(entries, n=2)
    assert len(result_2) == 2, f"Expected 2 paths, got {len(result_2)}"
    assert result_2[0] == ('/api/data', 3), f"Expected ('/api/data', 3), got {result_2[0]}"
    assert result_2[1] == ('/index.html', 3), f"Expected ('/index.html', 3), got {result_2[1]}"
    
    # Test with empty list
    empty_result = s2_logs.top_paths([])
    assert empty_result == [], f"Expected empty list, got {empty_result}"
    
    print("top_paths test passed!")

if __name__ == "__main__":
    test_parse_log()
    test_bad_lines()
    test_empty_and_blank_lines()
    test_status_counts()
    test_error_rate()
    test_top_paths()
    print("All tests passed!")
