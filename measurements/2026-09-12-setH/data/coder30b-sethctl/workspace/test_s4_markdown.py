import pytest
from s4_markdown import to_html

def test_empty():
    assert to_html("") == ""

def test_simple_paragraph():
    assert to_html("Hello") == "<p>Hello</p>"

def test_paragraph_with_newlines():
    assert to_html("Hello\n\nWorld") == "<p>Hello</p>\n<p>World</p>"

def test_paragraph_with_inline_newlines():
    assert to_html("Hello\nWorld") == "<p>Hello World</p>"

def test_paragraph_with_trailing_newlines():
    assert to_html("Hello\n\nWorld\n\n") == "<p>Hello</p>\n<p>World</p>"

def test_html_escaping():
    assert to_html("Hello & World") == "<p>Hello &amp; World</p>"
    assert to_html("Hello < World") == "<p>Hello &lt; World</p>"
    assert to_html("Hello > World") == "<p>Hello &gt; World</p>"
    assert to_html("Hello & < > World") == "<p>Hello &amp; &lt; &gt; World</p>"

def test_heading_level_1():
    assert to_html("# Hello") == "<h1>Hello</h1>"

def test_heading_level_2():
    assert to_html("## Hello") == "<h2>Hello</h2>"

def test_heading_level_3():
    assert to_html("### Hello") == "<h3>Hello</h3>"

def test_heading_with_html_escaping():
    assert to_html("# Hello & World") == "<h1>Hello &amp; World</h1>"
    assert to_html("## Hello < World") == "<h2>Hello &lt; World</h2>"
    assert to_html("### Hello > World") == "<h3>Hello &gt; World</h3>"

def test_heading_with_spaces():
    assert to_html("#   Hello   ") == "<h1>Hello</h1>"
    assert to_html("##  Hello  ") == "<h2>Hello</h2>"
    assert to_html("### Hello") == "<h3>Hello</h3>"

def test_heading_in_block():
    assert to_html("# Hello\n\nWorld") == "<h1>Hello</h1>\n<p>World</p>"
    assert to_html("Hello\n\n# World") == "<p>Hello</p>\n<h1>World</h1>"

def test_heading_with_multiple_lines():
    # Headings should be treated as single blocks even with multiple lines
    assert to_html("# Hello\nWorld") == "<h1>Hello World</h1>"

if __name__ == "__main__":
    pytest.main([__file__])
def test_unordered_list_single():
    assert to_html("- Item 1") == "<ul><li>Item 1</li></ul>"

def test_unordered_list_multiple():
    assert to_html("- Item 1\n- Item 2") == "<ul><li>Item 1</li><li>Item 2</li></ul>"

def test_unordered_list_with_formatting():
    assert to_html("- Item with *emphasis*") == "<ul><li>Item with <em>emphasis</em></li></ul>"
    assert to_html("- Item with `code`") == "<ul><li>Item with <code>code</code></li></ul>"
    assert to_html("- Item with [link](http://example.com)") == "<ul><li>Item with <a href=\"http://example.com\">link</a></li></ul>"

def test_unordered_list_mixed_with_paragraph():
    assert to_html("- Item 1\n\nParagraph") == "<ul><li>Item 1</li></ul>\n<p>Paragraph</p>"
    assert to_html("Paragraph\n\n- Item 1") == "<p>Paragraph</p>\n<ul><li>Item 1</li></ul>"
