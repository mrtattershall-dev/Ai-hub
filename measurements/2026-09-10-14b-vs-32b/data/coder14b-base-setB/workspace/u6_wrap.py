def wrap(text, width):
    lines = []
    current_line = ""
    words = text.split()

    for word in words:
        if len(current_line) + len(word) + (1 if current_line else 0) <= width:
            current_line += (" " if current_line else "") + word
        else:
            lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)

    return "\n".join(lines)

# Test cases
assert wrap("This is a test", 10) == "This is\na test"
assert wrap("Another example", 15) == "Another\nexample"
assert wrap("Short line", 20) == "Short line"
assert wrap("Longer line that needs to be wrapped", 20) == "Longer line\nthat needs to be\nwrapped"