def wrap(text, width):
    if not text or width <= 0:
        return []
    
    words = text.split()
    if not words:
        return []
    
    lines = []
    current_line = words[0]
    
    for word in words[1:]:
        # Check if adding the word would exceed the width
        if len(current_line) + 1 + len(word) <= width:
            current_line += ' ' + word
        else:
            lines.append(current_line)
            current_line = word
    
    lines.append(current_line)
    return lines

# Asserts
assert wrap("hello world", 11) == ["hello world"]
assert wrap("hello world", 5) == ["hello", "world"]
assert wrap("The quick brown fox jumps over the lazy dog", 10) == ["The quick", "brown fox", "jumps over", "the lazy", "dog"]
assert wrap("", 5) == []
assert wrap("hello", 10) == ["hello"]
assert wrap("a b c d e", 1) == ["a", "b", "c", "d", "e"]