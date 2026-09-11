# Reference solution (final state of chain r2) - used only to prove checks-D.mjs can pass.
import json
import re
import sys
from collections import Counter

WORD = re.compile(r"[^\W_]+(?:'[^\W_]+)*")


def words(text):
    return WORD.findall(text.casefold())


def word_count(text):
    return dict(Counter(words(text)))


def sentences(text):
    out = []
    for m in re.finditer(r"[^.!?]*[.!?]+|[^.!?]+$", text):
        s = m.group(0).strip()
        if s:
            out.append(s)
    return out


def top_words(text, n, stopwords=()):
    stop = {s.casefold() for s in stopwords}
    c = Counter(w for w in words(text) if w not in stop)
    return sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))[:n]


def bigrams(text):
    w = words(text)
    return dict(Counter(f"{a} {b}" for a, b in zip(w, w[1:])))


def avg_sentence_length(text):
    s = sentences(text)
    if not s:
        return 0.0
    return round(sum(len(words(x)) for x in s) / len(s), 2)


def read_counts(path):
    with open(path, encoding="utf-8") as f:
        return word_count(f.read())


def summary(text):
    w = words(text)
    return {"words": len(w), "unique": len(set(w)), "sentences": len(sentences(text)), "top": top_words(text, 3)}


def main(argv):
    path, n = argv[0], int(argv[1])
    with open(path, encoding="utf-8") as f:
        text = f.read()
    top = top_words(text, n)
    if "--json" in argv[2:]:
        print(json.dumps({"top": [[w, c] for w, c in top], "sentences": len(sentences(text))}))
    else:
        for w, c in top:
            print(f"{w} {c}")


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        main(sys.argv[1:])
