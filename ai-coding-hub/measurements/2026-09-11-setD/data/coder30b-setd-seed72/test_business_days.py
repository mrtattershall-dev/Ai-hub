import datetime

def parse(s):
    """Parse a 'YYYY-MM-DD' string into a datetime.date.
    
    Raises ValueError for invalid formats or impossible dates.
    """
    # Strict format checking
    if not isinstance(s, str) or len(s) != 10:
        raise ValueError("Invalid date format or impossible date")
    
    if s[4] != '-' or s[7] != '-':
        raise ValueError("Invalid date format or impossible date")
    
    try:
        year = int(s[0:4])
        month = int(s[5:7])
        day = int(s[8:10])
        
        # Validate ranges
        if month < 1 or month > 12:
            raise ValueError("Invalid date format or impossible date")
        if day < 1 or day > 31:
            raise ValueError("Invalid date format or impossible date")
            
        return datetime.date(year, month, day)
    except ValueError:
        raise ValueError("Invalid date format or impossible date")

def fmt(d):
    """Format a datetime.date into 'YYYY-MM-DD' string."""
    return d.strftime('%Y-%m-%d')

def business_days_between(a, b, holidays=None):
    """Return the number of business days d with a < d <= b, skipping weekends and holidays.
    
    Args:
        a (str): Start date in 'YYYY-MM-DD' format
        b (str): End date in 'YYYY-MM-DD' format
        holidays (set, optional): A collection of 'YYYY-MM-DD' strings to skip
        
    Returns:
        int: Number of business days between a and b, or 0 if b <= a
    """
    if b <= a:
        return 0
    
    start_date = parse(a)
    end_date = parse(b)
    
    count = 0
    current_date = start_date
    
    # Iterate through each day from a to b (exclusive of a, inclusive of b)
    while current_date < end_date:
        # Check if current date is a weekday (Monday=0 to Friday=4)
        if current_date.weekday() < 5:
            # Check if current date is not a holiday
            if holidays is None or fmt(current_date) not in holidays:
                count += 1
        current_date = current_date + datetime.timedelta(days=1)
    
    return count

# Test the business_days_between function
print("Testing business_days_between function...")

# Test basic case
result = business_days_between("2026-01-01", "2026-01-05")
expected = 4  # Jan 2, 3, 4, 5 are business days
print(f"Test 1: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

# Test with weekend
result = business_days_between("2026-01-01", "2026-01-07")  # Friday to Thursday
expected = 5  # Jan 2, 3, 4, 5, 6 are business days (skip Saturday and Sunday)
print(f"Test 2: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

# Test with holidays
holidays = {"2026-01-03"}
result = business_days_between("2026-01-01", "2026-01-05", holidays)
expected = 3  # Jan 2, 4, 5 are business days (skip Jan 3 which is a holiday)
print(f"Test 3: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

# Test when b <= a
result = business_days_between("2026-01-05", "2026-01-01")
expected = 0
print(f"Test 4: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

# Test edge case with no holidays
result = business_days_between("2026-01-01", "2026-01-02")
expected = 1  # Jan 2 is a business day
print(f"Test 5: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

# Test with a holiday on a weekday
holidays = {"2026-01-02"}
result = business_days_between("2026-01-01", "2026-01-03", holidays)
expected = 1  # Only Jan 3 is a business day (Jan 2 is a holiday)
print(f"Test 6: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

print("All business_days_between tests completed!")