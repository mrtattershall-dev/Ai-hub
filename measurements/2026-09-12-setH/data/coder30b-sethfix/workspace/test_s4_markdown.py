import pytest
from s4_markdown import to_html

def test_to_html_links():
    # Test basic link conversion
    assert to_html("[text](url)") == '<p><a href="url">text</a></p>'
    
    # Test link with special characters in URL
    assert to_html('[text](url with "quotes" and &amp;)') == '<p><a href="url with &quot;quotes&quot; and &amp;amp;">text</a></p>'
    
    # Test link with double quotes in URL
    assert to_html('[text](url with "quotes")') == '<p><a href="url with &quot;quotes&quot;">text</a></p>'
    
    # Test multiple links
    assert to_html("[first](url1) and [second](url2)") == '<p><a href="url1">first</a> and <a href="url2">second</a></p>'
    
    # Test link with emphasis
    assert to_html("[*em*](url)") == '<p><a href="url"><em>em</em></a></p>'
    
    # Test link with bold
    assert to_html("[**bold**](url)") == '<p><a href="url"><strong>bold</strong></a></p>'
    
    # Test link with code
    assert to_html("[`code`](url)") == '<p><a href="url"><code>code</code></a></p>'
    
    # Test link with mixed formatting
    assert to_html("[**bold *italic* and `code`**](url)") == '<p><a href="url"><strong>bold <em>italic</em> and <code>code</code></strong></a></p>'

def test_to_html_links_with_existing_features():
    # Test that existing features still work with links
    assert to_html("# Heading\n\n[text](url)") == '<h1>Heading</h1>\n<p><a href="url">text</a></p>'
    
    assert to_html("**bold** and [text](url)") == '<p><strong>bold</strong> and <a href="url">text</a></p>'
    
    assert to_html("*italic* and [text](url)") == '<p><em>italic</em> and <a href="url">text</a></p>'
    
    assert to_html("`code` and [text](url)") == '<p><code>code</code> and <a href="url">text</a></p>'