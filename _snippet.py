import t9_csvsum

# Test with sample data
csv_text = """name,age,score
Alice,25,85.5
Bob,30,92.0
Charlie,35,78.5"""

# Test normal case
result = t9_csvsum.sum_column(csv_text, "score")
print(f"Sum of score column: {result}")

# Test with different column
result = t9_csvsum.sum_column(csv_text, "age")
print(f"Sum of age column: {result}")

# Test KeyError
try:
    t9_csvsum.sum_column(csv_text, "invalid_column")
except KeyError as e:
    print(f"KeyError caught: {e}")