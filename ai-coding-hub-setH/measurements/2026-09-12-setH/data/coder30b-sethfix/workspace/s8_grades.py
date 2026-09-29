class Gradebook:
    def __init__(self):
        self.students = {}
        self.assignments = {}
        self.categories = {}
        self._dropped = {}  # Store dropped scores by category
    
    def add_student(self, name):
        if name in self.students:
            raise ValueError("Student already exists")
        self.students[name] = {}
    
    def add_assignment(self, name, max_points, category="default"):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if not isinstance(max_points, (int, float)) or max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments[name] = {"max_points": max_points, "category": category}
        # Ensure category exists in categories dict
        if category not in self.categories:
            self.categories[category] = 1.0  # Default weight is 1.0
    
    def set_weight(self, category, weight):
        if not isinstance(weight, (int, float)) or weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.categories[category] = weight
    
    def drop_lowest(self, category, n):
        """Ignore the n lowest scores (by percentage of max_points) a student has in that category,
        but only when the student has more than n scores there."""
        if category not in self._dropped:
            self._dropped[category] = {}
        self._dropped[category]["n"] = n
    
    def record(self, student, assignment, points):
        if student not in self.students:
            raise KeyError("Unknown student")
        if assignment not in self.assignments:
            raise KeyError("Unknown assignment")
        max_points = self.assignments[assignment]["max_points"]
        if not isinstance(points, (int, float)) or points < 0 or points > max_points:
            raise ValueError("Points must be between 0 and max points")
        self.students[student][assignment] = points

    def score(self, student, assignment):
        if student not in self.students or assignment not in self.students[student]:
            return None
        return self.students[student][assignment]
    def percent(self, student):
        if student not in self.students:
            raise KeyError("Unknown student")
        
        # Group scores by category
        category_scores = {}
        category_max_points = {}
        
        for assignment, assignment_info in self.assignments.items():
            score = self.score(student, assignment)
            if score is not None:
                category = assignment_info["category"]
                max_points = assignment_info["max_points"]
                
                if category not in category_scores:
                    category_scores[category] = []
                    category_max_points[category] = []
                
                category_scores[category].append(score)
                category_max_points[category].append(max_points)
        
        # If no assignments, return None
        if not category_scores:
            return None
        
        # Apply drop_lowest logic
        for category, scores in category_scores.items():
            if category in self._dropped and "n" in self._dropped[category]:
                n = self._dropped[category]["n"]
                if len(scores) > n:
                    # Calculate percentages and sort them
                    percentages = [(score/max_points)*100 for score, max_points in zip(scores, category_max_points[category])]
                    # Sort percentages in ascending order (lowest first)
                    percentages.sort()
                    # Drop the lowest n percentages
                    dropped_percentages = percentages[n:]
                    # Recalculate scores based on remaining percentages
                    dropped_scores = []
                    dropped_max_points = []
                    for i, (score, max_points) in enumerate(zip(scores, category_max_points[category])):
                        percentage = (score/max_points)*100
                        if percentage in dropped_percentages:
                            dropped_scores.append(score)
                            dropped_max_points.append(max_points)
                    category_scores[category] = dropped_scores
                    category_max_points[category] = dropped_max_points
        
        # Calculate weighted average
        total_weighted_percentage = 0
        total_weight = 0
        
        for category, scores in category_scores.items():
            if not scores:
                continue
            score = sum(scores)
            max_points = sum(category_max_points[category])
            percentage = (score / max_points) * 100
            weight = self.categories[category]
            
            total_weighted_percentage += percentage * weight
            total_weight += weight
        
        # Normalize by total weight
        if total_weight == 0:
            return None
        return round(total_weighted_percentage / total_weight, 2)

    def report(self):
        """Return a list of (student, percent, letter) sorted by student."""
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
    # Test cases
    def run_tests():
        gradebook = Gradebook()
        
        # Test add_student
        gradebook.add_student("Alice")
        gradebook.add_student("Bob")
        