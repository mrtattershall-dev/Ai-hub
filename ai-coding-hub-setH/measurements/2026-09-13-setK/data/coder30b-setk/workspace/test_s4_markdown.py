import s4_markdown

def test_basic_conversion():
    """Test basic text conversion"""
    assert s4_markdown.to_html("Hello\nWorld") == "Hello World"

def test_blank_line_separation():
    """Test blank line separation"""
    assert s4_markdown.to_html("Hello\n\nWorld") == "Hello\nWorld"

def test_special_characters():
    """Test special character escaping"""
    assert s4_markdown.to_html("Hello\n&\nWorld") == "Hello &amp; World"
    assert s4_markdown.to_html("Hello\n<\nWorld") == "Hello &lt; World"
    assert s4_markdown.to_html("Hello\n>\nWorld") == "Hello &gt; World"

def test_multiple_lines():
    """Test multiple lines within blocks"""
    assert s4_markdown.to_html("Hello\n&\nWorld\n\nFoo\nBar") == "Hello &amp; World\nFoo Bar"

def test_headings():
    """Test heading conversion"""
    # Test h1
    assert s4_markdown.to_html("# Heading 1") == "<h1>Heading 1</h1>"
    # Test h2
    assert s4_markdown.to_html("## Heading 2") == "<h2>Heading 2</h2>"
    # Test h3
    assert s4_markdown.to_html("### Heading 3") == "<h3>Heading 3</h3>"
    # Test mixed content
    result = s4_markdown.to_html("# Heading 1\n\nNormal text\n\n## Heading 2")
    expected = "<h1>Heading 1</h1>\nNormal text\n<h2>Heading 2</h2>"
    assert result == expected

def test_heading_with_special_characters():
    """Test headings with special characters"""
    result = s4_markdown.to_html("# Heading &amp; more")
    expected = "<h1>Heading &amp; more</h1>"
    assert result == expected

if __name__ == "__main__":
    test_basic_conversion()
    test_blank_line_separation()
    test_special_characters()
    test_multiple_lines()
    test_headings()
    test_heading_with_special_characters()
    print("All tests passed!")
def test_inline_code():
    """Test inline code formatting"""
    # Test basic inline code
    assert s4_markdown.to_html("Use `code` for inline code") == "Use <code>code</code> for inline code"
    
    # Test inline code with special characters
    assert s4_markdown.to_html("Use `code & more` for inline code") == "Use <code>code &amp; more</code> for inline code"
    
    # Test inline code with emphasis inside (should not be processed)
    assert s4_markdown.to_html("Use `*emphasis*` inside code") == "Use <code>*emphasis*</code> inside code"
    
    # Test inline code with bold emphasis inside (should not be processed)
    assert s4_markdown.to_html("Use `**bold**` inside code") == "Use <code>**bold**</code> inside code"
    
    # Test heading with inline code
    assert s4_markdown.to_html("# Heading with `code`") == "<h1>Heading with <code>code</code></h1>"
    
    # Test heading with inline code and special characters
    assert s4_markdown.to_html("# Heading with `code & more`") == "<h1>Heading with <code>code &amp; more</code></h1>"

if __name__ == "__main__":
    test_basic_conversion()
    test_blank_line_separation()
    test_special_characters()
    test_multiple_lines()
    test_headings()
    test_heading_with_special_characters()
    test_inline_code()
    print("All tests passed!")
