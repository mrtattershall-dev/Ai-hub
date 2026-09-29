from s2_logs import parse_log, between

def test_between():
    # Create test log entries
    log_text = '''127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045
192.168.1.1 - - [11/Oct/2023:14:00:00 +0000] "POST /api/data HTTP/1.1" 201 - 0.123
10.0.0.1 - - [09/Oct/2023:12:30:15 +0000] "GET /about HTTP/1.1" 200 1234 0.023
172.16.0.1 - - [12/Oct/2023:15:45:30 +0000] "GET /contact HTTP/1.1" 200 5678 0.067'''
    
    entries = parse_log(log_text)
    
    # Test filtering entries between specific times
    # Filter for entries between 2023-10-10 00:00:00 and 2023-10-11 23:59:59
    result = between(entries, "2023-10-10 00:00:00", "2023-10-11 23:59:59")
    
    # Should return the first two entries (10/Oct and 11/Oct)
    expected_count = 2
    print(f"Entries between 2023-10-10 00:00:00 and 2023-10-11 23:59:59: {len(result)}")
    
    # Check that the result contains the right entries
    if len(result) == expected_count:
        print("PASS: between function works correctly")
        return True
    else:
        print("FAIL: between function returned wrong number of entries")
        print(f"Expected {expected_count}, got {len(result)}")
        return False

if __name__ == "__main__":
    success = test_between()
    if success:
        print("All tests passed!")
    else:
        print("Some tests failed!")