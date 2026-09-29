import sys
sys.path.append('.')
from s8_grades import Gradebook

# Test basic functionality
gb = Gradebook()
gb.add_student("Alice")
gb.add_student("Bob")

# Test basic assignment
gb.add_assignment("quiz1", 100)
gb.record("Alice", "quiz1", 80)
gb.record("Bob", "quiz1", 90)

print("Basic test:")
print("Alice's percent:", gb.percent("Alice"))
print("Bob's percent:", gb.percent("Bob"))

# Test categories
print("\nCategory test:")
gb.add_assignment("hw1", 100, category="homework")
gb.add_assignment("hw2", 100, category="homework")
gb.add_assignment("exam1", 100, category="exam")

gb.record("Alice", "hw1", 85)
gb.record("Alice", "hw2", 90)
gb.record("Alice", "exam1", 75)

gb.record("Bob", "hw1", 70)
gb.record("Bob", "hw2", 80)
gb.record("Bob", "exam1", 85)

print("Alice's percent with categories:", gb.percent("Alice"))
print("Bob's percent with categories:", gb.percent("Bob"))

# Test weights
print("\nWeight test:")
gb.set_weight("homework", 0.5)
gb.set_weight("exam", 0.5)

print("Alice's percent with weights:", gb.percent("Alice"))
print("Bob's percent with weights:", gb.percent("Bob"))

# Test default category behavior
print("\nDefault category test:")
gb2 = Gradebook()
gb2.add_student("Charlie")
gb2.add_assignment("test1", 100)
gb2.record("Charlie", "test1", 85)
print("Charlie's percent (single default category):", gb2.percent("Charlie"))