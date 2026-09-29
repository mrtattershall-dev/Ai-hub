from s8_grades import Gradebook

# Test the percent function
def test_percent():
    g = Gradebook()
    
    # Test add_student
    g.add_student("Alice")
    g.add_student("Bob")
    
    # Test add_assignment
    g.add_assignment("Math Test", 100)
    g.add_assignment("Science Quiz", 50)
    
    # Test record
    g.record("Alice", "Math Test", 85)
    g.record("Alice", "Science Quiz", 45)
    g.record("Bob", "Math Test", 92)
    
    # Test percent
    assert g.percent("Alice") == 86.67  # (85+45)/(100+50) = 130/150 = 0.8666... -> 86.67
    assert g.percent("Bob") == 92.0   # 92/100 = 0.92 -> 92.0
    
    # Test with no scores
    g.add_student("Charlie")
    assert g.percent("Charlie") is None
    
    # Test unknown student
    try:
        g.percent("Unknown")
        assert False, "Should have raised KeyError"
    except KeyError:
        pass  # Expected
    
    print("All tests passed!")

if __name__ == "__main__":
    test_percent()