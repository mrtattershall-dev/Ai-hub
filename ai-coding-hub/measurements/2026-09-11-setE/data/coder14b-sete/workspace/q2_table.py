import csv
from io import StringIO

def parse_csv(text):
    if not text.strip():
        return []
    
    csv_file = StringIO(text)
    reader = csv.DictReader(csv_file)
    return list(reader)

if __name__ == "__main__":
    import unittest

    class TestParseCSV(unittest.TestCase):
        def test_empty_input(self):
            self.assertEqual(parse_csv(""), [])

        def test_single_line(self):
            self.assertEqual(parse_csv("name,age\nAlice,30"), [{"name": "Alice", "age": "30"}])

        def test_multiple_lines(self):
            self.assertEqual(parse_csv("name,age\nAlice,30\nBob,25"), [{"name": "Alice", "age": "30"}, {"name": "Bob", "age": "25"}])

        def test_empty_field(self):
            self.assertEqual(parse_csv("name,age\nAlice,\nBob,25"), [{"name": "Alice", "age": ""}, {"name": "Bob", "age": "25"}])

        def test_quoted_field(self):
            self.assertEqual(parse_csv('name,description\nAlice,"a, b"\nBob,"""'), [{"name": "Alice", "description": "a, b"}, {"name": "Bob", "description": '"'}])

    unittest.main(argv=[''], exit=False)
def to_csv(rows, headers=None):
    if not rows:
        return ""

    if headers is None:
        headers = rows[0].keys()

    def quote_field(field):
        if isinstance(field, str) and (',' in field or '"' in field or '\n' in field):
            return f'"{field.replace("\"", "\"\"")}"'
        return str(field)

    csv_rows = [','.join(quote_field(field) for field in headers)]
    for row in rows:
        csv_rows.append(','.join(quote_field(row.get(header, "")) for header in headers))

    return '\n'.join(csv_rows)
def select(rows, columns):
    selected_rows = []
    for row in rows:
        selected_row = {col: row[col] for col in columns}
        selected_rows.append(selected_row)
    return selected_rows
def where(rows, column, op, value):
    def compare(row_value, value):
        if op in ('<', '>', '<=', '>='):
            try:
                row_value = float(row_value)
                value = float(value)
            except ValueError:
                pass
        if op == '=':
            return row_value == value
        elif op == '!=':
            return row_value != value
        elif op == '<':
            return row_value < value
        elif op == '>':
            return row_value > value
        elif op == '<=':
            return row_value <= value
        elif op == '>=':
            return row_value >= value
        else:
            raise ValueError(f"Unknown operator: {op}")

    filtered_rows = []
    for row in rows:
        if compare(row.get(column), value):
            filtered_rows.append(row)
    return filtered_rows
def order_by(rows, column, descending=False):
    try:
        # Attempt to convert the first row's column value to a float
        float(rows[0][column])
        # If successful, sort numerically
        return sorted(rows, key=lambda row: float(row[column]), reverse=descending)
    except ValueError:
        # If conversion fails, sort as strings
        return sorted(rows, key=lambda row: row[column], reverse=descending)
def group_count(rows, column):
    count_dict = {}
    for row in rows:
        value = row[column]
        if value in count_dict:
            count_dict[value] += 1
        else:
            count_dict[value] = 1
    return count_dict
def test_group_count():
    rows = [
        {"name": "Alice", "age": 30},
        {"name": "Bob", "age": 25},
        {"name": "Alice", "age": 35},
        {"name": "Charlie", "age": 25}
    ]
    result = group_count(rows, "name")
    assert result == {"Alice": 2, "Bob": 1, "Charlie": 1}

    result = group_count(rows, "age")
    assert result == {30: 1, 25: 2, 35: 1}

    print("All tests passed.")

if __name__ == "__main__":
    test_group_count()
def aggregate(rows, group_col, value_col, fn):
    if fn not in ['sum', 'avg', 'min', 'max']:
        raise ValueError("Unknown function: {}".format(fn))
    
    result = {}
    for row in rows:
        group = row[group_col]
        value = row[value_col]
        
        if group not in result:
            result[group] = []
        
        result[group].append(value)
    
    for group, values in result.items():
        if fn == 'sum':
            result[group] = sum(values)
        elif fn == 'avg':
            result[group] = round(sum(values) / len(values), 2)
        elif fn == 'min':
            result[group] = min(values)
        elif fn == 'max':
            result[group] = max(values)
    
    return result
def join(left, right, on):
    result = []
    right_index = {row[on]: row for row in right}
    for left_row in left:
        if left_row[on] in right_index:
            right_row = right_index[left_row[on]]
            joined_row = left_row.copy()
            for key in right_row:
                if key != on:
                    joined_row['right_' + key] = right_row[key]
            result.append(joined_row)
    return result
def pivot(rows, index, column, value):
    result = {}
    for row in rows:
        index_value = row[index]
        column_value = row[column]
        value_value = row[value]
        if index_value not in result:
            result[index_value] = {}
        if column_value in result[index_value]:
            raise ValueError(f"Duplicate (index, column) pair: ({index_value}, {column_value})")
        result[index_value][column_value] = value_value
    return result
