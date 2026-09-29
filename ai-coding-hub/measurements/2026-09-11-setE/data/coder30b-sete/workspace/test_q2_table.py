import sys
import os

# Add the current directory to Python path to import q2_table
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from q2_table import where, group_count, aggregate

def test_where():
    table = [
        {'name': 'Alice', 'age': 30},
        {'name': 'Bob', 'age': 25},
        {'name': 'Charlie', 'age': 30}
    ]
    result = where(table, 'age', 30)
    expected = [{'name': 'Alice', 'age': 30}, {'name': 'Charlie', 'age': 30}]
    assert result == expected
    print("test_where passed")

def test_group_count():
    table = [
        {'name': 'Alice', 'department': 'Engineering'},
        {'name': 'Bob', 'department': 'Marketing'},
        {'name': 'Charlie', 'department': 'Engineering'}
    ]
    result = group_count(table, 'department')
    expected = {'Engineering': 2, 'Marketing': 1}
    assert result == expected
    print("test_group_count passed")

if __name__ == "__main__":
    test_where()
    test_group_count()
    print("All tests passed!")
def test_aggregate_sum():
    table = [
        {'name': 'Alice', 'department': 'Engineering', 'salary': 50000},
        {'name': 'Bob', 'department': 'Marketing', 'salary': 45000},
        {'name': 'Charlie', 'department': 'Engineering', 'salary': 60000}
    ]
    result = aggregate(table, 'department', 'salary', 'sum')
    expected = {'Engineering': 110000, 'Marketing': 45000}
    assert result == expected
    print("test_aggregate_sum passed")

def test_aggregate_avg():
    table = [
        {'name': 'Alice', 'department': 'Engineering', 'salary': 50000},
        {'name': 'Bob', 'department': 'Marketing', 'salary': 45000},
        {'name': 'Charlie', 'department': 'Engineering', 'salary': 60000}
    ]
    result = aggregate(table, 'department', 'salary', 'avg')
    expected = {'Engineering': 55000.0, 'Marketing': 45000.0}
    assert result == expected
    print("test_aggregate_avg passed")

def test_aggregate_min():
    table = [
        {'name': 'Alice', 'department': 'Engineering', 'salary': 50000},
        {'name': 'Bob', 'department': 'Marketing', 'salary': 45000},
        {'name': 'Charlie', 'department': 'Engineering', 'salary': 60000}
    ]
    result = aggregate(table, 'department', 'salary', 'min')
    expected = {'Engineering': 50000, 'Marketing': 45000}
    assert result == expected
    print("test_aggregate_min passed")

def test_aggregate_max():
    table = [
        {'name': 'Alice', 'department': 'Engineering', 'salary': 50000},
        {'name': 'Bob', 'department': 'Marketing', 'salary': 45000},
        {'name': 'Charlie', 'department': 'Engineering', 'salary': 60000}
    ]
    result = aggregate(table, 'department', 'salary', 'max')
    expected = {'Engineering': 60000, 'Marketing': 45000}
    assert result == expected
    print("test_aggregate_max passed")

def test_aggregate_invalid_function():
    table = [
        {'name': 'Alice', 'department': 'Engineering', 'salary': 50000},
        {'name': 'Bob', 'department': 'Marketing', 'salary': 45000}
    ]
    try:
        aggregate(table, 'department', 'salary', 'invalid')
        assert False, "Should have raised ValueError"
    except ValueError:
        print("test_aggregate_invalid_function passed")

if __name__ == "__main__":
    test_where()
    test_group_count()
    test_aggregate_sum()
    test_aggregate_avg()
    test_aggregate_min()
    test_aggregate_max()
    test_aggregate_invalid_function()
    print("All tests passed!")
