import sys
sys.path.append('.')

# Import the function from s2_logs.py
from s2_logs import by_hour

def test_by_hour():
    # Test data with various timestamps
    entries = [
        {'time': '10/Oct/2023:13:55:36 +0000', 'bytes': 100},
        {'time': '10/Oct/2023:13:56:00 +0000', 'bytes': 200},
        {'time': '10/Oct/2023:14:00:00 +0000', 'bytes': 300},
        {'time': '11/Oct/2023:09:30:00 +0000', 'bytes': 400},
        {'time': '11/Oct/2023:09:45:00 +0000', 'bytes': 500},
        {'time': '10/Oct/2023:13:55:36 +0000', 'bytes': 600},  # Duplicate timestamp
    ]
    
    # Test the by_hour function
    result = by_hour(entries)
    
    # Expected result: 
    # '2023-10-10 13' -> 100 + 200 + 600 = 900
    # '2023-10-10 14' -> 300
    # '2023-10-11 09' -> 400 + 500 = 900
    
    expected = {
        '2023-10-10 13': 900,  # 100 + 200 + 600
        '2023-10-10 14': 300,  # 300
        '2023-10-11 09': 900   # 400 + 500
    }
    
    print("Result:", result)
    print("Expected:", expected)
    
    assert result == expected, f"Expected {expected}, got {result}"
    print("Test passed!")

if __name__ == "__main__":
    test_by_hour()