#!/usr/bin/env python3

import sys
sys.path.insert(0, '.')

from s4_markdown import toc

def test_toc():
    # Test basic functionality
    text = """# Heading 1
## Heading 2
### Heading 3
# Another Heading 1"""
    
    result = toc(text)
    expected = [
        (1, "Heading 1", "heading-1"),
        (2, "Heading 2", "heading-2"),
        (3, "Heading 3", "heading-3"),
        (1, "Another Heading 1", "another-heading-1")
    ]
    
    assert result == expected, f"Expected {expected}, got {result}"
    print("Basic test passed!")
    
    # Test duplicate slugs
    text2 = """# Title
## Title
### Title"""
    
    result2 = toc(text2)
    expected2 = [
        (1, "Title", "title"),
        (2, "Title", "title-2"),
        (3, "Title", "title-3")
    ]
    
    assert result2 == expected2, f"Expected {expected2}, got {result2}"
    print("Duplicate slug test passed!")
    
    # Test special characters in title
    text3 = """# Hello, World!
## Test & More"""
    
    result3 = toc(text3)
    expected3 = [
        (1, "Hello, World!", "hello-world"),
        (2, "Test & More", "test-more")
    ]
    
    assert result3 == expected3, f"Expected {expected3}, got {result3}"
    print("Special characters test passed!")
    
    print("All tests passed!")

if __name__ == "__main__":
    test_toc()