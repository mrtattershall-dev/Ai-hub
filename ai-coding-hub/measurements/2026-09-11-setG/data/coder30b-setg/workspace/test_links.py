#!/usr/bin/env python3

# Import the to_html function from s4_markdown.py
import sys
sys.path.append('.')
from s4_markdown import to_html

def test_links():
    # Test cases for links
    test_cases = [
        ("[text](url)", '<a href="url">text</a>'),
        ("Text with [link](http://example.com)", 'Text with <a href="http://example.com">link</a>'),
        ("[link](http://example.com/path?param=value)", '<a href="http://example.com/path?param=value">link</a>'),
        ("[link with &amp;](http://example.com/path?param=value&amp;other=1)", '<a href="http://example.com/path?param=value&amp;other=1">link with &amp;</a>'),
        ("[link with \"quotes\"](http://example.com/path?param=\"value\")", '<a href="http://example.com/path?param=&quot;value&quot;">link with &quot;quotes&quot;</a>'),
        ("Text [link](url) and [another](http://example.com)", 'Text <a href="url">link</a> and <a href="http://example.com">another</a>')
    ]
    
    print("Testing link functionality...")
    for i, (input_text, expected) in enumerate(test_cases):
        result = to_html(input_text)
        if result == expected:
            print(f"Test {i+1}: PASS - {input_text} -> {result}")
        else:
            print(f"Test {i+1}: FAIL")
            print(f"  Input:    {input_text}")
            print(f"  Expected: {expected}")
            print(f"  Got:      {result}")
            return False
    
    print("All link tests passed!")
    return True

if __name__ == "__main__":
    test_links()