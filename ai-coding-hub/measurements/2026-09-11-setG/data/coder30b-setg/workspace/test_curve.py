#!/usr/bin/env python3

from s8_grades import Gradebook

def test_curve():
    # Create a gradebook
    g = Gradebook()
    
    # Add students
    g.add_student("Alice")
    g.add_student("Bob")
    g.add_student("Charlie")
    
    # Add assignments
    g.add_assignment("Homework 1", 100)
    g.add_assignment("Quiz 1", 25)
    
    # Record some scores
    g.record("Alice", "Homework 1", 85)
    g.record("Alice", "Quiz 1", 22)
    g.record("Bob", "Homework 1", 92)
    g.record("Bob", "Quiz 1", 20)
    g.record("Charlie", "Homework 1", 80)
    g.record("Charlie", "Quiz 1", 18)
    
    print("Before curve:")
    print(f"Alice Homework 1: {g.score('Alice', 'Homework 1')}")
    print(f"Bob Homework 1: {g.score('Bob', 'Homework 1')}")
    print(f"Charlie Homework 1: {g.score('Charlie', 'Homework 1')}")
    
    # Test curve function
    changed = g.curve("Homework 1", 5)
    print(f"\nCurve applied to Homework 1 with 5 points. Changed {changed} scores.")
    
    print("\nAfter curve:")
    print(f"Alice Homework 1: {g.score('Alice', 'Homework 1')}")
    print(f"Bob Homework 1: {g.score('Bob', 'Homework 1')}")
    print(f"Charlie Homework 1: {g.score('Charlie', 'Homework 1')}")
    
    # Test curve that would exceed max points
    changed2 = g.curve("Quiz 1", 10)
    print(f"\nCurve applied to Quiz 1 with 10 points. Changed {changed2} scores.")
    
    print("\nAfter second curve:")
    print(f"Alice Quiz 1: {g.score('Alice', 'Quiz 1')}")
    print(f"Bob Quiz 1: {g.score('Bob', 'Quiz 1')}")
    print(f"Charlie Quiz 1: {g.score('Charlie', 'Quiz 1')}")
    
    # Test curve on assignment with no scores
    changed3 = g.curve("Quiz 1", 2)
    print(f"\nCurve applied to Quiz 1 with 2 points (already at max). Changed {changed3} scores.")
    
    print("\nFinal scores:")
    print(f"Alice Quiz 1: {g.score('Alice', 'Quiz 1')}")
    print(f"Bob Quiz 1: {g.score('Bob', 'Quiz 1')}")
    print(f"Charlie Quiz 1: {g.score('Charlie', 'Quiz 1')}")

if __name__ == "__main__":
    test_curve()