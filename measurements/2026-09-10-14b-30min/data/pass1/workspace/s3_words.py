import string

import string

def word_count(text):
    # Remove punctuation and convert to lowercase
    translator = str.maketrans('', '', string.punctuation)
    cleaned_text = text.translate(translator).lower()
    
    # Split text into words
    words = cleaned_text.split()
    
    # Count word occurrences
    word_counts = {}
    for word in words:
        if word in word_counts:
            word_counts[word] += 1
        else:
            word_counts[word] = 1
    
    return word_counts
def test_word_count():
    assert word_count("Hello, world!") == {"hello": 1, "world": 1}
    assert word_count("This is a test. This test is only a test.") == {"this": 2, "is": 2, "a": 2, "test": 2, "only": 1}
    assert word_count("Punctuation should not affect: the count!") == {"punctuation": 1, "should": 1, "not": 1, "affect": 1, "the": 1, "count": 1}
    assert word_count("") == {}
    assert word_count("One") == {"one": 1}
    print("All tests passed.")

if __name__ == "__main__":
    test_word_count()
def top_n(counts, n):
    # Sort the word counts by frequency in descending order
    sorted_counts = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    # Return the top n words
    return [word for word, count in sorted_counts[:n]]
def test_top_n():
    counts = {'apple': 4, 'banana': 2, 'orange': 5, 'grape': 3}
    assert top_n(counts, 2) == ['orange', 'apple']
    assert top_n(counts, 3) == ['orange', 'apple', 'grape']
    assert top_n(counts, 4) == ['orange', 'apple', 'grape', 'banana']
    assert top_n(counts, 0) == []
    assert top_n(counts, 5) == ['orange', 'apple', 'grape', 'banana']
    print("All tests passed for top_n function.")

# Call the test function
test_top_n()
