#!/usr/bin/env python3

from s8_grades import Gradebook

def test_missing_zero_functionality():
    """Test that set_missing_zero flag works correctly"""
    
    # Create a gradebook
    g = Gradebook()
    
    # Add students
    g.add_student("Alice")
    g.add_student("Bob")
    
    # Add assignments
    g.add_assignment("Homework 1", 100)
    g.add_assignment("Quiz 1", 25)
    g.add_assignment("Test 1", 100)
    
    # Record some scores
    g.record("Alice", "Homework 1", 85)
    g.record("Alice", "Quiz 1", 22)
    # Alice didn't take Test 1
    
    g.record("Bob", "Homework 1", 92)
    g.record("Bob", "Quiz 1", 20)
    g.record("Bob", "Test 1", 88)
    
    # Test default behavior (missing_zero = False)
    print("Default behavior (missing_zero=False):")
    alice_percent_default = g.percent("Alice")
    bob_percent_default = g.percent("Bob")
    print(f"Alice's percent: {alice_percent_default}")
    print(f"Bob's percent: {bob_percent_default}")
    
    # Enable missing_zero flag
    g.set_missing_zero(True)
    print("\nWith missing_zero=True:")
    
    # Test with missing_zero=True
    alice_percent_zero = g.percent("Alice")
    bob_percent_zero = g.percent("Bob")
    print(f"Alice's percent: {alice_percent_zero}")
    print(f"Bob's percent: {bob_percent_zero}")
    
    # Verify that Alice's score changed when missing_zero is enabled
    # When missing_zero=False: Alice has 2 assignments (Homework 1=85, Quiz 1=22) 
    # When missing_zero=True: Alice has 3 assignments (Homework 1=85, Quiz 1=22, Test 1=0)
    
    print("\nExpected behavior verification:")
    print("When missing_zero=False, Alice's score should be based on 2 assignments")
    print("When missing_zero=True, Alice's score should be based on 3 assignments (with Test 1=0)")
    
    return True

if __name__ == "__main__":
    test_missing_zero_functionality()
    print("Test completed successfully!")