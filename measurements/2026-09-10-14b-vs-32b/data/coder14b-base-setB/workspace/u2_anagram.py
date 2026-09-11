def are_anagrams(a, b):
    # Remove spaces and convert to lowercase
    a = a.replace(" ", "").lower()
    b = b.replace(" ", "").lower()
    # Check if sorted characters of both strings are equal
    return sorted(a) == sorted(b)

# Test cases
assert are_anagrams("listen", "silent") == True
assert are_anagrams("triangle", "integral") == True
assert are_anagrams("apple", "pale") == False
assert are_anagrams("A gentleman", "Elegant man") == True
assert are_anagrams("Clint Eastwood", "Old West Action") == True