import html

def process_links(text):
    """Convert [text](url) to <a href="url">text</a>"""
    result = text
    i = 0
    while i < len(result) - 3:
        if result[i] == '[' and i + 1 < len(result):
            # Find the closing ]
            j = i + 1
            while j < len(result) and result[j] != ']':
                j += 1
            if j < len(result) and result[j] == ']':
                # Find the opening (
                k = j + 1
                if k < len(result) and result[k] == '(':
                    # Find the closing )
                    l = k + 1
                    while l < len(result) and result[l] != ')':
                        l += 1
                    if l < len(result) and result[l] == ')':
                        # Extract text and url
                        link_text = result[i+1:j]
                        url = result[k+1:l]
                        
                        # Escape quotes in URL
                        url = url.replace('"', '&quot;')
                        
                        # Replace [text](url) with <a href="url">text</a>
                        result = result[:i] + f'<a href="{url}">{link_text}</a>' + result[l+1:]
                        i += len(f'<a href="{url}">{link_text}</a>')
                    else:
                        # No closing ) found, keep as is
                        i += 1
                else:
                    # No opening ( found, keep as is
                    i += 1
            else:
                # No closing ] found, keep as is
                i += 1
        else:
            i += 1
    
    return result

def process_inline_code(text):
    """Convert `code` to <code>code</code>"""
    result = text
    i = 0
    while i < len(result) - 1:
        if result[i] == '`' and i + 1 < len(result):
            # Find the closing `
            j = i + 1
            while j < len(result) and result[j] != '`':
                j += 1
            if j < len(result) and result[j] == '`':
                # Replace `code` with <code>code</code>
                code_text = result[i+1:j]
                result = result[:i] + f"<code>{code_text}</code>" + result[j+1:]
                i += len(f"<code>{code_text}</code>")
            else:
                # No closing ` found, keep as is
                i += 1
        else:
            i += 1
    
    return result

def process_emphasis(text):
    """Convert **text** to <strong>text</strong> and *text* to <em>text</em>"""
    # Process bold (**text**) first to avoid conflicts
    result = text
    i = 0
    while i < len(result) - 3:
        if result[i:i+2] == '**' and i + 4 < len(result):
            # Find the closing **
            j = i + 2
            while j < len(result) and result[j:j+2] != '**':
                j += 1
            if j < len(result) and result[j:j+2] == '**':
                # Replace **text** with <strong>text</strong>
                bold_text = result[i+2:j]
                result = result[:i] + f"<strong>{bold_text}</strong>" + result[j+2:]
                i += len(f"<strong>{bold_text}</strong>")
            else:
                # No closing ** found, keep as is
                i += 2
        else:
            i += 1
    
    # Process italic (*text*)
    i = 0
    while i < len(result) - 1:
        if result[i] == '*' and i + 2 < len(result):
            # Find the closing *
            j = i + 1
            while j < len(result) and result[j] != '*':
                j += 1
            if j < len(result) and result[j] == '*':
                # Replace *text* with <em>text</em>
                italic_text = result[i+1:j]
                result = result[:i] + f"<em>{italic_text}</em>" + result[j+1:]
                i += len(f"<em>{italic_text}</em>")
            else:
                # No closing * found, keep as is
                i += 1
        else:
            i += 1
    
    return result

def to_html(text):
    if not text:
        return ""
    
    # Split into blocks by blank lines
    blocks = text.split('\n\n')
    
    # Process each block
    processed_blocks = []
    i = 0
    while i < len(blocks):
        block = blocks[i]
        if block.strip():  # Only process non-empty blocks
            # Check if the block is a heading (starts with 1-3 # characters followed by space)
            lines = block.split('\n')
            first_line = lines[0].strip()
            
            if first_line.startswith('# ') or first_line.startswith('## ') or first_line.startswith('### '):
                # This is a heading block
                if first_line.startswith('### '):
                    heading_level = 3
                    content = first_line[4:].strip()
                elif first_line.startswith('## '):
                    heading_level = 2
                    content = first_line[3:].strip()

if __name__ == "__main__":
    # Test cases
    assert to_html("") == ""
    assert to_html("Hello") == "<p>Hello</p>"
    assert to_html("Hello\n\nWorld") == "<p>Hello</p>\n<p>World</p>"
    assert to_html("Hello\nWorld") == "<p>Hello World</p>"
    assert to_html("Hello\n\nWorld\n\n") == "<p>Hello</p>\n<p>World</p>"
    assert to_html("Hello & World") == "<p>Hello &amp; World</p>"
    assert to_html("Hello < World") == "<p>Hello &lt; World</p>"
    assert to_html("Hello > World") == "<p>Hello &gt; World</p>"
    assert to_html("Hello & < > World") == "<p>Hello &amp; &lt; &gt; World</p>"
    print("All tests passed!")