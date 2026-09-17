import text
assert text.normalize("  A  b ") == "a b", text.normalize("  A  b ")
assert text.word_count("a b c") == 3
assert text.initials("alpha beta") == "ab", text.initials("alpha beta")
print("OK")
