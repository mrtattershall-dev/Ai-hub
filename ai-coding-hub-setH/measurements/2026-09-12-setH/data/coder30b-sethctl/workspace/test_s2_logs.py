#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from s2_logs import parse_log, bad_lines, status_counts, error_rate, top_paths, percentile

def test_parse_log():
    # Test with valid log lines
    valid_log = """192.168.1.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 1234 0.123
192.168.1.2 - - [10/Oct/2023:13:55:37 +0000] "POST /login HTTP/1.1" 200 5678 0.456"""
    
    result = parse_log(valid_log)
    assert len(result) == 2
    assert result[0]['ip'] == '192.168.1.1'
    assert result[0]['method'] == 'GET'
    assert result[0]['path'] == '/index.html'
    assert result[0]['status'] == 200
    assert result[0]['bytes'] == 1234
    assert result[0]['seconds'] == 0.123
    
    assert result[1]['ip'] == '192.168.1.2'
    assert result[1]['method'] == 'POST'
    assert result[1]['path'] == '/login'
    assert result[1]['status'] == 200
    assert result[1]['bytes'] == 5678
    assert result[1]['seconds'] == 0.456
    
    print("✓ parse_log with valid lines works")

def test_parse_log_with_blanks_and_malformed():
    # Test with blank lines and malformed lines
    mixed_log = """192.168.1.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 1234 0.123

192.168.1.2 - - [10/Oct/2023:13:55:37 +0000] "POST /login HTTP/1.1" 200 5678 0.456
This is a malformed line
192.168.1.3 - - [10/Oct/2023:13:55:38 +0000] "PUT /update HTTP/1.1" 200 9012 0.789

Invalid line format
192.168.1.4 - - [10/Oct/2023:13:55:39 +0000] "DELETE /delete HTTP/1.1" 200 3456 0.012"""
    
    result = parse_log(mixed_log)
    # Should only parse 3 valid lines, skipping blanks and malformed lines
    assert len(result) == 4
    
    # Check that the valid lines are parsed correctly
    assert result[0]['ip'] == '192.168.1.1'
    assert result[1]['ip'] == '192.168.1.2'
    assert result[2]['ip'] == '192.168.1.3'
    assert result[3]['ip'] == '192.168.1.4'
    
    print("✓ parse_log with blanks and malformed lines works")

def test_bad_lines():
    # Test bad_lines function
    mixed_log = """192.168.1.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 1234 0.123

192.168.1.2 - - [10/Oct/2023:13:55:37 +0000] "POST /login HTTP/1.1" 200 5678 0.456
This is a malformed line
192.168.1.3 - - [10/Oct/2023:13:55:38 +0000] "PUT /update HTTP/1.1" 200 9012 0.789

Invalid line format
192.168.1.4 - - [10/Oct/2023:13:55:39 +0000] "DELETE /delete HTTP/1.1" 200 3456 0.012"""
    
    result = bad_lines(mixed_log)
    # Should return line numbers 4 and 7 (1-based) for the malformed lines
    assert result == [4, 7]
    
    print("✓ bad_lines works correctly")

def test_empty_input():
    # Test with empty input
    result = parse_log("")
    assert result == []
    
    result = bad_lines("")
    assert result == []
    
    print("✓ Empty input handled correctly")

def test_status_counts():
    # Test status_counts function
    entries = [
        {'status': 200},
        {'status': 404},
        {'status': 200},
        {'status': 500},
        {'status': 404},
        {'status': 200}
    ]
    
    result = status_counts(entries)
    expected = {200: 3, 404: 2, 500: 1}
    assert result == expected
    
    print("✓ status_counts works correctly")

def test_error_rate():
    # Test error_rate function
    # Test with entries that have some 500+ errors
    entries = [
        {'status': 200},
        {'status': 404},
        {'status': 200},
        {'status': 500},
        {'status': 404},
        {'status': 200}
    ]
    
    result = error_rate(entries)
    # 1 error (500) out of 6 entries = 1/6 = 0.1667
    assert result == 0.1667
    
    # Test with all 200s
    entries = [
        {'status': 200},
        {'status': 200},
        {'status': 200}
    ]
    
    result = error_rate(entries)
    assert result == 0.0
    
    # Test with all 500s
    entries = [
        {'status': 500},
        {'status': 500},
        {'status': 500}
    ]
    
    result = error_rate(entries)
    assert result == 1.0
    
    # Test with empty list
    result = error_rate([])
    assert result == 0.0
    
    print("✓ error_rate works correctly")

def test_top_paths():
    # Test top_paths function
    # Create test entries with various paths
    entries = [
        {'path': '/index.html'},
        {'path': '/about'},
        {'path': '/index.html'},
        {'path': '/contact'},
        {'path': '/index.html'},
        {'path': '/about'},
        {'path': '/api/users?format=json'},
        {'path': '/api/users?version=2'},
        {'path': '/api/users?format=json'},
        {'path': '/login'},
    ]
    
    # Test default n=3
    result = top_paths(entries)
    expected = [('/index.html', 3), ('/about', 2), ('/api/users', 2)]
    assert result == expected
    
    # Test n=2
    result = top_paths(entries, n=2)
    expected = [('/index.html', 3), ('/about', 2)]
    assert result == expected
    
    # Test n=5
    result = top_paths(entries, n=5)
    expected = [('/index.html', 3), ('/about', 2), ('/api/users', 2), ('/contact', 1), ('/login', 1)]
    assert result == expected
    
    # Test with empty entries
    result = top_paths([])
    expected = []
    assert result == expected
    
    print("✓ top_paths works correctly")

if __name__ == "__main__":
    test_parse_log()
    test_parse_log_with_blanks_and_malformed()
    test_bad_lines()
    test_empty_input()
    test_status_counts()
    test_error_rate()
    test_top_paths()
    print("All tests passed!")
def test_percentile():
    # Test percentile function
    entries = [
        {'seconds': 1.0},
        {'seconds': 2.0},
        {'seconds': 3.0},
        {'seconds': 4.0},
        {'seconds': 5.0}
    ]
    
    # Test 25th percentile - should be 2.0 (value at index 1)
    result = percentile(entries, 25)
    assert result == 2.0
    
    # Test 50th percentile - should be 3.0 (median)
    result = percentile(entries, 50)
    assert result == 3.0
    
    # Test 75th percentile - should be 4.0 (value at index 3)
    result = percentile(entries, 75)
    assert result == 4.0
    
    # Test 100th percentile - should be 5.0 (maximum)
    result = percentile(entries, 100)
    assert result == 5.0
    
    # Test 1st percentile - should be 1.0 (minimum)
    result = percentile(entries, 1)
    assert result == 1.0
    
    # Test with duplicate values
    entries_with_duplicates = [
        {'seconds': 1.0},
        {'seconds': 1.0},
        {'seconds': 2.0},
        {'seconds': 3.0},
        {'seconds': 3.0}
    ]
    
    # 50th percentile with duplicates - should be 2.0
    result = percentile(entries_with_duplicates, 50)
    assert result == 2.0
    
    # 75th percentile with duplicates - should be 3.0
    result = percentile(entries_with_duplicates, 75)
    assert result == 3.0
    
    # Test edge case: single entry
    single_entry = [{'seconds': 42.0}]
    result = percentile(single_entry, 50)
    assert result == 42.0
    
    # Test error cases
    try:
        percentile([], 50)
        assert False, "Should have raised ValueError for empty entries"
    except ValueError:
        pass  # Expected
    
    try:
        percentile(entries, 0)
        assert False, "Should have raised ValueError for p=0"
    except ValueError:
        pass  # Expected
    
    try:
        percentile(entries, 101)
        assert False, "Should have raised ValueError for p>100"
    except ValueError:
        pass  # Expected
    
    print("✓ percentile works correctly")

if __name__ == "__main__":
    test_parse_log()
    test_parse_log_with_blanks_and_malformed()
    test_bad_lines()
    test_empty_input()
    test_status_counts()
    test_error_rate()
    test_top_paths()
    test_percentile()
    print("All tests passed!")
def test_by_hour():
    # Test by_hour function
    entries = [
        {'time': '01/Jan/1970:00:00:00 +0000', 'bytes': 100},
        {'time': '01/Jan/1970:00:05:00 +0000', 'bytes': 200},
        {'time': '01/Jan/1970:01:00:00 +0000', 'bytes': 300},
        {'time': '02/Jan/1970:00:00:00 +0000', 'bytes': 400},
        {'time': '01/Jan/1970:00:30:00 +0000', 'bytes': 500},
    ]
    
    result = by_hour(entries)
    expected = {
        '1970-01-01 00': 800,  # 100 + 200 + 500
        '1970-01-01 01': 300,  # 300
        '1970-01-02 00': 400   # 400
    }
    assert result == expected
    
    # Test with empty entries
    result = by_hour([])
    assert result == {}
    
    print("✓ by_hour works correctly")

# Import the by_hour function
from s2_logs import by_hour
