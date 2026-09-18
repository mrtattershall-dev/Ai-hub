def classify(n):
    if n < 0:
        return "negative"
    if n == 0:
        return "zero"
    if n < 10:
        return "small"
    return "positive"


def is_small(n):
    return classify(n) == "small"
