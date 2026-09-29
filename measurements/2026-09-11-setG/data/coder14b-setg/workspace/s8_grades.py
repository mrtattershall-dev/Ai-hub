class Gradebook:
    def __init__(self, set_missing_zero=False):
        self.set_missing_zero = set_missing_zero
        self.students = {}
        self.categories = {}
        self.weights = {}

    def add_student(self, name):
        if name not in self.students:
            self.students[name] = {}

    def add_assignment(self, name, max_points):
        if name not in self.categories:
            self.categories[name] = []
        self.categories[name].append({'name': name, 'max_points': max_points})

    def record(self, student, assignment, points):
        if student not in self.students:
            self.add_student(student)
        if assignment not in self.categories:
            self.add_assignment(assignment, 0)
        self.students[student][assignment] = {'name': assignment, 'max_points': self.categories[assignment][0]['max_points'], 'points': points}

    def score(self, student, assignment):
        if student in self.students and assignment in self.students[student]:
            return self.students[student][assignment]['points']
        return 0

    def calculate_letter(percentage):
        if percentage >= 90:
            return 'A'
        elif percentage >= 80:
            return 'B'
        elif percentage >= 70:
            return 'C'
        elif percentage >= 60:
            return 'D'
        else:
            return 'F'

    def report(self):
        report = []
        for student, assignments in self.students.items():
            total_points = 0
            total_max_points = 0
            for assignment, score in assignments.items():
                total_points += score['points']
                total_max_points += score['max_points']
            percentage = (total_points / total_max_points) * 100
            report.append(f"{student}: {percentage:.2f}% ({self.calculate_letter(percentage)})")
        return "\n".join(report)

    def set_weight(self, category, weight):
        self.weights[category] = weight
def percent(self, student):
    self.drop_lowest('homework', 1)  # Example usage of drop_lowest
    total_points = 0
    total_max_points = 0
    for assignment, score in self.students[student].items():
        total_points += score['points']
        total_max_points += score['max_points']
    return (total_points / total_max_points) * 100

    def drop_lowest(self, category, n):
        if category not in self.categories:
            return
        
        category_assignments = self.categories[category]
        student_scores = {}
        
        for student, assignments in self.students.items():
            scores = [assignments[assignment] for assignment in category_assignments if assignment in assignments]
            if len(scores) > n:
                scores.sort(key=lambda x: x['points'] / x['max_points'])
                student_scores[student] = scores[n:]
            else:
                student_scores[student] = scores
        
        self.students = student_scores
def drop_lowest(self, category, n):
    if category not in self.categories:
        return
    
    category_assignments = self.categories[category]
    student_scores = {}
    
    for student, assignments in self.students.items():
        scores = [assignments[assignment] for assignment in category_assignments if assignment in assignments]
        if len(scores) > n:
            scores.sort(key=lambda x: x['points'] / x['max_points'])
            student_scores[student] = scores[n:]
        else:
            student_scores[student] = scores
    
    self.students = student_scores
    def __init__(self):
        self.students = {}
        self.assignments = {}

    def add_student(self, name):
        if name in self.students:
            raise ValueError("Student already exists")
        self.students[name] = {}

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
        self.students[student][assignment] = points

    def score(self, student, assignment):
        if student not in self.students:
            raise KeyError("Unknown student")
        if assignment not in self.students[student]:
            return None
        return self.students[student][assignment]

if __name__ == "__main__":
    # Test cases
    gb = Gradebook()
    gb.add_student("Alice")
    gb.add_assignment("Math", 100)
    gb.record("Alice", "Math", 85)
    assert gb.score("Alice", "Math") == 85
    print("All tests passed")
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
        self.students[student][assignment] = points
    def score(self, student, assignment):
        if student not in self.students:
            raise KeyError("Unknown student")
        if assignment not in self.students[student]:
            return None
        return self.students[student][assignment]
def calculate_letter(percentage):
    if percentage >= 90:
        return 'A'
    elif percentage >= 80:
        return 'B'
    elif percentage >= 70:
        return 'C'
    elif percentage >= 60:
        return 'D'
    else:
        return 'F'
def report(self):
    report_list = []
    for student in self.students:
        total_points = 0
        max_points = 0
        for assignment in self.assignments:
            points = self.record(student, assignment)
            max_points += self.assignments[assignment]
            total_points += points
        if max_points > 0:
            percentage = (total_points / max_points) * 100
            letter = calculate_letter(percentage)
        else:
            percentage = None
            letter = '-'
        report_list.append((student, percentage, letter))
    return sorted(report_list, key=lambda x: x[0])
    def set_weight(self, category, weight):
        if weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight

    def percent(self, student):
        total_points = 0
        total_max_points = 0
        category_weights = 0

        for assignment, points in self.students[student].items():
            category = self.assignments[assignment][1]
            max_points = self.assignments[assignment][0]
            total_points += points
            total_max_points += max_points
            category_weights += self.weights.get(category, 1)

        if total_max_points == 0:
            return 0

        weighted_percentage = (total_points / total_max_points) * (category_weights / len(self.weights))
        return round(weighted_percentage, 2)
