#!/usr/bin/env python3

from s8_grades import Gradebook

def test_percent_function():
    # Create a gradebook
    gradebook = Gradebook()
    
    # Add students
    gradebook.add_student("Alice")
    gradebook.add_student("Bob")
    
    # Add assignments
    gradebook.add_assignment("Homework 1", 100)
    gradebook.add_assignment("Exam 1", 200)
    gradebook.add_assignment("Quiz 1", 50)
    
    # Record scores for Alice
    gradebook.record("Alice", "Homework 1", 85)
    gradebook.record("Alice", "Exam 1", 180)
    gradebook.record("Alice", "Quiz 1", 45)
    
    # Record scores for Bob
    gradebook.record("Bob", "Homework 1", 92)
    gradebook.record("Bob", "Exam 1", 190)
    
    # Test Alice's percentage
    alice_percent = gradebook.percent("Alice")
    expected_alice = round((85 + 180 + 45) / (100 + 200 + 50) * 100, 2)
    assert alice_percent == expected_alice, f"Expected {expected_alice}, got {alice_percent}"
    
    # Test Bob's percentage
    bob_percent = gradebook.percent("Bob")
    expected_bob = round((92 + 190) / (100 + 200) * 100, 2)
    assert bob_percent == expected_bob, f"Expected {expected_bob}, got {bob_percent}"
    
    # Test student with no scores
    gradebook.add_student("Charlie")
    charlie_percent = gradebook.percent("Charlie")
    assert charlie_percent is None, f"Expected None for Charlie, got {charlie_percent}"
    
    # Test unknown student raises KeyError
    try:
        gradebook.percent("Unknown Student")
        assert False, "Should have raised KeyError"
    except KeyError:
        pass  # Expected
    
    print("All percent function tests passed!")

if __name__ == "__main__":
    test_percent_function()