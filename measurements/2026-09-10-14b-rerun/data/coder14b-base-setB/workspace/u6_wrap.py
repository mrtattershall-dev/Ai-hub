def wrap(text, width):
    lines = []
    current_line = ""
    for word in text.split():
        if len(current_line) + len(word) + (1 if current_line else 0) <= width:
            current_line += (" " if current_line else "") + word
        else:
            lines.append(current_line)
            current_line = word
    if current_line:
        lines.append(current_line)
    return lines

# Add assertions to test the wrap function
if __name__ == "__main__":
    assert wrap("This is a test", 10) == ["This is", "a test"]
    assert wrap("Another example", 5) == ["Another", "example"]
    print("All tests passed")