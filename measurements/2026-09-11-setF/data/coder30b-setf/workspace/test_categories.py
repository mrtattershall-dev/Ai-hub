#!/usr/bin/env python3

from s8_grades import Gradebook

def test_categories():
    # Create a gradebook
    g = Gradebook()
    
    # Add students
    g.add_student("Alice")
    g.add_student("Bob")
    
    # Add assignments with categories
    g.add_assignment("Homework 1", 100, "homework")
    g.add_assignment("Homework 2", 100, "homework")
    g.add_assignment("Quiz 1", 50, "quiz")
    g.add_assignment("Exam 1", 200, "exam")
    
    # Set weights
    g.set_weight("homework", 0.4)
    g.set_weight("quiz", 0.3)
    g.set_weight("exam", 0.3)
    
    # Record scores
    g.record("Alice", "Homework 1", 85)
    g.record("Alice", "Homework 2", 90)
    g.record("Alice", "Quiz 1", 40)
    g.record("Alice", "Exam 1", 180)
    
    g.record("Bob", "Homework 1", 70)
    g.record("Bob", "Homework 2", 75)
    g.record("Bob", "Quiz 1", 30)
    g.record("Bob", "Exam 1", 160)
    
    # Test weighted averages
    alice_percent = g.percent("Alice")
    bob_percent = g.percent("Bob")
    
    print(f"Alice's weighted percent: {alice_percent}")
    print(f"Bob's weighted percent: {bob_percent}")
    
    # Verify that the weighted averages are calculated correctly
    # Alice: homework avg = (85+90)/2 = 87.5, quiz avg = 40/50 = 80, exam avg = 180/200 = 90
    # Weighted: 87.5*0.4 + 80*0.3 + 90*0.3 = 35 + 24 + 27 = 86
    expected_alice = 86.0
    assert alice_percent == expected_alice, f"Expected {expected_alice}, got {alice_percent}"
    
    # Bob: homework avg = (70+75)/2 = 72.5, quiz avg = 30/50 = 60, exam avg = 160/200 = 80
    # Weighted: 72.5*0.4 + 60*0.3 + 80*0.3 = 29 + 18 + 24 = 71
    expected_bob = 71.0
    assert bob_percent == expected_bob, f"Expected {expected_bob}, got {bob_percent}"
    
    # Test with default category (should work the same as before)
    g2 = Gradebook()
    g2.add_student("Charlie")
    g2.add_assignment("Test 1", 100)
    g2.add_assignment("Test 2", 100)
    g2.record("Charlie", "Test 1", 80)
    g2.record("Charlie", "Test 2", 90)
    
    charlie_percent = g2.percent("Charlie")
    print(f"Charlie's percent (default category): {charlie_percent}")
    
    # Should be simple average: (80+90)/2 = 85
    assert charlie_percent == 85.0, f"Expected 85.0, got {charlie_percent}"
    
    print("All category tests passed!")

if __name__ == "__main__":
    test_categories()