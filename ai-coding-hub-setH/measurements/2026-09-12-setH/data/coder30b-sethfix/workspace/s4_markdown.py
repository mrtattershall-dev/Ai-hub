def process_inline_code(text):
    """
    Convert markdown inline code syntax to HTML.
    `code` becomes <code>code</code>.
    Code content is escaped like everything else.
    Emphasis markers inside code are not processed.
    """
    import re
    
    # Find all inline code patterns (backticks)
    def replace_code(match):
        code_content = match.group(1)
        # Escape special characters in code content
        code_content = code_content.replace('&', '&amp;')
        code_content = code_content.replace('<', '&lt;')
        code_content = code_content.replace('>', '&gt;')
        return f'<code>{code_content}</code>'
    
    # Use regex to find and replace inline code
    # This pattern matches backticks and captures content between them
    pattern = r'`([^`]+)`'
    result = re.sub(pattern, replace_code, text)
    return result


def to_html(text):
    """
    Convert markdown text to HTML paragraphs.
    Blocks separated by blank lines become <p>...</p> paragraphs.
    Lines inside a block are joined with one space.
    Blocks are joined with "\\n".
    Characters &, < and > are escaped as &amp;, &lt; and &gt;.
    Lines that start with 1-3 # characters and a space become <h1>, <h2> or <h3> tags.
    **text** becomes <strong>text</strong> and *text* becomes <em>text</em>.
    `code` becomes <code>code</code>.
    [text](url) becomes <a href="url">text</a>.
    """
    # Split text into blocks by blank lines
    blocks = text.split('\n\n')
    
    # Process each block
    paragraphs = []
    for block in blocks:
        if block.strip():  # Only process non-empty blocks
            # Check if block is a heading (starts with 1-3 # followed by space)
            if block.startswith('# ') or block.startswith('## ') or block.startswith('### '):
                # Extract the heading level and content
                if block.startswith('### '):
                    level = 3
                    content = block[4:]
                elif block.startswith('## '):
                    level = 2
                    content = block[3:]
                else:  # block.startswith('# ')
                    level = 1
                    content = block[2:]
                
                # Process links first (before inline code and emphasis)
                content = _process_links(content)
                
                # Process inline code first (before emphasis)
                content = process_inline_code(content)
                
                # Process emphasis before escaping special characters
                content = process_emphasis(content)
                
                # Escape special characters in content
                content = content.replace('&', '&amp;')
                content = content.replace('<', '&lt;')
                content = content.replace('>', '&gt;')
                
                # Wrap in heading tags
                paragraphs.append(f'<h{level}>{content}</h{level}>')
            else:
                # Join lines within block with single spaces
                lines = block.split('\n')
                content = ' '.join(lines)
                
                # Process links first (before inline code and emphasis)
                content = _process_links(content)
                
                # Process inline code first (before emphasis)
                content = process_inline_code(content)
                
                # Process emphasis before escaping special characters
                content = process_emphasis(content)
                
                # Escape special characters
                content = _escape_html(content)
                
                # Wrap in paragraph tags
                paragraphs.append(f'<p>{content}</p>')
    
    # Join paragraphs with newlines
    return '\n'.join(paragraphs)

def _process_links(text):
    """
    Convert markdown links [text](url) to HTML <a href="url">text</a>.
    Handle escaped quotes in URLs by converting " to &quot;.
    """
    import re
    
    def replace_link(match):
        text = match.group(1)
        url = match.group(2)
        # Escape quotes in URL
        url = url.replace('"', '&quot;')
        # Escape special characters in text
        text = text.replace('&', '&amp;')
        text = text.replace('<', '&lt;')
        text = text.replace('>', '&gt;')
        return f'<a href="{url}">{text}</a>'
    
    # Pattern to match [text](url) - be careful with nested brackets
    # This regex looks for [text](url) where text and url don't contain ] or )
    pattern = r'\[([^\]]*)\]\(([^)]*)\)'
    return re.sub(pattern, replace_link, text)


def process_emphasis(text):
    """
    Convert markdown emphasis syntax to HTML.
    **text** becomes <strong>text</strong>
    *text* becomes <em>text</em>
    Markers without a partner stay as they are.
    """
    # Process strong emphasis (**text**)
    result = text
    i = 0
    while i < len(result) - 1:
        if result[i] == '*' and result[i+1] == '*':
            # Find the matching closing **
            j = i + 2
            while j < len(result) and not (result[j] == '*' and j + 1 < len(result) and result[j+1] == '*'):
                j += 1
            if j < len(result) and result[j] == '*' and result[j+1] == '*':
                # Found matching **
                strong_text = result[i+2:j]
                result = result[:i] + f'<strong>{strong_text}</strong>' + result[j+2:]
            else:
                # No matching closing ** - leave as is
                i += 2
        elif result[i] == '*' and i + 1 < len(result):
            # Find the matching closing *
            j = i + 1
            while j < len(result) and result[j] != '*':
                j += 1
            if j < len(result) and result[j] == '*':
                # Found matching *
                em_text = result[i+1:j]
                result = result[:i] + f'<em>{em_text}</em>' + result[j+1:]
            else:
                # No matching closing * - leave as is
                i += 1
        else:
            i += 1
    return result


if __name__ == "__main__":
    # Test cases
    assert to_html("Hello world") == "<p>Hello world</p>"
    assert to_html("Hello\nworld") == "<p>Hello world</p>"
    assert to_html("Hello\n\nworld") == "<p>Hello</p>\n<p>world</p>"
    assert to_html("Hello & world") == "<p>Hello &amp; world</p>"
    assert to_html("Hello < world") == "<p>Hello &lt; world</p>"
    assert to_html("Hello > world") == "<p>Hello &gt; world</p>"
    assert to_html("Hello\n&\nworld") == "<p>Hello &amp; world</p>"
    assert to_html("Hello\n<\nworld") == "<p>Hello &lt; world</p>"
    assert to_html("Hello\n>\nworld") == "<p>Hello &gt; world</p>"
    assert to_html("") == ""
    assert to_html("\n\n\n") == ""
    assert to_html("A\n\nB\n\nC") == "<p>A</p>\n<p>B</p>\n<p>C</p>"
    
    print("All tests passed!")