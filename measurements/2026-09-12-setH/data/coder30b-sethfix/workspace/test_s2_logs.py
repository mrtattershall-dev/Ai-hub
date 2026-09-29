#!/usr/bin/env python3

import sys
sys.path.append('.')

from s2_logs import parse_log, bad_lines, status_counts, error_rate, top_paths, by_hour

def test_parse_log():
    # Test data with some valid and invalid lines
    test_log = """127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 1234 0.123
127.0.0.2 - - [10/Oct/2023:13:55:37 +0000] "POST /login HTTP/1.1" 401 0 0.456
127.0.0.3 - - [10/Oct/2023:13:55:38 +0000] "GET /about HTTP/1.1" 200 5678 0.789
invalid line that should be skipped
127.0.0.4 - - [10/Oct/2023:13:55:39 +0000] "GET /contact HTTP/1.1" 200 9012 0.321

127.0.0.5 - - [10/Oct/2023:13:55:40 +0000] "GET /products HTTP/1.1" 200 3456 0.654
invalid line 2
"""
    
    result = parse_log(test_log)
    assert len(result) == 5, f"Expected 5 valid lines, got {len(result)}"
    
    # Check first entry
    assert result[0]['ip'] == '127.0.0.1'
    assert result[0]['method'] == 'GET'
    assert result[0]['path'] == '/index.html'  # Changed from 'url' to 'path'
    assert result[0]['status'] == 200
    assert result[0]['bytes'] == 1234
    
    # Check last entry
    assert result[4]['ip'] == '127.0.0.5'
    assert result[4]['method'] == 'GET'
    assert result[4]['path'] == '/products'  # Changed from 'url' to 'path'
    assert result[4]['status'] == 200
    assert result[4]['bytes'] == 3456

def test_bad_lines():
    test_log = """127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 1234 0.123
invalid line that should be skipped
127.0.0.3 - - [10/Oct/2023:13:55:38 +0000] "GET /about HTTP/1.1" 200 5678 0.789
invalid line 2

127.0.0.5 - - [10/Oct/2023:13:55:40 +0000] "GET /products HTTP/1.1" 200 3456 0.654
"""
    
    bad = bad_lines(test_log)
    # Line numbers are 1-based, so:
    # Line 1: valid
    # Line 2: invalid (1-based)
    # Line 3: valid
    # Line 4: invalid (1-based) 
    # Line 5: blank
    # Line 6: valid
    assert bad == [2, 4], f"Expected bad lines [2, 4], got {bad}"

def test_parse_log_all_valid():
    valid_log = """127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 1234 0.123
127.0.0.2 - - [10/Oct/2023:13:55:37 +0000] "POST /login HTTP/1.1" 401 0 0.456"""
    
    result = parse_log(valid_log)
    assert len(result) == 2, f"Expected 2 valid lines, got {len(result)}"
    
    bad = bad_lines(valid_log)
    assert bad == [], f"Expected no bad lines, got {bad}"

def test_empty_and_blank_lines():
    empty_log = ""
    
    result = parse_log(empty_log)
    assert len(result) == 0, f"Expected 0 valid lines for empty log, got {len(result)}"
    
    bad = bad_lines(empty_log)
    assert bad == [], f"Expected no bad lines for empty log, got {bad}"


def test_status_counts():
    # Test data with various status codes
    test_entries = [
        {'status': 200},
        {'status': 404},
        {'status': 200},
        {'status': 500},
        {'status': 404},
        {'status': 500},
        {'status': 503},
    ]
    
    result = status_counts(test_entries)
    expected = {200: 2, 404: 2, 500: 2, 503: 1}
    assert result == expected, f"Expected {expected}, got {result}"


def test_error_rate():
    # Test with entries that have various status codes
    test_entries = [
        {'status': 200},
        {'status': 404},
        {'status': 200},
        {'status': 500},
        {'status': 404},
        {'status': 500},
        {'status': 503},
    ]
    
    result = error_rate(test_entries)
    # 3 out of 7 entries have status >= 500 (500, 500, 503)
    # 3/7 = 0.428571... rounded to 4 decimals = 0.4286
    assert result == 0.4286, f"Expected 0.4286, got {result}"
    
    # Test with no entries
    result = error_rate([])
    assert result == 0.0, f"Expected 0.0, got {result}"
    
    # Test with all 500+ entries
    test_entries_500 = [
        {'status': 500},
        {'status': 503},
        {'status': 504},
    ]
    result = error_rate(test_entries_500)
    assert result == 1.0, f"Expected 1.0, got {result}"
    
    # Test with no 500+ entries
    test_entries_200 = [
        {'status': 200},
        {'status': 404},
        {'status': 301},
    ]
    result = error_rate(test_entries_200)
    assert result == 0.0, f"Expected 0.0, got {result}"


def test_status_counts_empty():
    result = status_counts([])
    assert result == {}, f"Expected empty dict, got {result}"
def test_top_paths():
    # Test data with various paths
    test_entries = [
        {'path': '/index.html'},
        {'path': '/about'},
        {'path': '/index.html'},
        {'path': '/contact'},
        {'path': '/about'},
        {'path': '/index.html'},
        {'path': '/products?category=electronics'},
        {'path': '/products?category=clothing'},
        {'path': '/products?sort=price'},
    ]
    
    result = top_paths(test_entries)
    expected = [('/index.html', 3), ('/about', 2), ('/contact', 1)]
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test with n=2
    result = top_paths(test_entries, n=2)
    expected = [('/index.html', 3), ('/about', 2)]
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test with ties - should sort by path
    test_entries_ties = [
        {'path': '/z'},
        {'path': '/a'},
        {'path': '/z'},
        {'path': '/a'},
        {'path': '/b'},
    ]
    
    result = top_paths(test_entries_ties)
    expected = [('/a', 2), ('/b', 1), ('/z', 2)]
    # Since /z and /a have same count, /a should come first (alphabetical)
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test with empty entries
    result = top_paths([])
    expected = []
    assert result == expected, f"Expected {expected}, got {result}"
def test_by_hour():
    # Test data with entries from different hours
    test_entries = [
        {'time': '01/Jan/1970:00:00:00 +0000', 'bytes': 100},
        {'time': '01/Jan/1970:00:30:00 +0000', 'bytes': 200},
        {'time': '01/Jan/1970:01:15:00 +0000', 'bytes': 300},
        {'time': '02/Jan/1970:00:45:00 +0000', 'bytes': 400},
        {'time': '01/Jan/1970:00:50:00 +0000', 'bytes': 500},
    ]
    
    result = by_hour(test_entries)
    expected = {
        '1970-01-01 00': 800,  # 100 + 200 + 500
        '1970-01-01 01': 300,  # 300
        '1970-01-02 00': 400   # 400
    }
    assert result == expected, f"Expected {expected}, got {result}"

def test_by_hour_empty():
    result = by_hour([])
    assert result == {}, f"Expected empty dict, got {result}"
