def is_palindrome(s):
    s = ''.join(c for c in s.lower() if c.isalnum())
    return s == s[::-1]

# Asserts
assert is_palindrome("A man, a plan, a canal, Panama") == True
assert is_palindrome("No 'x' in Nixon") == True
assert is_palindrome("Hello, World!") == False
assert is_palindrome("Was it a car or a cat I saw?") == True
assert is_palindrome("Madam, in Eden, I'm Adam") == True
assert is_palindrome("Step on no pets") == True
assert is_palindrome("This is not a palindrome") == False

print("All tests passed")