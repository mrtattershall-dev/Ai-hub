from s8_grades import Gradebook

def test_percent():
    # Create a gradebook
    gb = Gradebook()
    
    # Add students
    gb.add_student("Alice")
    gb.add_student("Bob")
    
    # Add assignments
    gb.add_assignment("Homework 1", 100)
    gb.add_assignment("Exam 1", 200)
    gb.add_assignment("Quiz 1", 50)
    
    # Record scores
    gb.record("Alice", "Homework 1", 85)
    gb.record("Alice", "Exam 1", 175)
    gb.record("Bob", "Homework 1", 92)
    gb.record("Bob", "Exam 1", 180)
    
    # Test Alice's percent
    assert gb.percent("Alice") == 86.67  # (85 + 175) / (100 + 200) = 260 / 300 = 0.8666... -> 86.67
    
    # Test Bob's percent
    assert gb.percent("Bob") == 90.67  # (92 + 180) / (100 + 200) = 272 / 300 = 0.9066... -> 90.67
    
    # Test student with no scores
    gb.add_student("Charlie")
    assert gb.percent("Charlie") is None
    
    # Test unknown student raises KeyError
    try:
        gb.percent("Unknown")
        assert False, "Should have raised KeyError"
    except KeyError:
        pass
    
    print("All percent tests passed!")

if __name__ == "__main__":
    test_percent()