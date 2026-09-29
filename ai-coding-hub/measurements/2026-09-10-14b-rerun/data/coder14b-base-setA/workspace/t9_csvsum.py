import csv
from io import StringIO

def sum_column(text, name):
    reader = csv.DictReader(StringIO(text))
    if name not in reader.fieldnames:
        raise KeyError(f"Unknown column: {name}")
    total = 0
    for row in reader:
        total += float(row[name])
    return total

# Test cases
if __name__ == "__main__":
    csv_data = """name,value
apple,10
banana,20
cherry,30"""
    assert sum_column(csv_data, "value") == 60
    try:
        sum_column(csv_data, "price")
    except KeyError as e:
        assert str(e).lower() == "unknown column: price"
    print("All tests passed.")