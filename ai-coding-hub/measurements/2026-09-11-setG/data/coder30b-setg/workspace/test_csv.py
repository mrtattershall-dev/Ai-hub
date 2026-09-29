#!/usr/bin/env python3

import sys
sys.path.append('.')

from s8_grades import Gradebook

# Create a simple gradebook for testing
gb = Gradebook()

# Add some students and assignments
gb.add_student("Alice")
gb.add_student("Bob")
gb.add_student("Charlie")

gb.add_assignment("Homework 1", 100, "Homework")
gb.add_assignment("Homework 2", 100, "Homework")
gb.add_assignment("Quiz 1", 100, "Quiz")

# Add some scores
gb.record("Alice", "Homework 1", 85)
gb.record("Alice", "Homework 2", 90)
gb.record("Alice", "Quiz 1", 78)

gb.record("Bob", "Homework 1", 92)
gb.record("Bob", "Quiz 1", 88)

gb.record("Charlie", "Homework 2", 75)
gb.record("Charlie", "Quiz 1", 82)

# Test the to_csv method
csv_output = gb.to_csv()
print("CSV Output:")
print(csv_output)
print()

# Test with empty gradebook
empty_gb = Gradebook()
empty_csv = empty_gb.to_csv()
print("Empty Gradebook CSV:")
print(empty_csv)