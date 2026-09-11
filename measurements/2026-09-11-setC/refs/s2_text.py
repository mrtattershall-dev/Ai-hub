# Reference solution (final state of chain 2) - used only to prove checks-C.mjs can pass.
import re
import sys
from collections import Counter

WORD = re.compile(r"[a-z0-9]+(?:'[a-z0-9]+)*")


def word_count(text):
    return dict(Counter(WORD.findall(text.lower())))


def top_words(text, n):
    return sorted(word_count(text).items(), key=lambda kv: (-kv[1], kv[0]))[:n]


def read_file_counts(path):
    with open(path, encoding="utf-8") as f:
        return word_count(f.read())


if __name__ == "__main__":
    if len(sys.argv) == 3:
        with open(sys.argv[1], encoding="utf-8") as f:
            text = f.read()
        for word, count in top_words(text, int(sys.argv[2])):
            print(f"{word} {count}")
