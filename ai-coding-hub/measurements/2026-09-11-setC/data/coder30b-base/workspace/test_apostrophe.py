import sys
sys.path.append('.')

from s7_todo import TodoList

# Test priority functionality
def test_priorities():
    todo_list = TodoList()
    
    # Add items with different priorities
    id1 = todo_list.add("Low priority task", priority=2)
    id2 = todo_list.add("High priority task", priority=0)
    id3 = todo_list.add("Medium priority task", priority=1)
    id4 = todo_list.add("Another low priority task", priority=2)
    
    # Check pending items are sorted by priority first, then by insertion order
    pending = todo_list.pending()
    expected = ["High priority task", "Medium priority task", "Low priority task", "Another low priority task"]
    assert pending == expected, f"Expected {expected}, got {pending}"
    
    # Test with done items
    todo_list.done(id2)  # Mark high priority as done
    pending = todo_list.pending()
    expected = ["Medium priority task", "Low priority task", "Another low priority task"]
    assert pending == expected, f"Expected {expected}, got {pending}"
    
    # Test default priority (should be 0)
    id5 = todo_list.add("Default priority task")
    pending = todo_list.pending()
    # Items with same priority should be ordered by insertion order
    # "High priority task" (priority=0, id=2) was marked done, so it's not in pending
    # "Medium priority task" (priority=1, id=3) comes next
    # "Low priority task" (priority=2, id=1) comes next  
    # "Another low priority task" (priority=2, id=4) comes next
    # "Default priority task" (priority=0, id=5) comes first (same priority as original high priority)
    expected = ["Default priority task", "Medium priority task", "Low priority task", "Another low priority task"]
    assert pending == expected, f"Expected {expected}, got {pending}"
    
    print("Priority tests passed!")

# Run the priority tests
test_priorities()
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
