import re

def words(text):
    return re.findall(r"\b[\w']+\b", text.lower())

if __name__ == "__main__":
    assert words("Don't worry, be happy!") == ["don't", "worry", "be", "happy"]
    assert words("Hello, world!") == ["hello", "world"]
def word_count(text):
    word_list = words(text)
    count_dict = {}
    for word in word_list:
        if word in count_dict:
            count_dict[word] += 1
        else:
            count_dict[word] = 1
    return count_dict

if __name__ == "__main__":
    assert word_count("Don't worry, be happy!") == {"don't": 1, "worry": 1, "be": 1, "happy": 1}
    assert word_count("Hello, world! Hello, everyone!") == {"hello": 2, "world": 1, "everyone": 1}
