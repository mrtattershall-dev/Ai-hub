#!/usr/bin/env python3

import sys
sys.path.append('.')

from s4_markdown import to_html

# Test blockquote functionality
def test_blockquotes():
    # Test simple blockquote
    result = to_html("> This is a quote")
    expected = "<blockquote>This is a quote</blockquote>"
    print(f"Simple blockquote:")
    print(f"Result:   {result}")
    print(f"Expected: {expected}")
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test multi-line blockquote
    result = to_html("> First line\n> Second line")
    expected = "<blockquote>First line Second line</blockquote>"
    print(f"\nMulti-line blockquote:")
    print(f"Result:   {result}")
    print(f"Expected: {expected}")
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test blockquote with emphasis
    result = to_html("> This is *italic* text")
    expected = "<blockquote>This is <em>italic</em> text</blockquote>"
    print(f"\nBlockquote with emphasis:")
    print(f"Result:   {result}")
    print(f"Expected: {expected}")
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test blockquote with links
    result = to_html("> This is [a link](http://example.com)")
    expected = '<blockquote>This is <a href="http://example.com">a link</a></blockquote>'
    print(f"\nBlockquote with link:")
    print(f"Result:   {result}")
    print(f"Expected: {expected}")
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test mixed content (blockquote and paragraph)
    result = to_html("> This is a quote\n\nThis is a paragraph")
    expected = "<blockquote>This is a quote</blockquote>\n<p>This is a paragraph</p>"
    print(f"\nMixed content:")
    print(f"Result:   {result}")
    print(f"Expected: {expected}")
    assert result == expected, f"Expected {expected}, got {result}"
    
    print("\nAll blockquote tests passed!")

if __name__ == "__main__":
    test_blockquotes()