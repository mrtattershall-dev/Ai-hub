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

if __name__ == "__main__":
    # Test the Gradebook class
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
    assert g.score("Nonexistent", "Math Test") is None
    
    # Test duplicate student
    try:
        g.add_student("Alice")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    # Test duplicate assignment
    try:
        g.add_assignment("Math Test", 100)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    # Test invalid max points
    try:
        g.add_assignment("History Test", -10)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    try:
        g.add_assignment("History Test", 0)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    # Test invalid points
    try:
        g.record("Alice", "Math Test", 150)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    try:
        g.record("Alice", "Math Test", -10)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    # Test unknown student
    try:
        g.record("Charlie", "Math Test", 80)
        assert False, "Should have raised KeyError"
    except KeyError:
        pass
    
    # Test unknown assignment
    try:
        g.record("Alice", "English Test", 80)
        assert False, "Should have raised KeyError"
    except KeyError:
        pass
    
    # Test recording again (should replace)
    g.record("Alice", "Math Test", 90)
    assert g.score("Alice", "Math Test") == 90
    
    # Test percent function
    assert g.percent("Alice") == 90.0  # (85+45)/(100+50) = 130/150 = 0.866... → 86.67
    assert g.percent("Bob") == 92.0   # (92)/100 = 0.92 → 92.0
    
    # Test student with no scores
    g.add_student("Charlie")
    assert g.percent("Charlie") is None
    
    # Test unknown student raises KeyError
    try:
        g.percent("Unknown")
        assert False, "Should have raised KeyError"
    except KeyError:
        pass
    
    print("All tests passed!")