import r2_text

# Test the new function
test_cases = [
    ("Hello world.", 2.0),
    ("One sentence.", 3.0),
    ("First sentence. Second sentence.", 3.0),
    ("", 0.0),
    ("No punctuation", 0.0),
    ("One! Two? Three.", 3.0),
    ("This is a test. Another test sentence.", 4.0)
]

print("Testing avg_sentence_length function:")
for text, expected in test_cases:
    result = r2_text.avg_sentence_length(text)
    status = "PASS" if result == expected else "FAIL"
    print(f"{status}: Text: '{text}' -> Expected: {expected}, Got: {result}")