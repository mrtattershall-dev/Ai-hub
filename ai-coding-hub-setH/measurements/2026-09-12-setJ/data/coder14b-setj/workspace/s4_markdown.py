def to_html(text):
    # Escape special characters
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    # Split text into lines
    lines = text.split('\n')
    blocks = []

    current_block = []
    for line in lines:
        if line.startswith('#'):
            if current_block:
                blocks.append(' '.join(current_block))
                current_block = []
            # Determine the heading level
            level = min(3, line.count('#'))
            heading_text = line[level:].strip()
            blocks.append(f'<h{level}>{heading_text}</h{level}>')
        else:
            current_block.append(line)

    if current_block:
        blocks.append(' '.join(current_block))
    
    # Convert each block to a paragraph
    paragraphs = ['<p>' + ' '.join(block.split('\n')) + '</p>' for block in blocks]
    
    # Join all paragraphs with newline
    return '\n'.join(paragraphs)

if __name__ == "__main__":
    # Test cases
    test_text = "This is the first block.\nIt has multiple lines.\n\nThis is the second block.\nIt also has multiple lines."
    expected_output = "<p>This is the first block. It has multiple lines.</p>\n<p>This is the second block. It also has multiple lines.</p>"
    assert to_html(test_text) == expected_output, "Test case failed"