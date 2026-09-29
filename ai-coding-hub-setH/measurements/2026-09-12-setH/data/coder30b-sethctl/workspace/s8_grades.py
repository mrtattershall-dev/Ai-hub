class Gradebook:
    def __init__(self):
        self.students = {}
        self.assignments = {}
        self.categories = {}
        self.weights = {}
        self.dropped = {}  # Track dropped scores per student per category
        self.missing_zero_flag = False  # When True, missing assignments count as 0 points
    
    def set_missing_zero(self, flag):
        """Set whether missing assignments should be counted as zero points.
        
        Args:
            flag (bool): True to count missing assignments as 0 points,
                        False to exclude them from the calculation.
        """
        if not isinstance(flag, bool):
            raise ValueError("Flag must be a boolean value")
        self.missing_zero_flag = flag
    
    def add_student(self, name):
        if name in self.students:
            raise ValueError("Student already exists")
        self.students[name] = {}
    
    def add_assignment(self, name, max_points, category="default"):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if not isinstance(max_points, (int, float)) or max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = {
            "max_points": max_points,
            "category": category
        }
        # Ensure category exists
        if category not in self.categories:
            self.categories[category] = []
        self.categories[category].append(name)
    
    def record(self, student, assignment, points):
        if student not in self.students:
            raise KeyError("Unknown student")
        if assignment not in self.assignments:
            raise KeyError("Unknown assignment")
        if not isinstance(points, (int, float)) or points < 0 or points > self.assignments[assignment]["max_points"]:
            raise ValueError("Points must be between 0 and max points")
        self.students[student][assignment] = points
    
    def score(self, student, assignment):
        if student not in self.students or assignment not in self.students[student]:
            return None
        return self.students[student][assignment]
    
    def percent(self, student):
        """Return the weighted percentage for a student."""
        if student not in self.students:
            return None
        
        # Group assignments by category
        category_scores = {}
        category_max_points = {}
        
        # If missing_zero_flag is True, we include all assignments from each category
        # even if they're missing from the student's record
        if self.missing_zero_flag:
            # Process all assignments in each category
            for category, assignments in self.categories.items():
                category_scores[category] = 0
                category_max_points[category] = 0
                
                for assignment_name in assignments:
                    assignment_info = self.assignments[assignment_name]
                    max_points = assignment_info["max_points"]
                    category_max_points[category] += max_points
                    
                    # Check if student has this assignment
                    if (student in self.students and 
                        assignment_name in self.students[student]):
                        points = self.students[student][assignment_name]
                    else:
                        points = 0  # Missing assignment counts as 0 points
                    
                    # Skip dropped assignments
                    if student in self.dropped and category in self.dropped[student]:
                        if assignment_name in self.dropped[student][category]:
                            continue
                    
                    category_scores[category] += points
        else:
            # Get all assignments for this student (original behavior)
            student_assignments = self.students[student]
            
            for assignment, points in student_assignments.items():
                assignment_info = self.assignments[assignment]
                category = assignment_info["category"]
                max_points = assignment_info["max_points"]
                
                # Skip dropped assignments
                if student in self.dropped and category in self.dropped[student]:
                    if assignment in self.dropped[student][category]:
                        continue
                
                if category not in category_scores:
                    category_scores[category] = 0
                    category_max_points[category] = 0
                
                category_scores[category] += points
                category_max_points[category] += max_points
        
        # If no assignments, return None
        if not category_scores:
            return None
        
        # Calculate weighted average
        total_weighted_score = 0
        total_weighted_max = 0
        
        # Get weights for categories that have scores
        categories_with_scores = list(category_scores.keys())
        weights = {}
        
        # Assign default weight of 1 to categories without explicit weight
        for category in categories_with_scores:
            if category in self.weights:
                weights[category] = self.weights[category]
            else:
                weights[category] = 1
        
        # Calculate total weighted score
        for category in categories_with_scores:
            score = category_scores[category]
            max_points = category_max_points[category]
            weight = weights[category]
            
            # Calculate percentage for this category
            if max_points > 0:
                category_percent = (score / max_points) * 100
                total_weighted_score += category_percent * weight
                total_weighted_max += weight
        
        # Return weighted average percentage, rounded to 2 decimals
        if total_weighted_max > 0:
            return round(total_weighted_score / total_weighted_max, 2)
        else:
            return None

    def letter(self, percent):
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

    def set_weight(self, category, weight):
        if not isinstance(weight, (int, float)) or weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.weights[category] = weight

    def drop_lowest(self, category, n):
        """Drop the lowest n scores in a category for all students."""
        if n < 0:
            raise ValueError("n must be non-negative")
        if category not in self.categories:
            raise ValueError("Category does not exist")
        
        # For each student, get their scores in this category
        for student in self.students:
            if student not in self.dropped:
                self.dropped[student] = {}
            if category not in self.dropped[student]:
                self.dropped[student][category] = []
            
            # Get all assignments in this category for this student
            student_assignments = self.students[student]
            scores = []
            for assignment, points in student_assignments.items():
                if assignment in self.assignments and self.assignments[assignment]["category"] == category:
                    scores.append((assignment, points))
            
            # Sort scores by points (ascending) and drop the lowest n
            scores.sort(key=lambda x: x[1])
            dropped_assignments = [assignment for assignment, points in scores[:n]]
            self.dropped[student][category].extend(dropped_assignments)

    def report(self):
        """Return a list of (student, percent, letter) sorted by student."""
        result = []
        for student in sorted(self.students.keys()):
            percent = self.percent(student)
            letter = self.letter(percent)
            result.append((student, percent, letter))
        return result

if __name__ == "__main__":
    # Test cases
    gb = Gradebook()
    
    # Test add_student
    gb.add_student("Alice")
    gb.add_student("Bob")
    
    # Test add_assignment
    gb.add_assignment("Homework 1", 100)
    gb.add_assignment("Exam 1", 200)
    
    # Test record
    gb.record("Alice", "Homework 1", 85)
    gb.record("Bob", "Homework 1", 92)
    gb.record("Alice", "Exam 1", 175)
    
    # Test score
    assert gb.score("Alice", "Homework 1") == 85
    assert gb.score("Bob", "Homework 1") == 92
    assert gb.score("Alice", "Exam 1") == 175
    assert gb.score("Bob", "Exam 1") is None
    
    # Test duplicate student
    try:
        gb.add_student("Alice")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    # Test duplicate assignment
    try:
        gb.add_assignment("Homework 1", 100)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    # Test invalid max points
    try:
        gb.add_assignment("Test", -5)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    try:
        gb.add_assignment("Test", 0)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    # Test invalid points
    try:
        gb.record("Alice", "Homework 1", -5)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    try:
        gb.record("Alice", "Homework 1", 150)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    
    # Test unknown student
    try:
        gb.record("Charlie", "Homework 1", 50)
        assert False, "Should have raised KeyError"
    except KeyError:
        pass
    
    # Test unknown assignment
    try:
        gb.record("Alice", "Quiz 1", 50)
        assert False, "Should have raised KeyError"
    except KeyError:
        pass
    
    print("All tests passed!")