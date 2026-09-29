# Test 3: Find all values that are equal to a specific value
import sys
sys.path.append('.')
from q6_jpath import find

try:
    test_data = {
        "a": {
            "b": [1, 2, {"c": "value"}]
        },
        "d": 42,
        "e": "string"
    }
    result = find(test_data, lambda x: x == "value")
    expected = ["a.b.2.c"]
    print(f"Test 3 - find(data, lambda x: x == 'value'): {result}")
    assert result == expected
    print("PASS: Test 3 passed")
except Exception as e:
    print(f"FAIL: Test 3 failed: {e}")