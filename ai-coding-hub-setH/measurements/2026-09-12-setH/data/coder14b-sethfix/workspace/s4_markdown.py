def to_html(text):
    # Escape special characters
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    
    # Convert markdown links to HTML
    import re
    pattern = r'\[([^\]]+)\]\(([^)]+)\)'
    text = re.sub(pattern, r'<a href="\2">\1</a>', text)
    
    # Split text into blocks
    blocks = text.split('\n\n')
    # Convert each block to a paragraph and add emphasis
    paragraphs = []
    for block in blocks:
        # Check for inline code
        if '