from s8_grades import Gradebook

# Create a Gradebook instance
gradebook = Gradebook()

# Add students and assignments
gradebook.add_student("Alice")
gradebook.add_student("Bob")
gradebook.add_assignment("Homework 1", 100)
gradebook.add_assignment("Homework 2", 100)

# Record grades
gradebook.record("Alice", "Homework 1", 85)
gradebook.record("Bob", "Homework 1", 90)
gradebook.record("Alice", "Homework 2", 95)

# Generate CSV
csv_data = gradebook.to_csv()
print(csv_data)