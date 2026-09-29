#!/usr/bin/env python3
"""
Test the evaluate function directly
This is a Python version of the JavaScript test
"""

# Test cases for the evaluate function
test_cases = [
    '2*-3',
    '-(2+3)*2',
    '2+3',
    '-5'
]

print("Testing evaluate function directly:")

for test_case in test_cases:
    print(f"\nTesting: {test_case}")
    try:
        # Remove spaces
        expr = test_case.replace(' ', '')
        print(f"After removing spaces: {expr}")
        
        # Check for invalid characters
        if not all(c in '0123456789+-*/.() ' for c in expr):
            print("Invalid characters")
            continue
            
        # Check for invalid patterns
        if '++' in expr or '--' in expr or '**' in expr or '//':
            print("Invalid pattern")
            continue
            
        # Check for balanced parentheses
        paren_count = 0
        for i, char in enumerate(expr):
            if char == '(':
                paren_count += 1
            elif char == ')':
                paren_count -= 1
                if paren_count < 0:
                    print("Mismatched parentheses")
                    break
        else:
            if paren_count != 0:
                print("Mismatched parentheses")
                continue
                
        # Handle unary minus
        print(f"Before unary minus handling: {expr}")
        # This is a simplified version - in reality, the full evaluate function
        # would handle this properly
        print(f"After unary minus handling: {expr}")
        
        print(f"Final expression to evaluate: {expr}")
        
    except Exception as e:
        print(f"Error: {e}")