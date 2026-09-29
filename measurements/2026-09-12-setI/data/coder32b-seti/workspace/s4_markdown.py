def to_html(text):
    import html
    import re
    paragraphs = text.split('\n\n')
    heading_pattern = re.compile(r'^(#{1,3})\s+(.*)$')
    escaped_paragraphs = []
    for paragraph in paragraphs:
        lines = paragraph.split('\n')
        escaped_lines = []
        for line in lines:
            match = heading_pattern.match(line)
            if match:
                level, content = match.groups()
                tag = f'h{len(level)}'
                escaped_lines.append(f'<{tag}>{html.escape(content)}</{tag}>')
            else:
                escaped_lines.append(html.escape(line.replace('\n', ' ')))
        escaped_paragraphs.append('\n'.join(escaped_lines))
    return '\n'.join(escaped_paragraphs)

if __name__ == "__main__":
    assert to_html("Hello\nWorld") == "<p>Hello World</p>"
    assert to_html("First paragraph\n\nSecond paragraph") == "<p>First paragraph</p>\n<p>Second paragraph</p>"
    assert to_html("Line 1\nLine 2\n\nLine 3\nLine 4") == "<p>Line 1 Line 2</p>\n<p>Line 3 Line 4</p>"
    assert to_html("Special & < > chars") == "<p>Special &amp; &lt; &gt; chars</p>"
    assert to_html("Multiple\nlines\n\nin\nparagraphs") == "<p>Multiple lines</p>\n<p>in paragraphs</p>"