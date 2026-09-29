#!/usr/bin/env python3

import sys
sys.path.append('.')

from q8_units import parse_quantity

def test_parse_quantity():
    # Test cases from the goal
    test_cases = [
        ('2 kg', (2.0, 'kg')),
        ('0.5 l', (0.5, 'l')),
        ('3/4 cup', (0.75, 'cup')),
        ('1 1/2 cups', (1.5, 'cup')),
    ]
    
    for text, expected in test_cases:
        try:
            result = parse_quantity(text)
            print(f"parse_quantity('{text}') = {result}")
            assert result == expected, f"Expected {expected}, got {result}"
        except Exception as e:
            print(f"Error parsing '{text}': {e}")
            raise
    
    # Test error cases
    error_cases = [
        'invalid',
        '5 xyz',
        '1/0',
        'abc kg',
    ]
    
    for text in error_cases:
        try:
            result = parse_quantity(text)
            print(f"ERROR: parse_quantity('{text}') should have failed but returned {result}")
            assert False, f"Should have raised ValueError for '{text}'"
        except ValueError:
            print(f"parse_quantity('{text}') correctly raised ValueError")
        except Exception as e:
            print(f"Unexpected error parsing '{text}': {e}")
            raise
    
    print("All tests passed!")

if __name__ == "__main__":
    test_parse_quantity()
# Test the format_quantity function
from q8_units import format_quantity

def test_format_quantity():
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
    
    for qty, unit, expected in test_cases:
        result = format_quantity(qty, unit)
        print(f"format_quantity({qty}, '{unit}') = '{result}' (expected: '{expected}')")
        assert result == expected, f"Expected '{expected}', got '{result}'"
    
    print("All format_quantity tests passed!")

if __name__ == "__main__":
    test_parse_quantity()
    test_format_quantity()
