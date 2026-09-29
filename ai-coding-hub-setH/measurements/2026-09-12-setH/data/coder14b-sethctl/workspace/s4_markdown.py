def to_html(text):
    import re

    def convert_link(match):
        url = match.group(2)
        text = match.group(1)
        return '<a href="{}">{}</a>'.format(url.replace('"', '&quot;'), text)

    link_pattern = re.compile(r'\[(.*?)\]\((.*?)\)')
    return link_pattern.sub(convert_link, text)
    # Split the text into blocks by blank lines
    blocks = text.split('\n\n')
    
    # Convert each block to a paragraph and escape special characters
    paragraphs = []
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
# Check for headings
if block.startswith('#'):
    heading_level = min(len(block) - len(block.lstrip('#')), 3)
    heading_text = block.lstrip('#').strip()
    paragraphs.append(f'<h{heading_level}>{heading_text}</h{heading_level}>')
else:
    escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    paragraph = ' '.join(escaped_block.splitlines())
    paragraphs.append(f'<p>{paragraph}</p>')
        escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        # Join the lines in the block with one space
        paragraph = ' '.join(escaped_block.splitlines())
        # Add the paragraph to the list
        paragraphs.append(f'<p>{paragraph}</p>')
    
    # Join the paragraphs with a newline
    return '\n'.join(paragraphs)

if __name__ == "__main__":
    # Test cases
    test_text = "This is a block.\n\nThis is another block.\nIt has multiple lines."
    expected_html = "<p>This is a block.</p>\n<p>This is another block. It has multiple lines.</p>"
    assert to_html(test_text) == expected_html, "Test case failed"
    
    print("All tests passed!")