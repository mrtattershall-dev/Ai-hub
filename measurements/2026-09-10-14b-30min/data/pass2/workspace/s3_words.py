import string

def word_count(text):
    # Remove punctuation and convert text to lowercase
    translator = str.maketrans('', '', string.punctuation)
    cleaned_text = text.translate(translator).lower()
    
    # Split text into words
    words = cleaned_text.split()
    
    # Count the occurrences of each word
    word_counts = {}
    for word in words:
        if word in word_counts:
            word_counts[word] += 1
        else:
            word_counts[word] = 1
    
    return word_counts

# Assertions to test the word_count function
assert word_count("Hello, world!") == {"hello": 1, "world": 1}
assert word_count("This is a test. This test is only a test.") == {"this": 2, "is": 2, "a": 2, "test": 2, "only": 1}
assert word_count("") == {}
assert word_count("Punctuation should be ignored: !@#$%^&*()") == {"punctuation": 1, "should": 1, "be": 1, "ignored": 1}

print("All tests passed.")