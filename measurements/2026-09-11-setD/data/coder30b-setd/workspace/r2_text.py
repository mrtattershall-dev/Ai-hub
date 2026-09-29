def words(text):
    """Return the list of lower-case words in order.
    A word is a run of letters and digits, and an apostrophe between two letters stays inside the word.
    """
    if not text:
        return []
    
    result = []
    current_word = ""
    
    i = 0
    while i < len(text):
        char = text[i]
        if char.isalnum() or char == "'":
            current_word += char
        else:
            if current_word:
                result.append(current_word.lower())
                current_word = ""
        i += 1
    
    # Don't forget the last word
    if current_word:
        result.append(current_word.lower())
    
    return result

def word_count(text):
    """Return a dict of word to count."""
    word_list = words(text)
    count_dict = {}
    for word in word_list:
        count_dict[word] = count_dict.get(word, 0) + 1
    return count_dict

def sentences(text):
    """Split text into sentences ending in '.', '!', or '?', keeping that punctuation and stripping spaces.
    A last piece without ending punctuation is kept; empty pieces are dropped.
    """
    if not text:
        return []
    
    result = []
    current_sentence = ""
    
    i = 0
    while i < len(text):
        char = text[i]
        if char in '.!?':
            current_sentence += char
            # Strip trailing spaces from the sentence
            current_sentence = current_sentence.rstrip()
            # Strip leading spaces from the sentence
            current_sentence = current_sentence.lstrip()
            if current_sentence:  # Only add non-empty sentences
                result.append(current_sentence)
            current_sentence = ""
        else:
            current_sentence += char
        i += 1
    
    # Handle the last sentence if it doesn't end with punctuation
    if current_sentence:
        current_sentence = current_sentence.rstrip()
        current_sentence = current_sentence.lstrip()
        if current_sentence:  # Only add non-empty sentences
            result.append(current_sentence)
    
    return result

def avg_sentence_length(text):
    """Return the average number of words per sentence, rounded to 2 decimals.
    Returns 0.0 if there are no sentences.
    """
    sentences_list = sentences(text)
    if not sentences_list:
        return 0.0
    
    total_words = 0
    for sentence in sentences_list:
        total_words += len(words(sentence))
    
    return round(total_words / len(sentences_list), 2)

def top_words(text, n, stopwords=()):
    """Return the n most common words as (word, count) tuples, most common first.
    Ties are broken in alphabetical order.
    Words in stopwords are excluded (compared in lower case).
    """
    # Get word counts
    word_counts = word_count(text)
    
    # Remove stopwords (case insensitive)
    filtered_counts = {}
    for word, count in word_counts.items():
        if word.lower() not in stopwords:
            filtered_counts[word] = count
    
    # Sort by count (descending) then by word (ascending) for ties
    sorted_items = sorted(filtered_counts.items(), key=lambda item: (-item[1], item[0]))
    
    # Return top n items
    return sorted_items[:n]


def bigrams(text):
    """Return a dict mapping each pair of neighbouring words in words(text), 
    written as "first second", to how many times it occurs."""
    word_list = words(text)
    if len(word_list) < 2:
        return {}
    
    bigram_dict = {}
    for i in range(len(word_list) - 1):
        bigram = f"{word_list[i]} {word_list[i+1]}"
        bigram_dict[bigram] = bigram_dict.get(bigram, 0) + 1
    
    return bigram_dict


def read_counts(path):
    """Read a UTF-8 text file and return its word count as a dict.
    Raise FileNotFoundError if the file does not exist.
    """
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
        return word_count(text)


if __name__ == "__main__":
    # Test cases
    assert words("Hello, world!") == ["hello", "world"]
    assert words("Don't stop!") == ["don't", "stop"]
    assert words("One, two, three.") == ["one", "two", "three"]
    assert words("123 abc 456") == ["123", "abc", "456"]
    assert words("") == []
    assert words("   ") == []
    assert words("a'b") == ["a'b"]
    assert words("a'b'c") == ["a'b'c"]
    
    assert word_count("Hello, world!") == {"hello": 1, "world": 1}
    assert word_count("Don't stop! Don't go!") == {"don't": 2, "stop": 1, "go": 1}
    assert word_count("One, two, three. One, two. One.") == {"one": 3, "two": 2, "three": 1}
    assert word_count("") == {}
    assert word_count("a b c a b a") == {"a": 3, "b": 2, "c": 1}
    
    # Test cases for top_words
    assert top_words("the quick brown fox jumps over the lazy dog", 3) == [("brown", 1), ("dog", 1), ("fox", 1)]
    assert top_words("the quick brown fox jumps over the lazy dog", 5, ("the", "over")) == [("brown", 1), ("dog", 1), ("fox", 1), ("jumps", 1), ("lazy", 1)]
    assert top_words("a b c a b a", 2) == [("a", 3), ("b", 2)]
    assert top_words("hello world hello", 2, ("hello",)) == [("world", 1)]
    assert top_words("", 3) == []
    assert top_words("a a b b c c", 3) == [("a", 2), ("b", 2), ("c", 2)]
    
    # Test cases for bigrams
    assert bigrams("the quick brown fox") == {"the quick": 1, "quick brown": 1, "brown fox": 1}
    assert bigrams("the quick quick brown") == {"the quick": 1, "quick quick": 1, "quick brown": 1}
    assert bigrams("a b a b a") == {"a b": 2, "b a": 2, "a b": 1}
    assert bigrams("hello") == {}
    assert bigrams("") == {}
    
    print("All tests passed!")
