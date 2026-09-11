def is_palindrome(s):
    # Remove non-alphanumeric characters and convert to lowercase
    cleaned = ''.join(char.lower() for char in s if char.isalnum())
    # Check if the cleaned string is equal to its reverse
    return cleaned == cleaned[::-1]

# Assertions to test the function
assert is_palindrome("A man, a plan, a canal, Panama") == True
assert is_palindrome("No lemon, no melon") == True
assert is_palindrome("Hello, World!") == False
assert is_palindrome("Was it a car or a cat I saw?") == True
assert is_palindrome("Madam, in Eden, I'm Adam") == True
assert is_palindrome("Step on no pets") == True
assert is_palindrome("This is not a palindrome") == False