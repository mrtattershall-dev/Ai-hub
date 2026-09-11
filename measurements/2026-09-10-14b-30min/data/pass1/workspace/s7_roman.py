def to_roman(n):
    val = [
        1000, 900, 500, 400,
        100, 90, 50, 40,
        10, 9, 5, 4,
        1
    ]
    syms = [
        "M", "CM", "D", "CD",
        "C", "XC", "L", "XL",
        "X", "IX", "V", "IV",
        "I"
    ]
    roman_numeral = ''
    i = 0
    while n > 0:
        for _ in range(n // val[i]):
            roman_numeral += syms[i]
            n -= val[i]
        i += 1
    return roman_numeral
def from_roman(s):
    roman_numerals = {
        'I': 1, 'V': 5, 'X': 10, 'L': 50,
        'C': 100, 'D': 500, 'M': 1000
    }
    total = 0
    prev_value = 0
    for char in reversed(s):
        value = roman_numerals[char]
        if value < prev_value:
            total -= value
        else:
            total += value
        prev_value = value
    return total
def test_round_trip():
    for i in range(1, 4000):
        assert from_roman(to_roman(i)) == i

if __name__ == "__main__":
    test_round_trip()
    print("All tests passed!")
