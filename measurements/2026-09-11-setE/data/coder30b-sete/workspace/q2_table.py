def parse_csv(text):
    if not text.strip():
        return []
    
    lines = text.strip().split('\n')
    headers = parse_csv_line(lines[0])
    result = []
    
    for line in lines[1:]:
        if not line.strip():
            continue
        values = parse_csv_line(line)
        row = {}
        for i, header in enumerate(headers):
            if i < len(values):
                row[header] = values[i]
            else:
                row[header] = ""
        result.append(row)
    
    return result

def parse_csv_line(line):
    """Parse a single CSV line, handling quoted fields"""
    values = []
    current_value = ""
    in_quotes = False
    
    i = 0
    while i < len(line):
        char = line[i]
        
        if char == '"':
            if in_quotes and i + 1 < len(line) and line[i + 1] == '"':
                # Double quote inside quoted field
                current_value += '"'
                i += 2
                continue
            else:
                # Toggle quote state
                in_quotes = not in_quotes
        elif char == ',' and not in_quotes:
            # End of field
            values.append(current_value)
            current_value = ""
        else:
            current_value += char
        i += 1
    
    # Add the last value
    values.append(current_value)
    return values

def to_csv(rows, headers=None):
    """Convert a list of row dictionaries to CSV text.
    
    Args:
        rows: List of dictionaries representing rows
        headers: Optional list of header names. If None, uses keys from first row.
        
    Returns:
        CSV text string with lines separated by '\n'
    """
    if not rows:
        return ""
    
    # Determine headers
    if headers is None:
        headers = list(rows[0].keys())
    
    # Helper function to escape CSV fields
    def escape_field(value):
        value = str(value)
        # If field contains comma, quote, or newline, quote it
        if ',' in value or '"' in value or '\n' in value:
            # Escape quotes by doubling them
            escaped = value.replace('"', '""')
            return f'"{escaped}"'
        return value
    
    # Build CSV content
    lines = []
    
    # Add header row
    escaped_headers = [escape_field(header) for header in headers]
    lines.append(','.join(escaped_headers))
    
    # Add data rows
    for row in rows:
        escaped_values = [escape_field(row.get(header, "")) for header in headers]
        lines.append(','.join(escaped_values))
    
    return '\n'.join(lines)


def select(rows, columns):
    """Select specific columns from rows.
    
    Args:
        rows: List of row dictionaries
        columns: List of column names to select
        
    Returns:
        List of row dictionaries with only the specified columns
        
    Raises:
        KeyError: If any column name is not found in the rows
    """
    if not rows:
        return []
    
    # Check that all columns exist
    first_row = rows[0]
    for col in columns:
        if col not in first_row:
            raise KeyError(f"Column '{col}' not found")
    
    # Create new rows with only the specified columns
    result = []
    for row in rows:
        new_row = {col: row[col] for col in columns}
        result.append(new_row)
    
    return result


if __name__ == "__main__":
    # Test empty text
    assert parse_csv("") == []
    
    # Test single row
    assert parse_csv("a,b,c\n1,2,3") == [{"a": "1", "b": "2", "c": "3"}]
    
    # Test quoted fields with commas
    assert parse_csv('a,b,c\n1,"a,b",3') == [{"a": "1", "b": "a,b", "c": "3"}]
    
    # Test quoted fields with doubled quotes
    assert parse_csv('a,b\n1,"a""b""c"') == [{"a": "1", "b": 'a"b"c'}]
    
    # Test empty fields
    assert parse_csv("a,b,c\n1,,3") == [{"a": "1", "b": "", "c": "3"}]
    
    # Test to_csv function
    test_rows = [
        {"name": "John", "age": "25", "city": "New York"},
        {"name": "Jane", "age": "30", "city": "Los Angeles"}
    ]
    csv_output = to_csv(test_rows)
    assert parse_csv(csv_output) == test_rows
    
    # Test with special characters
    test_rows_special = [
        {"a": "hello,world", "b": 'he said "hello"', "c": "normal"},
        {"a": "normal", "b": "normal", "c": "normal"}
    ]
    csv_output_special = to_csv(test_rows_special)
    assert parse_csv(csv_output_special) == test_rows_special
    
    # Test with custom headers
    csv_output_custom = to_csv(test_rows, ["name", "age"])
    parsed_custom = parse_csv(csv_output_custom)
    expected_custom = [{"name": "John", "age": "25"}, {"name": "Jane", "age": "30"}]
    assert parsed_custom == expected_custom
    
    print("All tests passed!")
def where(rows, column, op, value):
    """Filter rows by column value using the specified operator.
    
    Args:
        rows: List of row dictionaries
        column: Column name to filter on
        op: Comparison operator ('=', '!=', '<', '>', '<=', '>=')
        value: Value to compare against
        
    Returns:
        List of rows where the condition is true
        
    Raises:
        ValueError: If op is not one of the supported operators
    """
    # Supported operators
    supported_ops = {'=', '!=', '<', '>', '<=', '>='}
    
    if op not in supported_ops:
        raise ValueError(f"Unknown operator: {op}")
    
    if not rows:
        return []
    
    # Check if column exists in first row
    if column not in rows[0]:
        raise KeyError(f"Column '{column}' not found")
    
    result = []
    
    for row in rows:
        # Get the column value
        col_value = row[column]
        
        # Try to convert both values to numbers for comparison
        try:
            # Try to parse both values as numbers
            col_num = float(col_value)
            val_num = float(value)
            # Both are numbers, do numeric comparison
            numeric_comparison = True
        except (ValueError, TypeError):
            # At least one is not a number, do string comparison
            col_num = None
            val_num = None
            numeric_comparison = False
        
        # Perform the comparison
        if op == '=':
            if numeric_comparison:
                match = col_num == val_num
            else:
                match = col_value == str(value)
        elif op == '!=':
            if numeric_comparison:
                match = col_num != val_num
            else:
                match = col_value != str(value)
        elif op == '<':
            if numeric_comparison:
                match = col_num < val_num
            else:
                match = col_value < str(value)
        elif op == '>':
            if numeric_comparison:
                match = col_num > val_num
            else:
                match = col_value > str(value)
        elif op == '<=':
            if numeric_comparison:
                match = col_num <= val_num
            else:
                match = col_value <= str(value)
        elif op == '>=':
            if numeric_comparison:
                match = col_num >= val_num
            else:
                match = col_value >= str(value)
        
        if match:
            result.append(row)
    
    return result


def order_by(rows, column, descending=False):
    """Sort rows by a column value.
    
    Args:
        rows: List of row dictionaries
        column: Column name to sort by
        descending: If True, sort in descending order (default: False)
        
    Returns:
        List of rows sorted by the specified column
        
    The sorting is numeric when all values in the column can be parsed as numbers,
    otherwise it's string sorting. Rows with equal values maintain their original order.
    """
    if not rows:
        return []
    
    # Check if column exists in first row
    if column not in rows[0]:
        raise KeyError(f"Column '{column}' not found")
    
    # Check if all values in the column can be parsed as numbers
    all_numeric = True
    for row in rows:
        try:
            float(row[column])
        except (ValueError, TypeError):
            all_numeric = False
            break
    
    # Create list of (index, row) pairs to maintain stable sort
    indexed_rows = list(enumerate(rows))
    
    # Sort based on whether all values are numeric
    if all_numeric:
        # Numeric sorting
        sorted_indexed = sorted(indexed_rows, key=lambda x: float(x[1][column]), reverse=descending)
    else:
        # String sorting
        sorted_indexed = sorted(indexed_rows, key=lambda x: str(x[1][column]), reverse=descending)
    
    # Extract just the rows in the new order
    return [row for index, row in sorted_indexed]


def group_count(rows, column):
    """Group rows by a column value and count occurrences.
    
    Args:
        rows: List of row dictionaries
        column: Column name to group by
        
    Returns:
        Dictionary mapping each value to its count
    """
    if not rows:
        return {}
    
    # Check if column exists in first row
    if column not in rows[0]:
        raise KeyError(f"Column '{column}' not found")
    
    # Count occurrences of each value
    counts = {}
    for row in rows:
        value = row[column]
        if value in counts:
            counts[value] += 1
        else:
            counts[value] = 1
    
    return counts
def aggregate(rows, group_col, value_col, fn):
    """Aggregate values in a column by grouping them.
    
    Args:
        rows: List of row dictionaries
        group_col: Column name to group by
        value_col: Column name containing numeric values to aggregate
        fn: Aggregation function ('sum', 'avg', 'min', 'max')
        
    Returns:
        Dictionary mapping group values to aggregated numeric results
        
    Raises:
        ValueError: If fn is not one of 'sum', 'avg', 'min', 'max'
        KeyError: If group_col or value_col is not found in rows
    """
    if not rows:
        return {}
    
    # Check if columns exist in first row
    if group_col not in rows[0]:
        raise KeyError(f"Column '{group_col}' not found")
    if value_col not in rows[0]:
        raise KeyError(f"Column '{value_col}' not found")
    
    # Validate function
    if fn not in ('sum', 'avg', 'min', 'max'):
        raise ValueError(f"Unknown function: {fn}")
    
    # Group rows by group_col
    groups = {}
    for row in rows:
        group_value = row[group_col]
        if group_value not in groups:
            groups[group_value] = []
        groups[group_value].append(row[value_col])
    
    # Apply aggregation function to each group
    result = {}
    for group_value, values in groups.items():
        # Convert values to numbers for computation
        numeric_values = []
        for val in values:
            try:
                numeric_values.append(float(val))
            except (ValueError, TypeError):
                # Skip non-numeric values
                continue
        
        if not numeric_values:
            result[group_value] = 0  # or None? 
            continue
            
        if fn == 'sum':
            result[group_value] = sum(numeric_values)
        elif fn == 'avg':
            result[group_value] = round(sum(numeric_values) / len(numeric_values), 2)
        elif fn == 'min':
            result[group_value] = min(numeric_values)
        elif fn == 'max':
            result[group_value] = max(numeric_values)
    
    return result
