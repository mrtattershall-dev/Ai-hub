#!/usr/bin/env python3

import sys
sys.path.append('.')

from s8_grades import Gradebook

def test_basic_functionality():
    """Test basic functionality still works"""
    gradebook = Gradebook()
    
    # Test add_student
    gradebook.add_student("Alice")
    gradebook.add_student("Bob")
    
    # Test add_assignment
    gradebook.add_assignment("Homework 1", 100)
    gradebook.add_assignment("Quiz 1", 50)
    
    # Test record
    gradebook.record("Alice", "Homework 1", 80)
    gradebook.record("Alice", "Quiz 1", 40)
    gradebook.record("Bob", "Homework 1", 90)
    gradebook.record("Bob", "Quiz 1", 45)
    
    # Test score
    assert gradebook.score("Alice", "Homework 1") == 80
    assert gradebook.score("Alice", "Quiz 1") == 40
    assert gradebook.score("Bob", "Homework 1") == 90
    assert gradebook.score("Bob", "Quiz 1") == 45
    
    # Test percent
    assert gradebook.percent("Alice") == 60.0  # (80+40)/(100+50) = 120/150 = 0.8 = 80%
    assert gradebook.percent("Bob") == 85.0   # (90+45)/(100+50) = 135/150 = 0.9 = 90%
    
    print("Basic functionality tests passed!")

def test_categories():
    """Test new category functionality"""
    gradebook = Gradebook()
    
    # Test add_student
    gradebook.add_student("Alice")
    
    # Test add_assignment with categories
    gradebook.add_assignment("Homework 1", 100, "Homework")
    gradebook.add_assignment("Quiz 1", 50, "Quiz")
    gradebook.add_assignment("Exam 1", 200, "Exam")
    
    # Test record
    gradebook.record("Alice", "Homework 1", 80)
    gradebook.record("Alice", "Quiz 1", 40)
    gradebook.record("Alice", "Exam 1", 150)
    
    # Test percent (should be unweighted average)
    assert gradebook.percent("Alice") == 70.0  # (80+40+150)/(100+50+200) = 270/350 = 0.7714... = 77.14%
    
    print("Category tests passed!")

def test_weights():
    """Test weight functionality"""
    gradebook = Gradebook()
    
    # Test add_student
    gradebook.add_student("Alice")
    
    # Test add_assignment with categories
    gradebook.add_assignment("Homework 1", 100, "Homework")
    gradebook.add_assignment("Quiz 1", 50, "Quiz")
    gradebook.add_assignment("Exam 1", 200, "Exam")
    
    # Set weights
    gradebook.set_weight("Homework", 0.5)
    gradebook.set_weight("Quiz", 0.3)
    gradebook.set_weight("Exam", 0.2)
    
    # Test record
    gradebook.record("Alice", "Homework 1", 80)
    gradebook.record("Alice", "Quiz 1", 40)
    gradebook.record("Alice", "Exam 1", 150)
    
    # Test percent (should be weighted average)
    # Homework: 80/100 = 80%, Quiz: 40/50 = 80%, Exam: 150/200 = 75%
    # Weighted average: 0.5*80 + 0.3*80 + 0.2*75 = 40 + 24 + 15 = 79%
    assert gradebook.percent("Alice") == 79.0
    
    print("Weight tests passed!")

def test_default_category():
    """Test that assignments without categories default to 'default'"""
    gradebook = Gradebook()
    
    # Test add_student
    gradebook.add_student("Alice")
    
    # Test add_assignment without category (should default to "default")
    gradebook.add_assignment("Homework 1", 100)
    
    # Test record
    gradebook.record("Alice", "Homework 1", 80)
    
    # Test percent
    assert gradebook.percent("Alice") == 80.0
    
    print("Default category tests passed!")

def test_weight_validation():
    """Test weight validation"""
    gradebook = Gradebook()
    
    # Test add_student
    gradebook.add_student("Alice")
    
    # Test add_assignment with categories
    gradebook.add_assignment("Homework 1", 100, "Homework")
    
    # Test invalid weights
    try:
        gradebook.set_weight("Homework", -1)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass  # Expected
    
    try:
        gradebook.set_weight("Homework", 0)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass  # Expected
    
    print("Weight validation tests passed!")

if __name__ == "__main__":
    test_basic_functionality()
    test_categories()
    test_weights()
    test_default_category()
    test_weight_validation()
    print("All tests passed!")
def test_drop_lowest():
    """Test drop_lowest functionality"""
    gradebook = Gradebook()
    
    # Test add_student
    gradebook.add_student("Alice")
    
    # Test add_assignment with categories
    gradebook.add_assignment("Homework 1", 100, "Homework")
    gradebook.add_assignment("Homework 2", 100, "Homework")
    gradebook.add_assignment("Homework 3", 100, "Homework")
    gradebook.add_assignment("Quiz 1", 50, "Quiz")
    gradebook.add_assignment("Quiz 2", 50, "Quiz")
    
    # Set weights
    gradebook.set_weight("Homework", 0.8)
    gradebook.set_weight("Quiz", 0.2)
    
    # Test record
    gradebook.record("Alice", "Homework 1", 80)  # 80%
    gradebook.record("Alice", "Homework 2", 90)  # 90%
    gradebook.record("Alice", "Homework 3", 70)  # 70%
    gradebook.record("Alice", "Quiz 1", 40)      # 80%
    gradebook.record("Alice", "Quiz 2", 45)      # 90%
    
    # Test percent without dropping
    assert gradebook.percent("Alice") == 82.0  # (80+90+70)/300*0.8 + (40+45)/100*0.2 = 240/300*0.8 + 85/100*0.2 = 0.8*0.8 + 0.85*0.2 = 0.64 + 0.17 = 0.81 = 81%
    
    # Drop the lowest homework score (70%)
    gradebook.drop_lowest("Homework", 1)
    
    # Test percent with dropping
    # Should ignore Homework 3 (70%) and calculate: (80+90)/200*0.8 + (40+45)/100*0.2 = 170/200*0.8 + 85/100*0.2 = 0.85*0.8 + 0.85*0.2 = 0.68 + 0.17 = 0.85 = 85%
    assert gradebook.percent("Alice") == 85.0
    
    # Test with more drops than assignments (should not drop anything)
    gradebook.drop_lowest("Quiz", 5)  # More drops than assignments
    assert gradebook.percent("Alice") == 85.0  # Should be same as before
    
    print("Drop lowest tests passed!")

if __name__ == "__main__":
    test_basic_functionality()
    test_categories()
    test_weights()
    test_default_category()
    test_weight_validation()
    test_drop_lowest()
    print("All tests passed!")
