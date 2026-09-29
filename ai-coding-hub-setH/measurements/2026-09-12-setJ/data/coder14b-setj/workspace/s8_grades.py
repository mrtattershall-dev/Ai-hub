class Gradebook:
    def __init__(self):
        self.students = set()
        self.assignments = {}
        self.grades = {}

    def add_student(self, name):
        if name in self.students:
            raise ValueError("Student already exists")
        self.students.add(name)
        self.grades[name] = {}

if __name__ == "__main__":
    gb = Gradebook()
    gb.add_student("Alice")
    assert "Alice" in gb.students
    try:
        gb.add_student("Alice")
    except ValueError as e:
        assert str(e) == "Student already exists"
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
    assert "Alice" in gb.students
    try:
        gb.add_student("Alice")
    except ValueError as e:
        assert str(e) == "Student already exists"

    gb.add_assignment("Math", 100)
    assert "Math" in gb.assignments
    assert gb.assignments["Math"] == 100
    try:
        gb.add_assignment("Math", 100)
    except ValueError as e:
        assert str(e) == "Assignment already exists"
    try:
        gb.add_assignment("Science", -10)
    except ValueError as e:
        assert str(e) == "Max points must be a positive number"

    gb.record("Alice", "Math", 85)
    assert gb.score("Alice", "Math") == 85
    try:
        gb.record("Alice", "Science", 85)
    except KeyError as e:
        assert str(e) == "Unknown assignment"
    try:
        gb.record("Bob", "Math", 85)
    except KeyError as e:
        assert str(e) == "Unknown student"
    try:
        gb.record("Alice", "Math", 110)
    except ValueError as e:
        assert str(e) == "Points must be between 0 and max points"

    gb.record("Alice", "Math", 90)
    assert gb.score("Alice", "Math") == 90
    assert gb.score("Alice", "Science") is None
    assert gb.score("Bob", "Math") is None
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    def add_assignment(self, name, max_points):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
