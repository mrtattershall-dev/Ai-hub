import sys
sys.path.append('.')

# Import the function from s2_logs.py
from s2_logs import percentile

# Test cases
def test_percentile():
    # Test data
    entries = [
        {'seconds': 1.0},
        {'seconds': 2.0},
        {'seconds': 3.0},
        {'seconds': 4.0},
        {'seconds': 5.0}
    ]
    
    # Test 0 < p <= 100
    try:
        result = percentile(entries, 50)
        print(f"50th percentile: {result}")
        assert result == 3.0, f"Expected 3.0, got {result}"
        print("Test 1 passed: 50th percentile of [1,2,3,4,5] is 3.0")
    except Exception as e:
        print(f"Test 1 failed: {e}")
        return False
    
    # Test 25th percentile
    try:
        result = percentile(entries, 25)
        print(f"25th percentile: {result}")
        assert result == 2.0, f"Expected 2.0, got {result}"
        print("Test 2 passed: 25th percentile of [1,2,3,4,5] is 2.0")
    except Exception as e:
        print(f"Test 2 failed: {e}")
        return False
    
    # Test 75th percentile
    try:
        result = percentile(entries, 75)
        print(f"75th percentile: {result}")
        assert result == 4.0, f"Expected 4.0, got {result}"
        print("Test 3 passed: 75th percentile of [1,2,3,4,5] is 4.0")
    except Exception as e:
        print(f"Test 3 failed: {e}")
        return False
    
    # Test edge case: 100th percentile
    try:
        result = percentile(entries, 100)
        print(f"100th percentile: {result}")
        assert result == 5.0, f"Expected 5.0, got {result}"
        print("Test 4 passed: 100th percentile of [1,2,3,4,5] is 5.0")
    except Exception as e:
        print(f"Test 4 failed: {e}")
        return False
    
    # Test edge case: 1st percentile
    try:
        result = percentile(entries, 1)
        print(f"1st percentile: {result}")
        assert result == 1.0, f"Expected 1.0, got {result}"
        print("Test 5 passed: 1st percentile of [1,2,3,4,5] is 1.0")
    except Exception as e:
        print(f"Test 5 failed: {e}")
        return False
    
    # Test error case: empty entries
    try:
        percentile([], 50)
        print("Test 6 failed: Should have raised ValueError for empty entries")
        return False
    except ValueError as e:
        print(f"Test 6 passed: Correctly raised ValueError for empty entries: {e}")
    except Exception as e:
        print(f"Test 6 failed: Wrong exception type: {e}")
        return False
    
    # Test error case: p <= 0
    try:
        percentile(entries, 0)
        print("Test 7 failed: Should have raised ValueError for p=0")
        return False
    except ValueError as e:
        print(f"Test 7 passed: Correctly raised ValueError for p=0: {e}")
    except Exception as e:
        print(f"Test 7 failed: Wrong exception type: {e}")
        return False
    
    # Test error case: p > 100
    try:
        percentile(entries, 101)
        print("Test 8 failed: Should have raised ValueError for p=101")
        return False
    except ValueError as e:
        print(f"Test 8 passed: Correctly raised ValueError for p=101: {e}")
    except Exception as e:
        print(f"Test 8 failed: Wrong exception type: {e}")
        return False
    
    print("All tests passed!")
    return True

if __name__ == "__main__":
    test_percentile()