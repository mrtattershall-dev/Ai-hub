import re

def to_html(text):
    if not text:
        return ""
    
    # Split into blocks by blank lines
    blocks = []
    current_block = []
    
    for line in text.splitlines():
        if line.strip() == "":
            if current_block:
                blocks.append(" ".join(current_block))
                current_block = []
        else:
            current_block.append(line)
    
    # Don't forget the last block if it exists
    if current_block:
        blocks.append(" ".join(current_block))
    
    # Process each block to handle headings
    processed_blocks = []
    for block in blocks:
        # Check if this block is a heading (starts with 1-3 # followed by space)
        if block.startswith('# ') or block.startswith('## ') or block.startswith('### '):
            # Extract the heading level (1, 2, or 3)
            level = 0
            for i, char in enumerate(block):
                if char == '#':
                    level += 1
                elif char == ' ':
                    break
                else:
                    break
            
            # Extract the heading text (everything after the # and space)
            heading_text = block[level + 1:].strip()
            
            # Escape HTML characters in the heading text
            heading_text = heading_text.replace("&", "&amp;")
            heading_text = heading_text.replace("<", "&lt;")
            heading_text = heading_text.replace(">", "&gt;")
            
            # Convert to appropriate HTML heading tag
            processed_blocks.append(f"<h{level}>{heading_text}</h{level}>")
        else:
            # Escape HTML characters in regular text blocks
            escaped_block = block.replace("&", "&amp;")
            escaped_block = escaped_block.replace("<", "&lt;")
            escaped_block = escaped_block.replace(">", "&gt;")
            processed_blocks.append(escaped_block)
    
    # Process emphasis formatting (**text** -> <strong>text</strong>, *text* -> <em>text</em>)
    final_blocks = []
    for block in processed_blocks:
        # Process strong emphasis (**text**) - handle unmatched pairs properly
        # Replace all **text** patterns that are properly matched
        # We need to be very careful about the pattern matching to avoid
        # incorrectly matching unmatched asterisks
        # First, replace **text** patterns - ensure we have proper pairs
        # We'll use a more conservative approach
        block = re.sub(r'\*\*(?!\*)([^*]*?)\*\*(?!\*)', r'<strong>\1</strong>', block)
        # Then, replace *text* patterns - ensure we have proper pairs
        block = re.sub(r'(?<!\*)\*(?!\*)([^*]*?)(?<!\*)\*(?!\*)', r'<em>\1</em>', block)
        
        final_blocks.append(block)
    
    # Join blocks with newlines
    result = "\n".join(final_blocks)
    
    return result

if __name__ == "__main__":
    # Test cases
    assert to_html("") == ""
    assert to_html("Hello") == "Hello"
    assert to_html("Hello\n\nWorld") == "Hello\nWorld"
    assert to_html("Hello\nWorld") == "Hello World"
    assert to_html("Hello\n\nWorld\n\n") == "Hello\nWorld"
    assert to_html("A & B < C > D") == "A &amp; B &lt; C &gt; D"
    assert to_html("Line 1\nLine 2\n\nLine 3\nLine 4") == "Line 1 Line 2\nLine 3 Line 4"
    # Additional test cases for headings
    assert to_html("# Heading 1") == "<h1>Heading 1</h1>"
    assert to_html("## Heading 2") == "<h2>Heading 2</h2>"
    assert to_html("### Heading 3") == "<h3>Heading 3</h3>"
    assert to_html("# Heading 1 with & special < chars >") == "<h1>Heading 1 with &amp; special &lt; chars &gt;</h1>"
    assert to_html("Some text\n\n# Heading 1\n\nMore text") == "Some text\n<h1>Heading 1</h1>\nMore text"

    # Test cases for emphasis
    assert to_html("**bold text**") == "<strong>bold text</strong>"
    assert to_html("*italic text*") == "<em>italic text</em>"
    assert to_html("This is **bold** and *italic* text") == "This is <strong>bold</strong> and <em>italic</em> text"
    assert to_html("**bold** and *italic* and **bold again**") == "<strong>bold</strong> and <em>italic</em> and <strong>bold again</strong>"
    assert to_html("Text with no emphasis") == "Text with no emphasis"
    assert to_html("Text with **unmatched * asterisk") == "Text with **unmatched * asterisk"
    assert to_html("Text with *unmatched ** asterisk") == "Text with *unmatched ** asterisk"
    assert to_html("Text with **double ** asterisk") == "Text with **double ** asterisk"
    assert to_html("Text with *double * asterisk") == "Text with *double * asterisk"
    
    print("All tests passed!")