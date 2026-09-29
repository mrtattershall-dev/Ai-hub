import re

def to_html(text):
    # Split text into blocks separated by blank lines
    blocks = text.split('\n\n')
    
    # Process each block
    processed_blocks = []
    for block in blocks:
        if block.strip():  # Only process non-empty blocks
            # Check if block is a heading (starts with 1-3 # followed by space)
            lines = block.split('\n')
            if len(lines) == 1 and re.match(r'^#{1,3} .+', lines[0]):
                # This is a heading line
                heading_line = lines[0]
                # Extract the level (number of #) and content
                match = re.match(r'^(#{1,3}) (.+)$', heading_line)
                if match:
                    level = len(match.group(1))
                    content = match.group(2)
                    # Escape HTML characters in content
                    escaped_content = content.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    processed_blocks.append(f'<h{level}>{escaped_content}</h{level}>')
            else:
                # Join lines within block with single space
                joined_line = ' '.join(lines)
                # Escape HTML characters
                escaped_line = joined_line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                processed_blocks.append(escaped_line)
    
    # Join blocks with newline
    return '\n'.join(processed_blocks)

if __name__ == "__main__":
    # Test cases
    assert to_html("Hello\nWorld") == "Hello World"
    assert to_html("Hello\n\nWorld") == "Hello\nWorld"
    assert to_html("Hello\nWorld\n\nFoo\nBar") == "Hello World\nFoo Bar"
    assert to_html("A & B < C > D") == "A &amp; B &lt; C &gt; D"
    assert to_html("A & B\n\nC < D") == "A &amp; B\nC &lt; D"
    # Test heading functionality
    assert to_html("# Hello") == "<h1>Hello</h1>"
    assert to_html("## World") == "<h2>World</h2>"
    assert to_html("### Test") == "<h3>Test</h3>"
    assert to_html("# Heading\n\nNormal text") == "<h1>Heading</h1>\nNormal text"
    assert to_html("Normal text\n\n# Heading") == "Normal text\n<h1>Heading</h1>"
    print("All tests passed!")