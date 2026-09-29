import sys
sys.path.append('.')

from s7_todo import TodoList

# Test due date functionality
def test_due_dates():
    todo_list = TodoList()
    
    # Test adding items with due dates
    id1 = todo_list.add("Task with due date", due="2026-09-30")
    id2 = todo_list.add("Task without due date")
    id3 = todo_list.add("Another task with due date", due="2024-01-01")
    
    # Test that due dates are stored correctly
    assert todo_list.todos[0]['due'] == "2026-09-30"
    assert todo_list.todos[1]['due'] is None
    assert todo_list.todos[2]['due'] == "2024-01-01"
    
    # Test invalid due date format
    try:
        todo_list.add("Invalid due date", due="invalid-date")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass  # Expected
    
    try:
        todo_list.add("Invalid due date", due="2026-13-45")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass  # Expected
    
    # Test overdue functionality
    # Today is 2025-01-01
    overdue = todo_list.overdue("2025-01-01")
    expected = ["Another task with due date"]  # Only this one is overdue
    assert overdue == expected, f"Expected {expected}, got {overdue}"
    
    # Mark the overdue task as done
    todo_list.done(id3)
    overdue = todo_list.overdue("2025-01-01")
    expected = []  # No overdue tasks now
    assert overdue == expected, f"Expected {expected}, got {overdue}"
    
    # Add a task with future due date
    id4 = todo_list.add("Future task", due="2027-01-01")
    overdue = todo_list.overdue("2025-01-01")
    expected = []  # No overdue tasks
    assert overdue == expected, f"Expected {expected}, got {overdue}"
    
    # Test with today's date
    overdue = todo_list.overdue("2024-01-01")
    expected = []  # No overdue tasks, today's date is not before any due dates
    assert overdue == expected, f"Expected {expected}, got {overdue}"
    
    # Test invalid today parameter
    try:
        todo_list.overdue("invalid-date")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass  # Expected
    
    try:
        todo_list.overdue("2024-13-45")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass  # Expected
    
    print("Due date tests passed!")

# Run the due date tests
test_due_dates()