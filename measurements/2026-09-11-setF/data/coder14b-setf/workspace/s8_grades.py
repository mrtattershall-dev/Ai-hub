import csv
import sys

class Gradebook:
    def __init__(self):
        self.students = []
        self.assignments = []
        self.scores = {}

    def add_assignment(self, assignment):
        if assignment not in self.assignments:
            self.assignments.append(assignment)

    def add_student(self, student):
        if student not in self.students:
            self.students.append(student)

    def record(self, student, assignment, points, max_points, category=None):
        if (student, assignment) not in self.scores:
            self.scores[(student, assignment)] = []
        self.scores[(student, assignment)].append((points, max_points, category))

    def set_missing_zero(self):
        for student in self.students:
            for assignment in self.assignments:
                if (student, assignment) not in self.scores:
                    self.scores[(student, assignment)].append((0, 0))

    def set_weight(self, assignment, weight):
        pass

    def curve(self, points, max_points):
        pass

    def drop_lowest(self, student):
        pass

    def percent(self, student, assignment):
        total_points = 0
        total_max_points = 0
        for points, max_points, _ in self.scores[(student, assignment)]:
            total_points += points
            total_max_points += max_points
        return (total_points / total_max_points) * 100 if total_max_points != 0 else 0

    def letter_grade(self, student, assignment):
        percent = self.percent(student, assignment)
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

    def score(self, student, assignment):
        total_points = 0
        total_max_points = 0
        for points, max_points, _ in self.scores[(student, assignment)]:
            total_points += points
            total_max_points += max_points
        return total_points, total_max_points

    def report(self, student):
        report = f"Report for {student}:\n"
        for assignment in self.assignments:
            if (student, assignment) in self.scores:
                total_points, total_max_points = self.score(student, assignment)
                percent = self.percent(student, assignment)
                letter = self.letter_grade(student, assignment)
                report += f"  {assignment}: {total_points}/{total_max_points} ({percent:.2f}%) - {letter}\n"
        return report

    def stats(self):
        stats = {}
        for student in self.students:
            stats[student] = {}
            for assignment in self.assignments:
                if (student, assignment) in self.scores:
                    total_points, total_max_points = self.score(student, assignment)
                    percent = self.percent(student, assignment)
                    letter = self.letter_grade(student, assignment)
                    stats[student][assignment] = {
                        'total_points': total_points,
                        'total_max_points': total_max_points,
                        'percent': percent,
                        'letter': letter
                    }
        return stats

    def to_csv(self):
        lines = []
        for student in self.students:
            for assignment in self.assignments:
                if (student, assignment) in self.scores:
                    for points, max_points, category in self.scores[(student, assignment)]:
                        line = f"{student},{assignment},{points},{max_points}"
                        if category:
                            line += f",{category}"
                        lines.append(line)
        return "\n".join(lines)

def read_csv(file_path):
    try:
        with open(file_path, mode='r', newline='') as file:
            reader = csv.reader(file)
            for row in reader:
                if len(row) < 4:
                    raise ValueError(f"Invalid row: {row}")
                yield row
    except FileNotFoundError:
        print(f"File not found: {file_path}")
        sys.exit(1)
    except Exception as e:
        print(f"Error reading file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python s8_grades.py FILE")
        sys.exit(1)

    file_path = sys.argv[1]
    gradebook = Gradebook()
    for row in read_csv(file_path):
        student, assignment, points, max_points, *category = row
        points = int(points)
        max_points = int(max_points)
        category = category[0] if category else None
        gradebook.add_student(student)
        gradebook.add_assignment(assignment)
        gradebook.record(student, assignment, points, max_points, category)

    print(gradebook.to_csv())