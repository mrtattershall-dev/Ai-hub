#!/usr/bin/env python3

# Import the to_html function from s4_markdown.py
import sys
sys.path.append('.')
from s4_markdown import to_html

def test_links_only():
    print("Testing link functionality only...")
    
    # Test the exact examples from the goal
    test_cases = [
        ("[text](url)", '<a href="url">text</a>'),
        ("[text](http://example.com)", '<a href="http://example.com">text</a>'),
        ("[link with \"quotes\"](http://example.com/path?param=\"value\")", '<a href="http://example.com/path?param=&quot;value&quot;">link with &quot;quotes&quot;</a>')
    ]
    
    all_passed = True
    for i, (input_text, expected) in enumerate(test_cases):
        result = to_html(input_text)
        if result == expected:
            print(f"Test {i+1}: PASS - {input_text} -> {result}")
        else:
            print(f"Test {i+1}: FAIL")
            print(f"  Input:    {input_text}")
            print(f"  Expected: {expected}")
            print(f"  Got:      {result}")
            all_passed = False
    
    # Test more complex cases
    complex_cases = [
        ("Text with [link](http://example.com)", 'Text with <a href="http://example.com">link</a>'),
        ("Text [link](url) and [another](http://example.com)", 'Text <a href="url">link</a> and <a href="http://example.com">another</a>')
    ]
    
    print("\nTesting complex cases...")
    for i, (input_text, expected) in enumerate(complex_cases):
        result = to_html(input_text)
        if result == expected:
            print(f"Complex Test {i+1}: PASS - {input_text} -> {result}")
        else:
            print(f"Complex Test {i+1}: FAIL")
            print(f"  Input:    {input_text}")
            print(f"  Expected: {expected}")
            print(f"  Got:      {result}")
            all_passed = False
    
    # Test ordered list functionality
    ordered_list_cases = [
        ("1. First item\n2. Second item\n3. Third item", "<ol><li>First item</li><li>Second item</li><li>Third item</li></ol>"),
        ("1. Item with **bold** text\n2. Item with *italic* text\n3. Item with [link](http://example.com)", "<ol><li>Item with <strong>bold</strong> text</li><li>Item with <em>italic</em> text</li><li>Item with <a href=\"http://example.com\">link</a></li></ol>"),
        ("1. First\n- Unordered\n2. Second", "<ol><li>First</li></ol>\n<ul><li>Unordered</li></ul>\n<ol><li>Second</li></ol>")
    ]
    
    print("\nTesting ordered list functionality...")
    for i, (input_text, expected) in enumerate(ordered_list_cases):
        result = to_html(input_text)
        if result == expected:
            print(f"Ordered list test {i+1}: PASS - {input_text} -> {result}")
        else:
            print(f"Ordered list test {i+1}: FAIL")
            print(f"  Input:    {input_text}")
            print(f"  Expected: {expected}")
            print(f"  Got:      {result}")
            all_passed = False
    
    if all_passed:
        print("\nAll link tests passed!")
        return True
    else:
        print("\nSome tests failed!")
        return False

if __name__ == "__main__":
    test_links_only()