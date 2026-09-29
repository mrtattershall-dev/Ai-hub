import re

def to_html(text):
    # Split text into lines
    lines = text.split('\n')
    result = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Check if this line starts with "- " (unordered list item)
        if line.startswith("- "):
            # Collect all consecutive list items
            list_items = []
            j = i
            while j < len(lines) and lines[j].startswith("- "):
                # Remove the "- " prefix and process inline formatting
                item_text = lines[j][2:]  # Remove "- "
                
                # Apply inline formatting to the item text
                # First, process code blocks
                def replace_code(match):
                    code_content = match.group(1)
                    # Escape HTML characters in code content
                    code_content = code_content.replace("&", "&amp;")
                    code_content = code_content.replace("<", "&lt;")
                    code_content = code_content.replace(">", "&gt;")
                    return f"<code>{code_content}</code>"
                
                item_text = re.sub(r'`([^`]+)`', replace_code, item_text)
                
                # Process strong emphasis (**text**) - handle unmatched pairs properly
                def replace_strong(match):
                    return f"<strong>{match.group(1)}</strong>"
                
                # Process emphasis (*text*) - handle unmatched pairs properly
                def replace_em(match):
                    return f"<em>{match.group(1)}</em>"
                
                # Process strong emphasis first to avoid conflicts
                item_text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', item_text)
                # Then, replace *text* patterns
                item_text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', item_text)
                
                # Process links [text](url) -> <a href="url">text</a>
                def replace_link(match):
                    text = match.group(1)
                    url = match.group(2)
                    # Escape HTML characters in text
                    text = text.replace("&", "&amp;")
                    text = text.replace("<", "&lt;")
                    text = text.replace(">", "&gt;")
                    # Escape double quotes in text
                    text = text.replace('"', '&quot;')
                    # Escape double quotes in URL
                    url = url.replace('"', '&quot;')
                    return f'<a href="{url}">{text}</a>'
                
                # Replace links with proper pattern matching
                item_text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', replace_link, item_text)
                
                list_items.append(f"<li>{item_text}</li>")
                j += 1
            
            # Add the complete unordered list to result
            result.append("<ul>" + "".join(list_items) + "</ul>")
            i = j
        # Check if this line starts with a number followed by ". " (ordered list item)
        elif re.match(r'^\d+\.\s', line):
            # Collect all consecutive ordered list items
            list_items = []
            j = i
            while j < len(lines) and re.match(r'^\d+\.\s', lines[j]):
                # Remove the number and ". " prefix and process inline formatting
                item_text = lines[j][lines[j].find(". ") + 2:]  # Remove "number. "
                
                # Apply inline formatting to the item text
                # First, process code blocks
                def replace_code(match):
                    code_content = match.group(1)
                    # Escape HTML characters in code content
                    code_content = code_content.replace("&", "&amp;")
                    code_content = code_content.replace("<", "&lt;")
                    code_content = code_content.replace(">", "&gt;")
                    return f"<code>{code_content}</code>"
                
                item_text = re.sub(r'`([^`]+)`', replace_code, item_text)
                
                # Process strong emphasis (**text**) - handle unmatched pairs properly
                def replace_strong(match):
                    return f"<strong>{match.group(1)}</strong>"
                
                # Process emphasis (*text*) - handle unmatched pairs properly
                def replace_em(match):
                    return f"<em>{match.group(1)}</em>"
                
                # Process strong emphasis first to avoid conflicts
                item_text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', item_text)
                # Then, replace *text* patterns
                item_text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', item_text)
                
                # Process links [text](url) -> <a href="url">text</a>
                def replace_link(match):
                    text = match.group(1)
                    url = match.group(2)
                    # Escape HTML characters in text
                    text = text.replace("&", "&amp;")
                    text = text.replace("<", "&lt;")
                    text = text.replace(">", "&gt;")
                    # Escape double quotes in text
                    text = text.replace('"', '&quot;')
                    # Escape double quotes in URL
                    url = url.replace('"', '&quot;')
                    return f'<a href="{url}">{text}</a>'
                
                # Replace links with proper pattern matching
                item_text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', replace_link, item_text)
                
                list_items.append(f"<li>{item_text}</li>")
                j += 1
            
            # Add the complete ordered list to result
            result.append("<ol>" + "".join(list_items) + "</ol>")
            i = j
        else:
            # Handle regular paragraphs
            # Apply inline formatting to the line
            # First, process code blocks
            def replace_code(match):
                code_content = match.group(1)
                # Escape HTML characters in code content
                code_content = code_content.replace("&", "&amp;")
                code_content = code_content.replace("<", "&lt;")
                code_content = code_content.replace(">", "&gt;")
                return f"<code>{code_content}</code>"
            
            line = re.sub(r'`([^`]+)`', replace_code, line)
            
            # Process strong emphasis (**text**) - handle unmatched pairs properly
            def replace_strong(match):
                return f"<strong>{match.group(1)}</strong>"
            
            # Process emphasis (*text*) - handle unmatched pairs properly
            def replace_em(match):
                return f"<em>{match.group(1)}</em>"
            
            # Process strong emphasis first to avoid conflicts
            line = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', line)
            # Then, replace *text* patterns
            line = re.sub(r'\*(.*?)\*', r'<em>\1</em>', line)
            
            # Process links [text](url) -> <a href="url">text</a>
            def replace_link(match):
                text = match.group(1)
                url = match.group(2)
                # Escape HTML characters in text
                text = text.replace("&", "&amp;")
                text = text.replace("<", "&lt;")
                text = text.replace(">", "&gt;")
                # Escape double quotes in text
                text = text.replace('"', '&quot;')
                # Escape double quotes in URL
                url = url.replace('"', '&quot;')
                return f'<a href="{url}">{text}</a>'
            
            # Replace links with proper pattern matching
            line = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', replace_link, line)
            
            # Add paragraph tag
            result.append(f"<p>{line}</p>")
            i += 1
    
    return "\n".join(result)