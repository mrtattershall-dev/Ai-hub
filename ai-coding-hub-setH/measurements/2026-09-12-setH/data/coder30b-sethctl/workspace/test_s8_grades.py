import pytest
from s8_grades import Gradebook

def test_letter_grades():
    """Test the letter grade conversion functionality."""
    gb = Gradebook()
    
    # Test None case
    assert gb.letter(None) == "-"
    
    # Test grade boundaries
    assert gb.letter(90) == "A"
    assert gb.letter(89.9) == "B"
    assert gb.letter(80) == "B"
    assert gb.letter(79.9) == "C"
    assert gb.letter(70) == "C"
    assert gb.letter(69.9) == "D"
    assert gb.letter(60) == "D"
    assert gb.letter(59.9) == "F"
    assert gb.letter(0) == "F"

def test_report():
    """Test the report method functionality."""
    gb = Gradebook()
    
    # Add students and assignments
    gb.add_student("Alice")
    gb.add_student("Bob")
    gb.add_assignment("Homework 1", 100)
    gb.add_assignment("Exam 1", 100)
    
    # Record some grades
    gb.record("Alice", "Homework 1", 95)
    gb.record("Alice", "Exam 1", 85)
    gb.record("Bob", "Homework 1", 75)
    gb.record("Bob", "Exam 1", 65)
    
    # Get report
    report = gb.report()
    
    # Should return list of (student, percent, letter) tuples sorted by student
    assert len(report) == 2
    assert report[0] == ("Alice", 90.0, "A")  # (95+85)/200 = 90%
    assert report[1] == ("Bob", 70.0, "C")    # (75+65)/200 = 70%
    
    # Test with student who has no grades
    gb.add_student("Charlie")
    report = gb.report()
    assert len(report) == 3
    assert report[2] == ("Charlie", None, "-")

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
def test_drop_lowest():
    """Test the drop_lowest functionality."""
    gb = Gradebook()
    
    # Add students and assignments
    gb.add_student("Alice")
    gb.add_student("Bob")
    gb.add_assignment("Homework 1", 100, "homework")
    gb.add_assignment("Homework 2", 100, "homework")
    gb.add_assignment("Homework 3", 100, "homework")
    gb.add_assignment("Exam 1", 200, "exam")
    
    # Record some grades
    gb.record("Alice", "Homework 1", 80)
    gb.record("Alice", "Homework 2", 90)
    gb.record("Alice", "Homework 3", 70)
    gb.record("Alice", "Exam 1", 180)
    
    gb.record("Bob", "Homework 1", 60)
    gb.record("Bob", "Homework 2", 70)
    gb.record("Bob", "Homework 3", 80)
    gb.record("Bob", "Exam 1", 160)
    
    # Test drop_lowest with n=1 for homework category
    gb.drop_lowest("homework", 1)
    
    # For Alice: should drop lowest homework score (70) and calculate average of 80 and 90
    # Homework average: (80+90)/200 = 85%
    # Exam average: 180/200 = 90%
    # Weighted average (assuming default weight 1 for both): (85+90)/2 = 87.5%
    assert gb.percent("Alice") == 87.5
    
    # For Bob: should drop lowest homework score (60) and calculate average of 70 and 80
    # Homework average: (70+80)/200 = 75%
    # Exam average: 160/200 = 80%
    # Weighted average (assuming default weight 1 for both): (75+80)/2 = 77.5%
    assert gb.percent("Bob") == 77.5
    
    # Test drop_lowest with n=0 (should not drop anything)
    gb2 = Gradebook()
    gb2.add_student("Alice")
    gb2.add_assignment("Homework 1", 100, "homework")
    gb2.add_assignment("Homework 2", 100, "homework")
    gb2.record("Alice", "Homework 1", 80)
    gb2.record("Alice", "Homework 2", 90)
    gb2.drop_lowest("homework", 0)
    assert gb2.percent("Alice") == 85.0  # (80+90)/200 = 85%

def test_drop_lowest_with_weights():
    """Test drop_lowest with category weights."""
    gb = Gradebook()
    
    # Add students and assignments
    gb.add_student("Alice")
    gb.add_assignment("Homework 1", 100, "homework")
    gb.add_assignment("Homework 2", 100, "homework")
    gb.add_assignment("Exam 1", 200, "exam")
    
    # Record some grades
    gb.record("Alice", "Homework 1", 80)
    gb.record("Alice", "Homework 2", 90)
    gb.record("Alice", "Exam 1", 180)
    
    # Set weights
    gb.set_weight("homework", 2)
    gb.set_weight("exam", 1)
    
    # Drop lowest homework score
    gb.drop_lowest("homework", 1)
    
    # For Alice: should drop lowest homework score (80) and calculate average of 90
    # Homework average: 90/100 = 90% with weight 2
    # Exam average: 180/200 = 90% with weight 1
    # Weighted average: (90*2 + 90*1) / (2+1) = 90%
    assert gb.percent("Alice") == 90.0

def test_drop_lowest_insufficient_assignments():
    """Test drop_lowest when student has fewer assignments than n."""
    gb = Gradebook()
    
    # Add students and assignments
    gb.add_student("Alice")
    gb.add_assignment("Homework 1", 100, "homework")
    gb.add_assignment("Homework 2", 100, "homework")
    gb.record("Alice", "Homework 1", 80)
    gb.record("Alice", "Homework 2", 90)
    
    # Try to drop 3 assignments (more than student has)
    gb.drop_lowest("homework", 3)
    
    # Should drop all assignments (since there are only 2)
    # So no assignments left for homework category
    assert gb.percent("Alice") == None  # No assignments in homework category
