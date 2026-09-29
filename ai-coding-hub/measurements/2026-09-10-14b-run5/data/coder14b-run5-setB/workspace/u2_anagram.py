def are_anagrams(a, b):
    return sorted(a.lower().replace(" ", "")) == sorted(b.lower().replace(" ", ""))

# Test cases
assert are_anagrams("listen", "silent") == True
assert are_anagrams("triangle", "integral") == True
assert are_anagrams("apple", "pale") == False
assert are_anagrams("A gentleman", "Elegant man") == True
assert are_anagrams("Clint Eastwood", "Old West Action") == True
assert are_anagrams("Dormitory", "Dirty room") == True
assert are_anagrams("The eyes", "They see") == True
assert are_anagrams("A decimal point", "I'm a dot in place") == True
assert are_anagrams("The Morse Code", "Here come dots") == True
assert are_anagrams("Slot machines", "Cash lost in me") == True
assert are_anagrams("Fourth of July", "Joyful Fourth") == True
assert are_anagrams("Eleven plus two", "Twelve plus one") == True
assert are_anagrams("Astronomer", "Moon starer") == True
assert are_anagrams("The earthquakes", "That queer shake") == True
assert are_anagrams("Snooze alarms", "Alas! No more Zs") == True
assert are_anagrams("Halley's Comet", "Shall yet come") == True
print("All tests passed")