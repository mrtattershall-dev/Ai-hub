import csv
from io import StringIO

def sum_column(text, name):
    reader = csv.DictReader(StringIO(text))
    total = 0
    for row in reader:
        if name not in row:
            raise KeyError(f"Unknown column: {name}")
        total += float(row[name])
    return total

# Example usage and assertions
if __name__ == "__main__":
    csv_data = """name,value
A,10
B,20
C,30"""
    assert sum_column(csv_data, "value") == 60
    try:
        sum_column(csv_data, "unknown")
    except KeyError as e:
        assert str(e) == "Unknown column: unknown"
    else:
        assert False, "KeyError not raised for unknown column"