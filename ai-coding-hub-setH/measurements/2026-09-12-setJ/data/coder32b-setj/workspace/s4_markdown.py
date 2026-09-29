def to_html(text):
    import html
    lines = text.split('\n')
    html_paragraphs = []
    current_paragraph = []

    for line in lines:
        if line.startswith('# '):
            if current_paragraph:
                html_paragraphs.append('<p>{}</p>'.format(' '.join(html.escape(line) for line in current_paragraph)))
                current_paragraph = []
            html_paragraphs.append('<h1>{}</h1>'.format(html.escape(line[2:])))
        elif line.startswith('## '):
            if current_paragraph:
                html_paragraphs.append('<p>{}</p>'.format(' '.join(html.escape(line) for line in current_paragraph)))
                current_paragraph = []
            html_paragraphs.append('<h2>{}</h2>'.format(html.escape(line[3:])))
        elif line.startswith('### '):
            if current_paragraph:
                html_paragraphs.append('<p>{}</p>'.format(' '.join(html.escape(line) for line in current_paragraph)))
                current_paragraph = []
            html_paragraphs.append('<h3>{}</h3>'.format(html.escape(line[4:])))
        elif line:
            current_paragraph.append(line)
        elif current_paragraph:
            html_paragraphs.append('<p>{}</p>'.format(' '.join(html.escape(line) for line in current_paragraph)))
            current_paragraph = []

    if current_paragraph:
        html_paragraphs.append('<p>{}</p>'.format(' '.join(html.escape(line) for line in current_paragraph)))

    return '\n'.join(html_paragraphs)

if __name__ == "__main__":
    # Tests will go here
    assert to_html("Hello World") == "<p>Hello World</p>"
    assert to_html("Hello\nWorld") == "<p>Hello World</p>"
    assert to_html("Hello\n\nWorld") == "<p>Hello</p>\n<p>World</p>"
    assert to_html("Line 1\nLine 2\n\nLine 3\nLine 4") == "<p>Line 1 Line 2</p>\n<p>Line 3 Line 4</p>"
    assert to_html("Special & < > chars") == "<p>Special &amp; &lt; &gt; chars</p>"
    print("All tests passed.")
    assert to_html("Hello\nWorld") == "<p>Hello World</p>"
    assert to_html("Hello\n\nWorld") == "<p>Hello</p>\n<p>World</p>"
    assert to_html("# Heading 1") == "<h1>Heading 1</h1>"
    assert to_html("## Heading 2") == "<h2>Heading 2</h2>"
    assert to_html("### Heading 3") == "<h3>Heading 3</h3>"
    assert to_html("# Heading 1\n## Heading 2\n### Heading 3") == "<h1>Heading 1</h1>\n<h2>Heading 2</h2>\n<h3>Heading 3</h3>"
    assert to_html("Line 1\nLine 2") == "<p>Line 1 Line 2</p>"
    assert to_html("Line 1\n\nLine 2") == "<p>Line 1</p>\n<p>Line 2</p>"
    assert to_html("Special & < > chars") == "<p>Special &amp; &lt; &gt; chars</p>"
