import text
assert text.counted("a b") == 1, text.counted("a b")
assert text.counted("A   B") == 2, "normalized strings are the same key"
assert text.counted("c") == 1
assert text.counted("a b") == 3
assert text.word_count("a b") == 2, "the existing helpers must be unchanged"
print("OK")
