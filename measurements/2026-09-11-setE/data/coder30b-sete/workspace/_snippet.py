import sys
sys.path.append('.')

from q8_units import format_quantity

# Test cases for format_quantity
test_cases = [
    (1.5, "cup", "1 1/2 cup"),
    (0.75, "tsp", "3/4 tsp"),
    (0.33, "tsp", "1/3 tsp"),
    (0.25, "cup", "1/4 cup"),
    (2, "cup", "2 cup"),
    (1.37, "kg", "1.37 kg"),
    (1.30, "kg", "1.3 kg"),
    (0.5, "cup", "1/2 cup"),
    (1.66, "cup", "2/3 cup"),
    (1.25, "cup", "1 1/4 cup"),
    (2.5, "cup", "2 1/2 cup"),
    (3.33, "cup", "1 1/3 cup"),
    (0.66, "cup", "2/3 cup"),
    (1.75, "cup", "1 3/4 cup"),
    (0.0, "cup", "0 cup"),
    (0.37, "kg", "0.37 kg"),
    (1.0, "kg", "1 kg"),
    (2.0, "kg", "2 kg"),
    (3.14, "kg", "3.14 kg"),
    (1.2, "kg", "1.2 kg"),
    (1.20, "kg", "1.2 kg"),
]

all_passed = True
for qty, unit, expected in test_cases:
    result = format_quantity(qty, unit)
    if result == expected:
        print(f"PASS: format_quantity({qty}, '{unit}') = '{result}'")
    else:
        print(f"FAIL: format_quantity({qty}, '{unit}') = '{result}' (expected: '{expected}')")
        all_passed = False

if all_passed:
    print("All tests passed!")
else:
    print("Some tests failed!")