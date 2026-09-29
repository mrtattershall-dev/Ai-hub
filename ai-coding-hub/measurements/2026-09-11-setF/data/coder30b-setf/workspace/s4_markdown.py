def toc(text):
    """
    Extract table of contents from markdown text.
    Returns a list of (level, title, slug) tuples, one per heading.
    The slug is the title in lower case with every run of characters that are not 
    letters or digits turned into one "-" and no "-" at either end.
    A slug seen before gets "-2", then "-3", and so on.
    """
    import re
    
    # Find all headings
    heading_pattern = r'^(#{1,6})\s+(.*?)$'
    
    headings = re.findall(heading_pattern, text, re.MULTILINE)
    
    slugs = {}
    result = []
    
    for level, title in headings:
        # Create base slug
        base_slug = re.sub(r'[^a-zA-Z0-9]+', '-', title.lower()).strip('-')
        
        # Handle duplicates
        slug = base_slug
        count = 1
        while slug in slugs:
            count += 1
            slug = f"{base_slug}-{count}"
        
        slugs[slug] = True
        result.append((len(level), title.strip(), slug))
    
    return result