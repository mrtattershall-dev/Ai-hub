class Gradebook:
    def drop_lowest(self, category, n):
        # Implementation will go here
        pass
    def __init__(self):
        self.students = []
        self.assignments = {}
        self.grades = {}

    def percent(self, student):
        if student not in self.students:
            raise KeyError("Unknown student")
        
        total_points = 0
        total_max_points = 0
        
        for assignment, points in self.grades[student].items():
            total_points += points
            total_max_points += self.assignments[assignment]
        
        if total_max_points == 0:
            return None
        
        return round((total_points / total_max_points) * 100, 2)

    def add_student(self, name):
        if name in self.students:
            raise ValueError("Student already exists")
        self.students.append(name)
        self.grades[name] = {}

    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points

    def record(self, student, assignment, points):
        if student not in self.students:
            raise KeyError("Unknown student")
        if assignment not in self.assignments:
            raise KeyError("Unknown assignment")
        if not (0 <= points <= self.assignments[assignment]):
            raise ValueError("Points must be between 0 and max points")
        self.grades[student][assignment] = points

    def score(self, student, assignment):
        if student not in self.students:
            return None
        if assignment not in self.assignments:
            return None
        return self.grades[student].get(assignment, None)

if __name__ == "__main__":
    gb = Gradebook()
    gb.add_student("Alice")
    gb.add_student("Bob")
    print(gb.students)  # Should print ['Alice', 'Bob']
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def record(self, student, assignment, points):
        if student not in self.students:
            raise KeyError("Unknown student")
        if assignment not in self.assignments:
            raise KeyError("Unknown assignment")
        if not (0 <= points <= self.assignments[assignment]):
            raise ValueError("Points must be between 0 and max points")
        self.grades[student][assignment] = points
    def score(self, student, assignment):
        if student not in self.students:
            return None
        if assignment not in self.assignments:
            return None
        return self.grades[student].get(assignment, None)
if __name__ == "__main__":
    gb = Gradebook()
    gb.add_student("Alice")
    gb.add_student("Bob")
    gb.add_assignment("Math", 100)
    gb.add_assignment("Science", 75)
    gb.record("Alice", "Math", 85)
    gb.record("Alice", "Science", 60)
    gb.record("Bob", "Math", 90)
    gb.record("Bob", "Science", 70)
    print(gb.score("Alice", "Math"))  # Should print 85
    print(gb.score("Alice", "Science"))  # Should print 60
    print(gb.score("Bob", "Math"))  # Should print 90
    print(gb.score("Bob", "Science"))  # Should print 70
    print(gb.score("Alice", "History"))  # Should print None
    print(gb.score("Charlie", "Math"))  # Should print None
def calculate_letter_grade(percent):
    if percent >= 90:
        return 'A'
    elif percent >= 80:
        return 'B'
    elif percent >= 70:
        return 'C'
    elif percent >= 60:
        return 'D'
    else:
        return 'F'
def report(self):
    report_list = []
    for student in sorted(self.students):
        percent = self.percent(student)
        letter = calculate_letter_grade(percent) if percent is not None else '-'
        report_list.append((student, percent, letter))
    return report_list
