def are_anagrams(a, b):
    # Convert to lowercase and remove spaces
    a_clean = a.lower().replace(' ', '')
    b_clean = b.lower().replace(' ', '')
    
    # Check if sorted characters are equal
    return sorted(a_clean) == sorted(b_clean)

# Test cases
assert are_anagrams("listen", "silent") == True
assert are_anagrams("elbow", "below") == True
assert are_anagrams("study", "dusty") == True
assert are_anagrams("hello", "world") == False
assert are_anagrams("The Eyes", "They See") == True
assert are_anagrams("A gentleman", "Elegant man") == True
assert are_anagrams("Conversation", "Voices rant on") == True
assert are_anagrams("School master", "The classroom") == True
assert are_anagrams("Astronomer", "Moon starer") == True
assert are_anagrams("School master", "The classroom") == True