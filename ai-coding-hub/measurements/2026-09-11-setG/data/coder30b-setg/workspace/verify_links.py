#!/usr/bin/env python3

# Test the specific functionality requested in the goal
import sys
sys.path.append('.')
from s4_markdown import to_html

def test_goal_requirements():
    print("Testing goal requirements:")
    print("Convert [text](url) to <a href=\"url\">text</a> with double quotes in URLs escaped to &quot;")
    print()
    
    # Test cases from the goal
    test_cases = [
        # Basic case
        ("[text](url)", '<a href="url">text</a>'),
        
        # URL with double quotes (should be escaped)
        ('[text](http://example.com/path?param="value")', '<a href="http://example.com/path?param=&quot;value&quot;">text</a>'),
        
        # Multiple links
        ("Text [link](url) and [another](http://example.com)", 'Text <a href="url">link</a> and <a href="http://example.com">another</a>'),
        
        # Complex URL with existing ampersands and quotes
        ('[link with &amp;](http://example.com/path?param=value&amp;other=1)', '<a href="http://example.com/path?param=value&amp;other=1">link with &amp;</a>'),
        
        # Link with quotes in text (this is the tricky part - should be escaped)
        ('[link with "quotes"](http://example.com)', '<a href="http://example.com">link with &quot;quotes&quot;</a>'),
    ]
    
    all_passed = True
    for i, (input_text, expected) in enumerate(test_cases):
        result = to_html(input_text)
        if result == expected:
            print(f"PASS Test {i+1}")
            print(f"  Input:    {input_text}")
            print(f"  Expected: {expected}")
            print(f"  Got:      {result}")
        else:
            print(f"FAIL Test {i+1}")
            print(f"  Input:    {input_text}")
            print(f"  Expected: {expected}")
            print(f"  Got:      {result}")
            all_passed = False
        print()
    
    if all_passed:
        print("All goal requirements satisfied!")
        return True
    else:
        print("Some requirements not met")
        return False

if __name__ == "__main__":
    test_goal_requirements()