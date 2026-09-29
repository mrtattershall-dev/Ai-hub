#!/usr/bin/env python3

from s8_grades import Gradebook

def test_drop_lowest():
    # Create a gradebook
    gb = Gradebook()
    
    # Add students
    gb.add_student("Alice")
    gb.add_student("Bob")
    
    # Add assignments
    gb.add_assignment("hw1", 100, "homework")
    gb.add_assignment("hw2", 100, "homework")
    gb.add_assignment("hw3", 100, "homework")
    gb.add_assignment("quiz1", 50, "quiz")
    gb.add_assignment("quiz2", 50, "quiz")
    
    # Add scores
    gb.record("Alice", "hw1", 80)
    gb.record("Alice", "hw2", 90)
    gb.record("Alice", "hw3", 70)
    gb.record("Alice", "quiz1", 40)
    gb.record("Alice", "quiz2", 45)
    
    gb.record("Bob", "hw1", 60)
    gb.record("Bob", "hw2", 70)
    gb.record("Bob", "hw3", 80)
    gb.record("Bob", "quiz1", 30)
    gb.record("Bob", "quiz2", 35)
    
    # Set weights
    gb.set_weight("homework", 0.6)
    gb.set_weight("quiz", 0.4)
    
    # Test percent without dropping
    print("Alice's percent without dropping:", gb.percent("Alice"))
    print("Bob's percent without dropping:", gb.percent("Bob"))
    
    # Drop lowest 1 homework score for Alice
    gb.drop_lowest("homework", 1)
    print("Alice's percent after dropping 1 homework score:", gb.percent("Alice"))
    
    # Drop lowest 1 homework score for Bob
    gb.drop_lowest("homework", 1)
    print("Bob's percent after dropping 1 homework score:", gb.percent("Bob"))
    
    # Test with more drops
    gb.drop_lowest("quiz", 1)
    print("Alice's percent after dropping 1 quiz score:", gb.percent("Alice"))
    print("Bob's percent after dropping 1 quiz score:", gb.percent("Bob"))

if __name__ == "__main__":
    test_drop_lowest()