#!/usr/bin/env python3

import sys
sys.path.append('.')

from q6_jpath import get

# Test data
data = {
    "a": {
        "b": [1, 2, {"c": "value"}]
    }
}

print("Testing q6_jpath get() function with default parameter...")

# Test 1: Path that exists - should return the value
try:
    result = get(data, "a.b.0")
    print(f"Test 1 - get(data, 'a.b.0'): {result} (expected: 1)")
    assert result == 1
    print("PASS: Test 1")
except Exception as e:
    print(f"FAIL: Test 1 - {e}")

# Test 2: Path that exists with default - should return the value
try:
    result = get(data, "a.b.2.c", "default_value")
    print(f"Test 2 - get(data, 'a.b.2.c', 'default_value'): {result} (expected: value)")
    assert result == "value"
    print("PASS: Test 2")
except Exception as e:
    print(f"FAIL: Test 2 - {e}")

# Test 3: Path that doesn't exist without default - should raise KeyError
try:
    result = get(data, "a.b.5")
    print(f"FAIL: Test 3 - Should have raised KeyError but got {result}")
except KeyError as e:
    print(f"Test 3 - get(data, 'a.b.5') raised KeyError as expected: {e}")
    print("PASS: Test 3")
except Exception as e:
    print(f"FAIL: Test 3 - Wrong exception type {type(e).__name__}: {e}")

# Test 4: Path that doesn't exist with default - should return default
try:
    result = get(data, "a.b.5", "default_value")
    print(f"Test 4 - get(data, 'a.b.5', 'default_value'): {result} (expected: default_value)")
    assert result == "default_value"
    print("PASS: Test 4")
except Exception as e:
    print(f"FAIL: Test 4 - {e}")

# Test 5: Non-existent key without default - should raise KeyError
try:
    result = get(data, "a.x")
    print(f"FAIL: Test 5 - Should have raised KeyError but got {result}")
except KeyError as e:
    print(f"Test 5 - get(data, 'a.x') raised KeyError as expected: {e}")
    print("PASS: Test 5")
except Exception as e:
    print(f"FAIL: Test 5 - Wrong exception type {type(e).__name__}: {e}")

# Test 6: Non-existent key with default - should return default
try:
    result = get(data, "a.x", "default_value")
    print(f"Test 6 - get(data, 'a.x', 'default_value'): {result} (expected: default_value)")
    assert result == "default_value"
    print("PASS: Test 6")
except Exception as e:
    print(f"FAIL: Test 6 - {e}")

print("\nAll tests completed!")
# Test the select function from q2_table
import sys
sys.path.append('.')

from q2_table import select

print("\nTesting q2_table select() function...")

# Test data
test_rows = [
    {"name": "John", "age": "25", "city": "New York"},
    {"name": "Jane", "age": "30", "city": "Los Angeles"}
]

# Test 1: Select existing columns in order
try:
    result = select(test_rows, ["name", "city"])
    expected = [
        {"name": "John", "city": "New York"},
        {"name": "Jane", "city": "Los Angeles"}
    ]
    print(f"Test 1 - select(rows, ['name', 'city']): {result}")
    assert result == expected
    print("PASS: Test 1")
except Exception as e:
    print(f"FAIL: Test 1 - {e}")

# Test 2: Select columns in different order
try:
    result = select(test_rows, ["city", "name"])
    expected = [
        {"city": "New York", "name": "John"},
        {"city": "Los Angeles", "name": "Jane"}
    ]
    print(f"Test 2 - select(rows, ['city', 'name']): {result}")
    assert result == expected
    print("PASS: Test 2")
except Exception as e:
    print(f"FAIL: Test 2 - {e}")

# Test 3: Select single column
try:
    result = select(test_rows, ["age"])
    expected = [
        {"age": "25"},
        {"age": "30"}
    ]
    print(f"Test 3 - select(rows, ['age']): {result}")
    assert result == expected
    print("PASS: Test 3")
except Exception as e:
    print(f"FAIL: Test 3 - {e}")

# Test 4: Non-existent column should raise KeyError
try:
    result = select(test_rows, ["name", "nonexistent"])
    print(f"FAIL: Test 4 - Should have raised KeyError but got {result}")
except KeyError as e:
    print(f"Test 4 - select(rows, ['name', 'nonexistent']) raised KeyError as expected: {e}")
    print("PASS: Test 4")
except Exception as e:
    print(f"FAIL: Test 4 - Wrong exception type {type(e).__name__}: {e}")

# Test 5: Empty rows should return empty list
try:
    result = select([], ["name"])
    expected = []
    print(f"Test 5 - select([], ['name']): {result}")
    assert result == expected
    print("PASS: Test 5")
except Exception as e:
    print(f"FAIL: Test 5 - {e}")

print("\nAll select tests completed!")
