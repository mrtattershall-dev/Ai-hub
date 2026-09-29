def letter_grade(percent):
    """Convert a percentage to a letter grade."""
    if percent is None:
        return "-"
    elif percent >= 90:
        return "A"
    elif percent >= 80:
        return "B"
    elif percent >= 70:
        return "C"
    elif percent >= 60:
        return "D"
    else:
        return "F"

class Gradebook:
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
        if not isinstance(max_points, (int, float)) or max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = max_points
    
    def record(self, student, assignment, points):
        if student not in self.students:
            raise KeyError("Unknown student")
        if assignment not in self.assignments:
            raise KeyError("Unknown assignment")
        if not isinstance(points, (int, float)) or points < 0 or points > self.assignments[assignment]:
            raise ValueError("Points must be between 0 and max points")
        self.students[student][assignment] = points
    
    def score(self, student, assignment):
        if student not in self.students or assignment not in self.students[student]:
            return None
        return self.students[student][assignment]
    
    def percent(self, student):
        if student not in self.students:
            raise KeyError("Unknown student")
        
        total_points = 0
        total_max_points = 0
        
        for assignment, points in self.students[student].items():
            total_points += points
            total_max_points += self.assignments[assignment]
        
        if total_max_points == 0:
            return None
            
        return round((total_points / total_max_points) * 100, 2)
    
    def report(self):
        """Return a list of (student, percent, letter) sorted by student."""
        result = []
        for student in sorted(self.students.keys()):
            percent = self.percent(student)
            letter = letter_grade(percent)
            result.append((student, percent, letter))
        return result

if __name__ == "__main__":
    # Test the Gradebook functionality
    g = Gradebook()
    
    # Test add_student
    g.add_student("Alice")
    g.add_student("Bob")
    
    # Test add_assignment
    g.add_assignment("Math Test", 100)
    g.add_assignment("Science Quiz", 50)
    
    # Test record
    g.record("Alice", "Math Test", 85)
    g.record("Alice", "Science Quiz", 45)
    g.record("Bob", "Math Test", 92)
    
    # Test score
    assert g.score("Alice", "Math Test") == 85
    assert g.score("Alice", "Science Quiz") == 45
    assert g.score("Bob", "Math Test") == 92
    assert g.score("Alice", "Nonexistent") is None
    
    # Test duplicate student