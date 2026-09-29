from s4_markdown import process_links

# Test what process_links returns
test_input = "[text](url)"
result = process_links(test_input)
print(f"Input: {test_input}")
print(f"Output from process_links: {result}")
print(f"Type: {type(result)}")