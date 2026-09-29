import sys
sys.path.append('.')

# Import the function to test
from s4_markdown import _process_links, to_html

# Test the _process_links function directly
test_text = "[text](url)"
print(f"Input: {test_text}")
result = _process_links(test_text)
print(f"Result from _process_links: {result}")

# Test the full to_html function
print(f"Full to_html result: {to_html(test_text)}")