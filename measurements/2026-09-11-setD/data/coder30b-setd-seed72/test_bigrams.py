#!/usr/bin/env python3

import r2_text

def test_bigrams():
    # Test basic functionality
    result = r2_text.bigrams("the quick brown fox")
    expected = {"the quick": 1, "quick brown": 1, "brown fox": 1}
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test repeated bigrams
    result = r2_text.bigrams("the quick quick brown")
    expected = {"the quick": 1, "quick quick": 1, "quick brown": 1}
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test overlapping bigrams
    result = r2_text.bigrams("a b a b a")
    expected = {"a b": 2, "b a": 2, "a b": 1}
    # Note: The actual expected result should be {"a b": 2, "b a": 2} 
    # because the last "a b" is not a complete pair
    expected = {"a b": 2, "b a": 2}
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test single word
    result = r2_text.bigrams("hello")
    expected = {}
    assert result == expected, f"Expected {expected}, got {result}"
    
    # Test empty string
    result = r2_text.bigrams("")
    expected = {}
    assert result == expected, f"Expected {expected}, got {result}"
    
    print("All bigrams tests passed!")

if __name__ == "__main__":
    test_bigrams()