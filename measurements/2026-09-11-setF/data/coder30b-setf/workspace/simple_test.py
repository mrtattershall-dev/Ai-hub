#!/usr/bin/env python3

import sys
sys.path.append('.')

from s4_markdown import to_html

# Test blockquote functionality
print("Testing blockquote functionality...")

# Test simple blockquote
result = to_html("> This is a quote")
expected = "<blockquote>This is a quote</blockquote>"
print("Simple blockquote:")
print("Result:   " + result)
print("Expected: " + expected)
print("PASS" if result == expected else "FAIL")

# Test multi-line blockquote
result = to_html("> First line\n> Second line")
expected = "<blockquote>First line Second line</blockquote>"
print("\nMulti-line blockquote:")
print("Result:   " + result)
print("Expected: " + expected)
print("PASS" if result == expected else "FAIL")

# Test blockquote with emphasis
result = to_html("> This is *italic* text")
expected = "<blockquote>This is <em>italic</em> text</blockquote>"
print("\nBlockquote with emphasis:")
print("Result:   " + result)
print("Expected: " + expected)
print("PASS" if result == expected else "FAIL")

print("\nBlockquote tests completed.")