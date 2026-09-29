import s4_markdown

def test_to_html():
    test_cases = [
        ("# Heading 1", "<h1>Heading 1</h1>"),
        ("## Heading 2", "<h2>Heading 2</h2>"),
        ("### Heading 3", "<h3>Heading 3</h3>"),
        ("# Heading 1\n## Heading 2\n### Heading 3", "<h1>Heading 1</h1>\n<h2>Heading 2</h2>\n<h3>Heading 3</h3>"),
        ("Some text\n# Heading 1\nMore text", "Some text\n<h1>Heading 1</h1>\nMore text"),
        ("# Heading 1\n\n## Heading 2\n\n### Heading 3", "<h1>Heading 1</h1>\n<h2>Heading 2</h2>\n<h3>Heading 3</h3>"),
    ]

    for i, (input_text, expected_output) in enumerate(test_cases):
        result = s4_markdown.to_html(input_text)
        assert result == expected_output, f"Test case {i+1} failed: expected {expected_output}, got {result}"
        print(f"Test case {i+1} passed.")

if __name__ == "__main__":
    test_to_html()