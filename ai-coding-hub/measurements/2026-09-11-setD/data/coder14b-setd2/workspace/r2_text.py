import re
from collections import Counter

def top_words(text, n, stopwords=()):
    # Convert text to lowercase and split into words
    words = re.findall(r'\b\w+\b', unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii').lower())
    
    # Filter out stopwords
    filtered_words = [word for word in words if word not in stopwords]
    
    # Count the occurrences of each word
    word_counts = Counter(filtered_words)
    
    # Get the n most common words, sorted by count and then alphabetically
    most_common_words = word_counts.most_common(n)
    
    return most_common_words
def bigrams(text):
    words = text.split()
    bigram_counts = {}
    for i in range(len(words) - 1):
        bigram = f"{words[i]} {words[i + 1]}"
        if bigram in bigram_counts:
            bigram_counts[bigram] += 1
        else:
            bigram_counts[bigram] = 1
    return bigram_counts
def avg_sentence_length(text):
    sentences_list = sentences(text)
    words_list = words(text)
    
    if not sentences_list:
        return 0.0
    
    num_sentences = len(sentences_list)
    num_words = len(words_list)
    
    avg_length = num_words / num_sentences
    return round(avg_length, 2)
def read_counts(path):
    try:
        with open(path, 'r', encoding='utf-8') as file:
            content = file.read()
            words = content.split()
            return len(words)
    except FileNotFoundError:
        raise FileNotFoundError(f"The file {path} does not exist.")
import sys
from collections import Counter
import re

def count_words(file_path, n):
    with open(file_path, 'r') as file:
        text = file.read().lower()
        words = re.findall(r'\b\w+\b', text)
        word_counts = Counter(words)
        common_words = word_counts.most_common(n)
        for word, count in common_words:
            print(f'{word} {count}')

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python r2_text.py FILE N")
        sys.exit(1)
    file_path = sys.argv[1]
    n = int(sys.argv[2])
    count_words(file_path, n)
import json
import sys

def count_words(file_path, n):
    words = read_counts(file_path)
    top_n_words = top_words(words, n)
    avg_len = avg_sentence_length(words)
    sentences = len(re.split(r'[.!?]', words)) - 1

    if '--json' in sys.argv:
        json_output = {
            "top": top_n_words,
            "sentences": sentences
        }
        print(json.dumps(json_output))
    else:
        print(f"Top {n} words: {top_n_words}")
        print(f"Average sentence length: {avg_len}")
        print(f"Number of sentences: {sentences}")
import re
from collections import Counter

def word_count(text):
    words = re.findall(r'\b\w+\b', text)
    return len(words)

def unique_word_count(text):
    words = re.findall(r'\b\w+\b', text)
    unique_words = set(words)
    return len(unique_words)

def sentence_count(text):
    sentences = re.split(r'[.!?]', text)
    return len([sentence for sentence in sentences if sentence.strip()])

def top_words(text, n, stopwords=()):
    words = re.findall(r'\b\w+\b', text.lower())
    word_counts = Counter(words)
    top_words = [word for word, count in word_counts.most_common(n) if word not in stopwords]
    return top_words
def summary(text):
    words = word_count(text)
    unique_words = unique_word_count(text)
    sentences = sentence_count(text)
    top_three_words = top_words(text, 3)
    return {"words": words, "unique": unique_words, "sentences": sentences, "top": top_three_words}
