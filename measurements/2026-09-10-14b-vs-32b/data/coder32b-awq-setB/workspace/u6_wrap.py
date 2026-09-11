def wrap(text, width):
    words = text.split()
    lines = []
    current_line = ""
    
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
# Debugging the function
def wrap(text, width):
    words = text.split()
    lines = []
    current_line = ""
    
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
assert wrap("Another test case", 5) == "Another\ntest\ncase"
assert wrap("Short", 10) == "Short"
assert wrap("A very long wordthatshouldnotbesplit", 10) == "A very\nlong\nwordthatshouldnotbesplit"
assert wrap("", 10) == ""
assert wrap("Multiple    spaces", 10) == "Multiple\nspaces"
assert wrap("Edge case with width 1", 1) == "E\nd\ng\ne\n\n\nc\na\ns\ne"

# Test cases
assert wrap("This is a test", 10) == "This is\na test"
# Debugging the function
print(wrap("This is a test", 10))
assert wrap("Another test case", 5) == "Another\ntest\ncase"
assert wrap("Short", 10) == "Short"
assert wrap("A very long wordthatshouldnotbesplit", 10) == "A very\nlong\nwordthatshouldnotbesplit"
assert wrap("", 10) == ""
assert wrap("Multiple    spaces", 10) == "Multiple\nspaces"
assert wrap("Edge case with width 1", 1) == "E\nd\ng\ne\n\n\nc\na\ns\ne"
