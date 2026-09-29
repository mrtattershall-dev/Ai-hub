import pytest
from s8_grades import Gradebook, letter_grade

def test_letter_grade():
    assert letter_grade(95) == "A"
    assert letter_grade(85) == "B"
    assert letter_grade(75) == "C"
    assert letter_grade(65) == "D"
    assert letter_grade(55) == "F"
    assert letter_grade(None) == "-"
    assert letter_grade(100) == "A"
    assert letter_grade(90) == "A"
    assert letter_grade(89) == "B"
    assert letter_grade(80) == "B"
    assert letter_grade(79) == "C"
    assert letter_grade(70) == "C"
    assert letter_grade(69) == "D"
    assert letter_grade(60) == "D"
    assert letter_grade(59) == "F"

def test_gradebook_report():
    g = Gradebook()
    
    # Test empty gradebook
    assert g.report() == []
    
    # Test with students and assignments
    g.add_student("Alice")
    g.add_student("Bob")
    g.add_assignment("Math Test", 100)
    g.add_assignment("Science Quiz", 50)
    
    # Record some grades
    g.record("Alice", "Math Test", 85)
    g.record("Alice", "Science Quiz", 45)
    g.record("Bob", "Math Test", 92)
    
    # Test report
    report = g.report()
    assert len(report) == 2
    
    # Check Alice's report
    alice_report = next(item for item in report if item[0] == "Alice")
    assert alice_report[0] == "Alice"
    assert alice_report[1] == 86.67  # (85 + 45) / 150 * 100
    assert alice_report[2] == "B"   # 86.67% is a B
    
    # Check Bob's report
    bob_report = next(item for item in report if item[0] == "Bob")
    assert bob_report[0] == "Bob"
    assert bob_report[1] == 92.0  # 92 / 100 * 100
    assert bob_report[2] == "A"   # 92% is an A
    
    # Test sorting by student name
    assert report[0][0] == "Alice"
    assert report[1][0] == "Bob"

def test_gradebook_report_with_none():
    g = Gradebook()
    g.add_student("Charlie")
    g.add_assignment("No Grades", 100)
    
    # Charlie has no grades recorded
    report = g.report()
    assert len(report) == 1
    assert report[0][0] == "Charlie"
    assert report[0][1] is None
    assert report[0][2] == "-"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])