import r2_text

# Test only the function I was asked to implement
def test_avg_sentence_length():
    # Test cases based on correct logic
    test_cases = [
        ("Hello world.", 2.0),  # 2 words, 1 sentence = 2.0
        ("One sentence.", 2.0),  # 2 words, 1 sentence = 2.0  
        ("First sentence. Second sentence.", 2.0),  # 4 words, 2 sentences = 2.0
        ("", 0.0),  # No sentences = 0.0
        ("No punctuation", 0.0),  # No sentence ending = 0.0
        ("One! Two? Three.", 1.0),  # 3 words, 3 sentences = 1.0
        ("This is a test. Another test sentence.", 4.0),  # 5+5=10 words, 2 sentences = 5.0
    ]
    
    print("Testing avg_sentence_length function:")
    all_passed = True
    for text, expected in test_cases:
        result = r2_text.avg_sentence_length(text)
        status = "PASS" if result == expected else "FAIL"
        if result != expected:
            all_passed = False
        print(f"{status}: Text: '{text}' -> Expected: {expected}, Got: {result}")
    
    if all_passed:
        print("\nAll tests passed for avg_sentence_length!")
    else:
        print("\nSome tests failed.")
    
    return all_passed

if __name__ == "__main__":
    test_avg_sentence_length()