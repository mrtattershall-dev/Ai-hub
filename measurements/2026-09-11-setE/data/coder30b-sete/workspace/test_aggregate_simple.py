import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from q2_table import aggregate

# Test the aggregate function directly
table = [
    {'name': 'Alice', 'department': 'Engineering', 'salary': 50000},
    {'name': 'Bob', 'department': 'Marketing', 'salary': 45000},
    {'name': 'Charlie', 'department': 'Engineering', 'salary': 60000}
]

print("Testing aggregate function...")
try:
    result = aggregate(table, 'department', 'salary', 'sum')
    print(f"Sum result: {result}")
    
    result = aggregate(table, 'department', 'salary', 'avg')
    print(f"Avg result: {result}")
    
    result = aggregate(table, 'department', 'salary', 'min')
    print(f"Min result: {result}")
    
    result = aggregate(table, 'department', 'salary', 'max')
    print(f"Max result: {result}")
    
    print("All tests passed!")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()