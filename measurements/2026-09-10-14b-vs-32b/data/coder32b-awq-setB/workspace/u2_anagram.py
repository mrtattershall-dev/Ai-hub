import string

def are_anagrams(a, b):
    a = a.replace(" ", "").lower().translate(str.maketrans('', '', string.punctuation))
    b = b.replace(" ", "").lower().translate(str.maketrans('', '', string.punctuation))
    # Check if sorted characters of both strings are equal
    return sorted(a) == sorted(b)

# Test cases
assert are_anagrams("listen", "silent") == True
assert are_anagrams("triangle", "integral") == True
assert are_anagrams("apple", "pale") == False
assert are_anagrams("A gentleman", "Elegant man") == True
assert are_anagrams("Clint Eastwood", "Old West Action") == True
assert are_anagrams("Dormitory", "Dirty room") == True
assert are_anagrams("The Morse Code", "Here come dots") == True
assert are_anagrams("Slot machines", "Cash lost in me") == True
assert are_anagrams("Eleven plus two", "Twelve plus one") == True
assert are_anagrams("A decimal point", "I'm a dot in place") == True
assert are_anagrams("The eyes", "They see") == True
assert are_anagrams("Conversation", "Voices rant on") == True
assert are_anagrams("Listen", "Silent") == True
assert are_anagrams("The eyes", "They see") == True
assert are_anagrams("Astronomer", "Moon starer") == True
assert are_anagrams("School master", "The classroom") == True
assert are_anagrams("The earthquakes", "That queer shake") == True
assert are_anagrams("Software", "Swear oft") == True