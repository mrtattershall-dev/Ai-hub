#!/usr/bin/env python3

from s8_grades import Gradebook

def test_missing_zero_functionality():
    # Create a gradebook
    gb = Gradebook()
    
    # Add a student
    gb.add_student("Alice")
    
    # Add categories and assignments
    gb.add_assignment("homework1", 100, "homework")
    gb.add_assignment("homework2", 100, "homework")
    gb.add_assignment("quiz1", 50, "quiz")
    
    # Record some scores
    gb.record("Alice", "homework1", 80)
    gb.record("Alice", "quiz1", 40)
    
    # Test default behavior (missing_zero_flag = False)
    print("Default behavior (missing_zero_flag = False):")
    percent_default = gb.percent("Alice")
    print(f"  Percent: {percent_default}")
    
    # Test with missing_zero_flag = True
    print("\nWith missing_zero_flag = True:")
    gb.set_missing_zero(True)
    percent_with_zero = gb.percent("Alice")
    print(f"  Percent: {percent_with_zero}")
    
    # Test with missing_zero_flag = False again
    print("\nWith missing_zero_flag = False again:")
    gb.set_missing_zero(False)
    percent_false = gb.percent("Alice")
    print(f"  Percent: {percent_false}")
    
    print("\nTest completed successfully!")

if __name__ == "__main__":
    test_missing_zero_functionality()