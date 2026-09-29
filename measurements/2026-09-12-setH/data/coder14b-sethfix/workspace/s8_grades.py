class Gradebook:
    def drop_lowest(self, category, n):
        if category not in self.categories:
            raise ValueError("Category does not exist")
        student_scores = {}
        for student, assignments in self.grades.items():
            if category in assignments:
                scores = [self.grades[student][assignment] / self.assignments[assignment]
                          for assignment in assignments if assignment in self.assignments]
                scores.sort()
                if len(scores) > n:
                    student_scores[student] = sum(scores[n:])
                else:
                    student_scores[student] = sum(scores)
        return student_scores
                            def __init__(self):
        self.categories = {}
        self.weights = {}
        self.categories = {}
        self.weights = {}
        self.categories = {}
        self.weights = {}
        self.categories = {}
        self.weights = {}
        self.categories = {}
        self.weights = {}
        self.categories = {}
        self.weights = {}
        self.students = {}
        self.assignments = {}
        self.grades = {}

    def add_student(self, name):
        if name in self.students:
            raise ValueError("Student already exists")
        self.students[name] = True
    def add_assignment(self, name, max_points, category="default"):
        if category not in self.categories:
            self.categories[category] = []
        self.categories[category].append((name, max_points))
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
        if student not in self.grades:
            self.grades[student] = {}
        self.grades[student][assignment] = points

    def score(self, student, assignment):
        if student not in self.students:
            raise KeyError("Unknown student")
        if assignment not in self.assignments:
            raise KeyError("Unknown assignment")
        return self.grades.get(student, {}).get(assignment, None)

# Test the Gradebook class
if __name__ == "__main__":
    gb = Gradebook()
    gb.add_student("Alice")
    print("Student added successfully")
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
    for student in self.students:
        student_scores = self.scores.get(student, {})
        total_points = sum(student_scores.values())
        max_points = sum(self.assignments.values())
        percent = (total_points / max_points) * 100 if max_points > 0 else None
        letter = calculate_letter_grade(percent) if percent is not None else '-'
        report_list.append((student, percent, letter))
    return sorted(report_list, key=lambda x: x[0])
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight
