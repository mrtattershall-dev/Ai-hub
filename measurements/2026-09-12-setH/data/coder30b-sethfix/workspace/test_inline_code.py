#!/usr/bin/env python3

import sys
sys.path.append('.')

from s4_markdown import to_html

# Test cases for inline code
test_cases = [
    # Basic inline code
    ("This is `code` in text", "<p>This is <code>code</code> in text</p>"),
    
    # Inline code with special characters
    ("Use `print('<hello>')` for debugging", "<p>Use <code>print('&lt;hello&gt;')</code> for debugging</p>"),
    
    # Inline code with emphasis markers inside
    ("This is `strong **text**` and `em *text*`", "<p>This is <code>strong **text**</code> and <code>em *text*</code></p>"),
    
    # Multiple inline codes
    ("Use `code1` and `code2`", "<p>Use <code>code1</code> and <code>code2</code></p>"),
    
    # Inline code at start and end
    ("`start` and end", "<p><code>start</code> and end</p>"),
    ("Start and `end`", "<p>Start and <code>end</code></p>"),
    
    # Heading with inline code
    ("# This is `heading` code", "<h1>This is <code>heading</code> code</h1>"),
    
    # Inline code with backticks inside
    ("Use `` `backticks` `` for literal backticks", "<p>Use <code>`backticks`</code> for literal backticks</p>"),
]

print("Testing inline code functionality...")
all_passed = True

for i, (input_text, expected) in enumerate(test_cases):
    result = to_html(input_text)
    if result == expected:
        print(f"Test {i+1}: PASS")
    else:
        print(f"Test {i+1}: FAIL")
        print(f"  Input:    {input_text}")
        print(f"  Expected: {expected}")
        print(f"  Got:      {result}")
        all_passed = False

if all_passed:
    print("\nAll tests passed!")
else:
    print("\nSome tests failed!")