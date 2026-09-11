def sum_column(text, name):
    lines = text.strip().split('\n')
    if not lines:
        return 0
    
    # First line contains headers
    headers = lines[0].split(',')
    
    # Find the column index
    try:
        col_index = headers.index(name)
    except ValueError:
        raise KeyError(f"Column '{name}' not found")
    
    # Sum the numeric values in that column
    total = 0
    for line in lines[1:]:
        if not line.strip():  # Skip empty lines
            continue
        values = line.split(',')
        if col_index < len(values):
            try:
                total += float(values[col_index])
            except ValueError:
                # Skip non-numeric values
                continue
    
    return total


# Test cases
if __name__ == "__main__":
    # Test with sample data
    csv_text = """name,age,score
Alice,25,85.5
Bob,30,92.0
Charlie,35,78.5"""
    
    # Test normal case
    assert sum_column(csv_text, "score") == 256.0
    print("Test 1 passed: sum_column with valid column")
    
    # Test with different column
    assert sum_column(csv_text, "age") == 90
    print("Test 2 passed: sum_column with age column")
    
    # Test with non-numeric values
    csv_text_with_non_numeric = """name,score
Alice,85.5
Bob,invalid
Charlie,78.5"""
    assert sum_column(csv_text_with_non_numeric, "score") == 164.0
    print("Test 3 passed: sum_column with non-numeric values")
    
    # Test KeyError
    try:
        sum_column(csv_text, "invalid_column")
        assert False, "Should have raised KeyError"
    except KeyError:
        print("Test 4 passed: KeyError raised for invalid column")
    
    print("All tests passed!")