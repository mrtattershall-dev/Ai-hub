import re

def to_html(text):
    # First, handle inline code by replacing `code` with <code>code</code>
    # We need to be careful to not process emphasis inside code blocks
    # Process code blocks first, then emphasis, then escape
    def process_inline_code(text):
        # Find all code blocks (text between backticks)
        # We'll use a different approach: replace all code blocks with placeholders, process emphasis, then restore
        code_blocks = []
        def replace_code(match):
            code_content = match.group(1)
            # Escape special characters in code content
            escaped_code = code_content.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            # Store the code block for later restoration
            code_blocks.append(f'<code>{escaped_code}</code>')
            return f'__CODE_PLACEHOLDER_{len(code_blocks)-1}__'
        
        # Find all code blocks (text between backticks)
        processed_text = re.sub(r'`(.*?)`', replace_code, text)
        # Now restore the code blocks
        for i, code_block in enumerate(code_blocks):
            processed_text = processed_text.replace(f'__CODE_PLACEHOLDER_{i}__', code_block, 1)
        return processed_text
    
    # Split text into blocks separated by blank lines
    blocks = text.split('\n\n')
    
    # Process each block
    processed_blocks = []
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
                
                # Process inline code first
                content = process_inline_code(content)
                
                # Process emphasis in content
                content = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', content)
                content = re.sub(r'\*(.*?)\*', r'<em>\1</em>', content)
                
                # Escape special characters in content (but don't double-escape HTML entities)
                # First, unescape any existing HTML entities to avoid double-escaping
                unescaped_content = content.replace('&amp;', '&')
                # Then escape special characters, but don't escape the <code> tags
                # We'll do this by temporarily replacing <code> tags with placeholders
                temp_placeholders = []
                def replace_code_tags(text):
                    # Find all <code> tags and replace them with placeholders
                    pattern = r'<code>(.*?)</code>'
                    def replace_func(match):
                        temp_placeholders.append(match.group(0))
                        return f'__TEMP_CODE_TAG_{len(temp_placeholders)-1}__'
                    return re.sub(pattern, replace_func, text)
                
                # Apply the replacement
                temp_content = replace_code_tags(unescaped_content)
                # Now escape the remaining special characters
                escaped_content = temp_content.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                # Restore the <code> tags
                for i, tag in enumerate(temp_placeholders):
                    escaped_content = escaped_content.replace(f'__TEMP_CODE_TAG_{i}__', tag, 1)
                processed_blocks.append(f'<h{level}>{escaped_content}</h{level}>')
            else:
                # Join lines within block with single spaces
                lines = block.split('\n')
                joined_line = ' '.join(lines)
                # Process inline code first
                joined_line = process_inline_code(joined_line)
                # Process emphasis in paragraph content
                joined_line = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', joined_line)
                joined_line = re.sub(r'\*(.*?)\*', r'<em>\1</em>', joined_line)
                # Escape special characters, but don't escape the <code> tags
                # We'll do this by temporarily replacing <code> tags with placeholders
                temp_placeholders = []
                def replace_code_tags(text):
                    # Find all <code> tags and replace them with placeholders
                    pattern = r'<code>(.*?)</code>'
                    def replace_func(match):
                        temp_placeholders.append(match.group(0))
                        return f'__TEMP_CODE_TAG_{len(temp_placeholders)-1}__'
                    return re.sub(pattern, replace_func, text)
                
                # Apply the replacement
                temp_content = replace_code_tags(joined_line)
                # Now escape the remaining special characters
                escaped_content = temp_content.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                # Restore the <code> tags
                for i, tag in enumerate(temp_placeholders):
                    escaped_content = escaped_content.replace(f'__TEMP_CODE_TAG_{i}__', tag, 1)
                processed_blocks.append(escaped_content)
    
    # Join blocks with "\n"
    return '\n'.join(processed_blocks)

if __name__ == "__main__":
    # Test cases
    assert to_html("Hello\nWorld") == "Hello World"
    assert to_html("Hello\n\nWorld") == "Hello\nWorld"
    assert to_html("Hello\n&\nWorld") == "Hello &amp; World"
    assert to_html("Hello\n<\nWorld") == "Hello &lt; World"
    assert to_html("Hello\n>\nWorld") == "Hello &gt; World"
    assert to_html("Hello\n&\nWorld\n\nFoo\nBar") == "Hello &amp; World\nFoo Bar"
    print("All tests passed!")