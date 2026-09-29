class Gradebook:
    def __init__(self):
        self.students = {}
        self.assignments = {}
        self.scores = {}

    def add_student(self, name):
        if name in self.students:
            raise ValueError(f"Student {name} already exists.")
        self.students[name] = {}
        self.scores[name] = {}
        print(f"Added student {name} with scores: {self.scores[name]}")

    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError(f"Assignment {name} already exists.")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number.")
        self.assignments[name] = max_points
        for student in self.students:
            self.scores[student][name] = None

    def record(self, student, assignment, points):
        if student not in self.students:
            raise KeyError(f"Student {student} does not exist.")
        if assignment not in self.assignments:
            raise KeyError(f"Assignment {assignment} does not exist.")
        if points < 0 or points > self.assignments[assignment]:
            raise ValueError(f"Points must be between 0 and {self.assignments[assignment]}.")
        self.scores[student][assignment] = points

    def score(self, student, assignment):
        if student not in self.students:
            raise KeyError(f"Student {student} does not exist.")
        if assignment not in self.assignments:
            raise KeyError(f"Assignment {assignment} does not exist.")
        return self.scores[student].get(assignment, None)

if __name__ == "__main__":
    gb = Gradebook()
    gb.add_student("Alice")
    gb.add_student("Bob")
    gb.add_assignment("Math", 100)
    gb.add_assignment("Science", 90)
    gb.record("Alice", "Math", 85)
    gb.record("Bob", "Science", 88)
    assert gb.score("Alice", "Math") == 85
    assert gb.score("Bob", "Science") == 88
    assert gb.score("Alice", "Science") is None
    assert gb.score("Bob", "Math") is None
    try:
        gb.add_student("Alice")
    except ValueError as e:
        assert str(e) == "Student Alice already exists."
    try:
        gb.add_assignment("Math", 100)
    except ValueError as e:
        assert str(e) == "Assignment Math already exists."
    try:
        gb.add_assignment("History", -10)
    except ValueError as e:
        assert str(e) == "Max points must be a positive number."
    try:
        gb.record("Charlie", "Math", 90)
    except KeyError as e:
        assert str(e) == "'Student Charlie does not exist.'"
    try:
        gb.record("Alice", "History", 90)
    except KeyError as e:
        assert str(e) == "'Assignment History does not exist.'"
    try:
        gb.record("Alice", "Math", 110)
    except ValueError as e:
        assert str(e) == "Points must be between 0 and 100."
    print("All tests passed.")
    def percent(self, student):
        if student not in self.students:
            raise KeyError(f"Student {student} does not exist.")
        
        total_points = 0
        total_max_points = 0
        
        for assignment, points in self.scores[student].items():
            if points is not None:
                total_points += points
                total_max_points += self.assignments[assignment]
        
        if total_max_points == 0:
            return None
        
        return round((total_points / total_max_points) * 100, 2)
