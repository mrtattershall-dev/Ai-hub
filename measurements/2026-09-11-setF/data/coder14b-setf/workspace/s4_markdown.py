def to_html(text):
    import re
    # Regular expression to find markdown links
    markdown_link_pattern = r'\[(.*?)\]\((.*?)\)'
    # Function to replace markdown link with HTML link
    def replace_link(match):
        text = match.group(1)
        url = match.group(2)
        # Replace double quotes in the URL with &quot;
        url = url.replace('"', '&quot;')
        return f'<a href="{url}">{text}</a>'
    # Replace all markdown links in the text
    html_text = re.sub(markdown_link_pattern, replace_link, text)
    return html_text
    blocks = text.split('\n\n')
    
    # Process each block
    processed_blocks = []
    for block in blocks:
        # Replace & with &amp;, < with &lt;, and > with &gt;
        escaped_block = block.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        # Join lines in the block with one space
        processed_block = ' '.join(escaped_block.splitlines())
        processed_blocks.append(processed_block)
    
    # Join blocks with '\n'
    html = '\n'.join(f'<p>{block}</p>' for block in processed_blocks)
    return html

if __name__ == "__main__":
    # Test cases
    test_text = "This is a test.\n\nThis is another block.\nIt has multiple lines."
    expected_html = "<p>This is a test.</p>\n<p>This is another block. It has multiple lines.</p>"
    assert to_html(test_text) == expected_html, "Test case failed"
    
    print("All tests passed!")
def to_html(text):
    import re
    # Regular expression to find markdown links
    markdown_link_pattern = r'\[(.*?)\]\((.*?)\)'
    # Function to replace markdown link with HTML link
    def replace_link(match):
        text = match.group(1)
        url = match.group(2)
        # Replace double quotes in the URL with &quot;
        url = url.replace('"', '&quot;')
        return f'<a href="{url}">{text}</a>'
    # Replace all markdown links in the text
    html_text = re.sub(markdown_link_pattern, replace_link, text)
    return html_text
import re

def toc(text):
    headings = []
    slug_map = {}
    
    # Regular expression to match markdown headings
    heading_pattern = re.compile(r'^(#{1,6})\s+(.*)$')
    
    for line in text.splitlines():
        match = heading_pattern.match(line)
        if match:
            level = len(match.group(1))
            title = match.group(2)
            slug = generate_slug(title, slug_map)
            headings.append((level, title, slug))
    
    return headings

def generate_slug(title, slug_map):
    base_slug = re.sub(r'[^a-zA-Z0-9]+', '-', title.lower()).strip('-')
    if base_slug not in slug_map:
        slug_map[base_slug] = base_slug
    else:
        count = 2
        while f"{base_slug}-{count}" in slug_map:
            count += 1
        slug_map[base_slug] = f"{base_slug}-{count}"
    
    return slug_map[base_slug]
