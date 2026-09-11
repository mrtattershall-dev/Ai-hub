import csv
from io import StringIO

def sum_column(text, name):
    reader = csv.DictReader(StringIO(text))
    try:
        return sum(float(row[name]) for row in reader)
    except KeyError:
        raise KeyError(f"Column '{name}' not found in the CSV data.")
# Test cases
csv_data = """name,age,score
Alice,30,85
Bob,25,90
Charlie,35,75"""

assert sum_column(csv_data, 'score') == 250
assert sum_column(csv_data, 'age') == 90
try:
    sum_column(csv_data, 'height')
except KeyError as e:
    print(str(e))
    assert str(e) == "Column 'height' not found in the CSV data."

