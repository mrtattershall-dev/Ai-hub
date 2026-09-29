from s4_markdown import to_html

# Test the link conversion functionality
def test_links():
    # Basic link
    result = to_html("[text](url)")
    expected = '<p><a href="url">text</a></p>'
    assert result == expected, f"Expected {expected}, got {result}"
    print("✓ Basic link test passed")
    
    # Link with double quotes in URL
    result = to_html('[text]("quoted"url)')
    expected = '<p><a href="&quot;quoted&quot;url">text</a></p>'
    assert result == expected, f"Expected {expected}, got {result}"
    print("✓ Link with quotes test passed")
    
    # Link in paragraph
    result = to_html("Hello [text](url) world")
    expected = '<p>Hello <a href="url">text</a> world</p>'
    assert result == expected, f"Expected {expected}, got {result}"
    print("✓ Link in paragraph test passed")
    
    # Multiple links
    result = to_html("[first](url1) and [second](url2)")
    expected = '<p><a href="url1">first</a> and <a href="url2">second</a></p>'
    assert result == expected, f"Expected {expected}, got {result}"
    print("✓ Multiple links test passed")
    
    # Link with emphasis
    result = to_html("[*italic*](url)")
    expected = '<p><a href="url"><em>italic</em></a></p>'
    assert result == expected, f"Expected {expected}, got {result}"
    print("✓ Link with emphasis test passed")
    
    print("All link tests passed!")

if __name__ == "__main__":
    test_links()