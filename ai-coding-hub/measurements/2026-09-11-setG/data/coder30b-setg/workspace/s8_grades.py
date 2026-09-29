class Gradebook:
    def __init__(self):
        self.students = set()
        self.assignments = set()
        self.assignment_max_points = {}
        self.assignment_categories = {}
        self.category_weights = {}
        self.scores = {}
        self.dropped_scores = {}  # Store which scores to drop for each student in each category
        self.missing_zero = False  # When True, missing assignments count as 0 points
    
    def add_student(self, name):
        if name in self.students:
            raise ValueError("Student already exists")
        self.students.add(name)
    
    def add_assignment(self, name, max_points, category="default"):
        if name in self.assignments:
            raise ValueError("Assignment already exists")
        if not isinstance(max_points, (int, float)) or max_points <= 0:
            raise ValueError("Max points must be a positive number")
        self.assignments.add(name)
        self.assignment_max_points[name] = max_points
        self.assignment_categories[name] = category
        # Ensure the category has a default weight of 1
        if category not in self.category_weights:
            self.category_weights[category] = 1
    
    def set_weight(self, category, weight):
        if not isinstance(weight, (int, float)) or weight <= 0:
            raise ValueError("Weight must be a positive number")
        self.category_weights[category] = weight
    
    def record(self, student, assignment, points):
        if student not in self.students:
            raise KeyError("Unknown student")
        if assignment not in self.assignments:
            raise KeyError("Unknown assignment")
        if not isinstance(points, (int, float)) or points < 0 or points > self.assignment_max_points[assignment]:
            raise ValueError("Points must be between 0 and max points")
        if student not in self.scores:
            self.scores[student] = {}
        self.scores[student][assignment] = points
    
    def score(self, student, assignment):
        if student not in self.students or assignment not in self.assignments:
            return None
        if student not in self.scores or assignment not in self.scores[student]:
            return None
        return self.scores[student][assignment]
    
    def percent(self, student):
        if student not in self.students:
            raise KeyError("Unknown student")
        
        # Group scores by category
        category_points = {}
        category_max_points = {}
        category_assignments = {}  # Store assignments for each category to help with dropping
        
        # If missing_zero is True, we need to consider ALL assignments for this student
        # Otherwise, we only consider assignments that have scores
        if self.missing_zero and student not in self.scores:
            # Student has no scores at all, but we want to count missing assignments as 0
            # We'll iterate through all assignments and treat missing ones as 0 points
            all_assignments = self.assignments
        elif self.missing_zero and student in self.scores:
            # Student has some scores, but we want to count missing assignments as 0
            # We'll iterate through all assignments and treat missing ones as 0 points
            all_assignments = self.assignments
        else:
            # Default behavior - only process assignments that have scores
            all_assignments = self.scores.get(student, {}).keys()
        
        for assignment in all_assignments:
            if assignment not in self.assignment_categories:
                continue  # Skip assignments that don't have a category
            
            category = self.assignment_categories[assignment]
            max_points = self.assignment_max_points[assignment]
            
            # Check if this assignment has a score
            if student in self.scores and assignment in self.scores[student]:
                points = self.scores[student][assignment]
            else:
                # If missing_zero is True, treat missing assignment as 0 points
                # If missing_zero is False, skip missing assignments
                if not self.missing_zero:
                    continue
                points = 0
            
            if category not in category_points:
                category_points[category] = 0
                category_max_points[category] = 0
                category_assignments[category] = []
            
            category_points[category] += points
            category_max_points[category] += max_points
            category_assignments[category].append((assignment, points))
        
        # Calculate weighted average
        total_weighted_points = 0
        total_weights = 0
        
        for category in category_points:
            if category_max_points[category] > 0:
                # Get the assignments for this category
                assignments_in_category = category_assignments[category]
                
                # Check if we should drop any scores for this category
                dropped_assignments = self._get_dropped_assignments(student, category)
                
                # If we have dropped assignments, filter them out
                if dropped_assignments:
                    # Filter out assignments that are marked for dropping
                    filtered_assignments = [(a, p) for a, p in assignments_in_category if a not in dropped_assignments]
                else:
                    filtered_assignments = assignments_in_category
                
                # If we have enough assignments to drop n of them, sort by points and drop the lowest
                if category in self.dropped_scores and student in self.dropped_scores[category]:
                    n = self.dropped_scores[category][student] if self.dropped_scores[category][student] else 0
                    if n > 0 and len(filtered_assignments) > n:
                        # Sort by points (ascending) and drop the lowest n
                        sorted_assignments = sorted(filtered_assignments, key=lambda x: x[1])
                        assignments_to_drop = [assignment for assignment, _ in sorted_assignments[:n]]
                        
                        # Filter out the dropped assignments
                        filtered_assignments = [(a, p) for a, p in filtered_assignments if a not in assignments_to_drop]
                
                # Calculate the category percentage
                remaining_points = sum(points for _, points in filtered_assignments)
                remaining_max_points = sum(self.assignment_max_points[assignment] for assignment, _ in filtered_assignments)
                
                if remaining_max_points > 0:
                    category_percentage = (remaining_points / remaining_max_points) * 100
                    weight = self.category_weights[category]
                    total_weighted_points += category_percentage * weight
                    total_weights += weight
        
        if total_weights == 0:
            return None
            
        return round(total_weighted_points / total_weights, 2)
    
    def letter_grade(self, percent):
        """Convert a percentage to a letter grade.
        
        Args:
            percent: The percentage score (float or None)
            
        Returns:
            The letter grade (str) or "-" if percent is None
        """
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
    
    def report(self):
        """Generate a report of all students with their percentages and letter grades.
        
        Returns:
            A list of tuples (student, percent, letter) sorted by student name
        """
        result = []
        for student in sorted(self.students):
            percent = self.percent(student)
            letter = self.letter_grade(percent)
            result.append((student, percent, letter))
        return result
    
    def drop_lowest(self, category, n):
        """Mark the lowest n scores in a category to be dropped when calculating percent grades.
        
        Args:
            category: The category name
            n: The number of lowest scores to drop
        """
        if n < 0:
            raise ValueError("n must be non-negative")
        if not isinstance(n, int):
            raise ValueError("n must be an integer")
        
        # Store the drop information for each student
        # This will be used in percent() method to exclude these scores
        if category not in self.dropped_scores:
            self.dropped_scores[category] = {}
        
        # For each student, we need to determine which assignments to drop
        # We'll store this information in the dropped_scores structure
        # But we need to know which students have scores in this category
        for student in self.students:
            if student in self.scores:
                # Get all assignments for this student in this category
                student_assignments = [(a, p) for a, p in self.scores[student].items() 
                                     if self.assignment_categories[a] == category]
                
                # If student has enough assignments, sort by points and drop the lowest n
                if len(student_assignments) > n:
                    # Sort by points (ascending) and get the n lowest
                    sorted_assignments = sorted(student_assignments, key=lambda x: x[1])
                    assignments_to_drop = [assignment for assignment, _ in sorted_assignments[:n]]
                    
                    # Store the assignments to drop for this student
                    if student not in self.dropped_scores[category]:
                        self.dropped_scores[category][student] = []
                    self.dropped_scores[category][student] = assignments_to_drop
                else:
                    # Not enough assignments to drop n, so drop none
                    if student not in self.dropped_scores[category]:
                        self.dropped_scores[category][student] = []
                    self.dropped_scores[category][student] = []
    
    def _get_dropped_assignments(self, student, category):
        """Get the list of assignments that should be dropped for a student in a category.
        
        Args:
            student: The student name
            category: The category name
            
        Returns:
            A list of assignment names to drop
        """
        if category not in self.dropped_scores or student not in self.dropped_scores[category]:
            return []
        return self.dropped_scores[category][student] if self.dropped_scores[category][student] else []
    
    def set_missing_zero(self, flag):
        """Set whether missing assignments should be counted as 0 points.
        
        Args:
            flag (bool): If True, missing assignments count as 0 points in percent() calculation.
                        If False, missing assignments are ignored in percent() calculation.
        """
        self.missing_zero = bool(flag)
    
    def curve(self, assignment, points):
        """Add points to every recorded score for an assignment, capped at max_points.
        
        Args:
            assignment (str): The name of the assignment
            points (float): The number of points to add
            
        Returns:
            int: The number of scores that were changed
        """
        # Check if assignment exists
        if assignment not in self.assignments:
            raise KeyError("Unknown assignment")
        
        # Get the max points for this assignment
        max_points = self.assignment_max_points[assignment]
        
        # Counter for changed scores
        changed_count = 0
        
        # Iterate through all students and update their scores
        for student in self.students:
            # Check if student has a score for this assignment
            if student in self.scores and assignment in self.scores[student]:
                current_score = self.scores[student][assignment]
                # Add points and cap at max_points
                new_score = min(current_score + points, max_points)
                # If the score changed, increment the counter
                if new_score != current_score:
                    self.scores[student][assignment] = new_score
                    changed_count += 1
        
        return changed_count
    def to_csv(self):
        """Generate CSV text representation of the gradebook.
        
        Returns:
            A CSV string with header and one line per student, sorted by name.
            Format: "student,<assignments>,percent,letter"
        """
        if not self.assignments:
            return "student,,percent,letter"
        
        # Get assignments in order (using the set's iteration order, which should be consistent)
        assignments = sorted(list(self.assignments))
        
        # Build header
        header = "student," + ",".join(assignments) + ",percent,letter"
        
        # Build data rows
        rows = [header]
        for student in sorted(self.students):
            # Get scores for each assignment
            scores = []
            for assignment in assignments:
                if student in self.scores and assignment in self.scores[student]:
                    scores.append(str(self.scores[student][assignment]))
                else:
                    scores.append("")
            
            # Calculate percent and letter grade
            percent = self.percent(student)
            if percent is None:
                percent_str = ""
            else:
                percent_str = f"{percent:.2f}"
            
            letter = self.letter_grade(percent)
            
            # Build the row
            row = ",".join([student] + scores + [percent_str, letter])
            rows.append(row)
        
        return "\n".join(rows)
