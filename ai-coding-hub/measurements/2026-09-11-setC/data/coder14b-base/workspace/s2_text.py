import re
from collections import Counter

def word_count(text):
    words = re.findall(r"\b[\w']+\b", text.lower())
    return Counter(words)

def top_words(text, n):
    word_counts = word_count(text)
    return word_counts.most_common(n)

# Example usage
if __name__ == "__main__":
    text = "This is a test. This test is only a test."
    n = 2
    print(top_words(text, n))
def read_file_counts(path):
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

def count_words(file_path):
    with open(file_path, 'r') as file:
        text = file.read().lower()
        words = re.findall(r'\b\w+\b', text)
        word_counts = Counter(words)
        return word_counts

def main():
    if len(sys.argv) != 3:
        print("Usage: python s2_text.py <file> <n>")
        sys.exit(1)

    file_path = sys.argv[1]
    n = int(sys.argv[2])

    word_counts = count_words(file_path)
    common_words = word_counts.most_common(n)

    for word, count in common_words:
        print(f"{word} {count}")

if __name__ == "__main__":
    main()
