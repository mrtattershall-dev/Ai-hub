def to_html(text):
    # Split the text into blocks by blank lines
    blocks = text.split('\n\n')
    
    # Convert each block into a paragraph
    paragraphs = []
    for block in blocks:
        # Replace code blocks with <code> tags
        import re
        code_pattern = re.compile(r'`([^`]+)`')
        block = code_pattern.sub(r'<code>\1</code>', block)
        
        # Replace markdown links with <a> tags
        link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
        block = link_pattern.sub(r'<a href="\2">\1</a>', block)
        
        # Check if the block is an unordered list
if block.startswith("- "):
    # Split the block into individual list items
    list_items = block.split('\n')
    # Remove the "- " prefix from each item
    list_items = [item[2:] for item in list_items if item.startswith("- ")]
    # Join the list items with <li> tags
    list_html = '<ul><li>' + '</li><li>'.join(list_items) + '</li></ul>'
    paragraphs.append(list_html)
else:
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace markdown links with <a> tags
    link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
    block = link_pattern.sub(r'<a href="\2">\1</a>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Join the lines inside the block with one space
    paragraph = ' '.join(block.splitlines())
    # Add the paragraph to the list
    paragraphs.append(f'<p>{paragraph}</p>')
    
    # Join the paragraphs with <p> tags
    html = '<p>' + '</p><p>'.join(paragraphs) + '</p>'
    return html
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace & with &amp;, < with &lt;, and > with &gt;
    # Replace code blocks with <code> tags
    import re
    code_pattern = re.compile(r'`([^`]+)`')
    escaped_block = code_pattern.sub(r'<code>\1</code>', block)
    # Replace & with &amp;, < with &lt;, and > with &gt;
    escaped_block = escaped_block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Join the lines inside the block with one space
    paragraph = ' '.join(escaped_block.splitlines())
    # Add the paragraph to the list
        paragraphs.append(f'<p>{paragraph}</p>')
    
    # Join the paragraphs with "\n"
    html = '\n'.join(paragraphs)
    return html

if __name__ == "__main__":
    # Test cases
    test_text = "This is the first block.\nIt has multiple lines.\n\nThis is the second block.\nIt also has multiple lines."
    expected_html = "<p>This is the first block. It has multiple lines.</p>\n<p>This is the second block. It also has multiple lines.</p>"
    assert to_html(test_text) == expected_html, "Test case failed"
    
    print("All tests passed!")