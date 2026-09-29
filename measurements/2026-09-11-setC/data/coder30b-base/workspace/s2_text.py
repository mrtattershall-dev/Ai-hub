def word_count(text):
    # Convert to lowercase
    text = text.lower()
    
    # Remove punctuation and split into words
    words = []
    current_word = ""
    
    for char in text:
        if char.isalnum() or char == "'":
            current_word += char
        else:
            if current_word:
                # Remove leading and trailing apostrophes
                current_word = current_word.strip("'")
                if current_word:  # Only add non-empty words
                    words.append(current_word)
                current_word = ""
    
    # Add the last word if it exists
    if current_word:
        # Remove leading and trailing apostrophes
        current_word = current_word.strip("'")
        if current_word:  # Only add non-empty words
            words.append(current_word)
    
    # Count words
    counts = {}
    for word in words:
        counts[word] = counts.get(word, 0) + 1
    
    return counts

# Asserts
assert word_count("hello world") == {"hello": 1, "world": 1}
assert word_count("Hello, World!") == {"hello": 1, "world": 1}
assert word_count("one two two three three three") == {"one": 1, "two": 2, "three": 3}
def top_words(text, n):
    # Get word counts
    counts = word_count(text)
    
    # Sort by count (descending) then by word (ascending) for ties
    sorted_items = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    
    # Return top n items
    return sorted_items[:n]

import sys

# Test the new function
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python s2_text.py <file> <n>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    n = int(sys.argv[2])
    
    try:
        top = top_words(open(file_path, 'r', encoding='utf-8').read(), n)
        for word, count in top:
            print(f"{word} {count}")
    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found.")
        sys.exit(1)
    except ValueError:
        print("Error: Second argument must be an integer.")
        sys.exit(1)
def read_file_counts(path):
    """Read a UTF-8 text file and return word_count of its contents.
    
    Args:
        path (str): Path to the text file
        
    Returns:
        dict: Dictionary with word counts
        
    Raises:
        FileNotFoundError: If the file does not exist
    """
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
        return word_count(content)
