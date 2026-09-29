import unicodedata

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
        # Check if character is a letter or digit or apostrophe
        if char.isalnum() or char == "'":
            current_word += char
        else:
            if current_word:
                result.append(current_word.casefold())
                current_word = ""
        i += 1
    
    # Don't forget the last word
    if current_word:
        result.append(current_word.casefold())
    
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
            result.append(current_sentence.strip())
            current_sentence = ""
        else:
            current_sentence += char
        i += 1
    
    # Don't forget the last sentence
    if current_sentence:
        result.append(current_sentence.strip())
    
    # Remove empty sentences
    return [s for s in result if s]

def avg_sentence_length(text):
    """Return the average sentence length in words."""
    sent = sentences(text)
    if not sent:
        return 0
    word_lists = [words(s) for s in sent]
    total_words = sum(len(wl) for wl in word_lists)
    return total_words / len(sent)

def top_words(text, n, stopwords=()):
    """Return the n most frequent words in text, excluding stopwords."""
    counts = word_count(text)
    # Remove stopwords
    for word in stopwords:
        counts.pop(word, None)
    # Sort by count (descending) then by word (ascending)
    sorted_words = sorted(counts.items(), key=lambda x: (-x[1], x[0]))
    return sorted_words[:n]

def bigrams(text):
    """Return a list of bigrams (pairs of consecutive words) in text."""
    word_list = words(text)
    return [(word_list[i], word_list[i+1]) for i in range(len(word_list)-1)]

def read_counts(path):
    """Read a file and return a dict of word to count."""
    with open(path, 'r', encoding='utf-8') as f:
        return word_count(f.read())

def summary(text):
    """Return a dict with text analysis: words, unique words, sentences, and top 3 words."""
    # Count total words
    total_words = len(words(text))
    
    # Count unique words
    unique_words = len(word_count(text))
    
    # Count sentences
    sentence_count = len(sentences(text))
    
    # Get top 3 words
    top_3 = top_words(text, 3)
    
    return {
        "words": total_words,
        "unique": unique_words,
        "sentences": sentence_count,
        "top": top_3
    }