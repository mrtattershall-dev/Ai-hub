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

def is_weekend(s):
    """Return True if the date s is a weekend (Saturday or Sunday).
    
    Args:
        s (str): A date string in 'YYYY-MM-DD' format
        
    Returns:
        bool: True if the date is a weekend, False otherwise
    """
    d = parse(s)
    # weekday() returns 0 for Monday through 6 for Sunday
    # So Saturday is 5, Sunday is 6
    return d.weekday() >= 5

def add_business_days(s, n, holidays=None):
    """Return the 'YYYY-MM-DD' date n business days after s (n may be negative).

    Business days are Monday through Friday.
    If s is a weekend, it is treated as the following Monday.

    Args:
        s (str): A date string in 'YYYY-MM-DD' format
        n (int): Number of business days to add (can be negative)
        holidays (set, optional): A collection of 'YYYY-MM-DD' strings to skip
        
    Returns:
        str: The resulting date in 'YYYY-MM-DD' format
    """
    if n == 0:
        return s
    
    d = parse(s)
    
    # If the starting date is a weekend, move to the following Monday
    if d.weekday() >= 5:  # Saturday or Sunday
        days_ahead = 7 - d.weekday()
        d = d + datetime.timedelta(days=days_ahead)
    
    # Add business days
    remaining_days = abs(n)
    
    while remaining_days > 0:
        d = d + datetime.timedelta(days=1)
        # Only count weekdays (Monday=0 to Friday=4)
        if d.weekday() < 5:
            # Check if this date is a holiday
            if holidays is not None and fmt(d) in holidays:
                continue  # Skip holidays
            remaining_days -= 1
    
    return fmt(d)

# Test the specific case
holidays = {"2026-01-01", "2026-01-02"}
result = add_business_days("2025-12-31", 1, holidays)
print(f"Result: {result}")

# Let's trace what happens step by step
d = parse("2025-12-31")
print(f"Starting date: {fmt(d)} (weekday: {d.weekday()})")

# Check if weekend
if d.weekday() >= 5:
    print("Is weekend, moving to Monday")
    days_ahead = 7 - d.weekday()
    d = d + datetime.timedelta(days=days_ahead)
    print(f"After moving to Monday: {fmt(d)} (weekday: {d.weekday()})")

# Add business days
remaining_days = 1
print(f"Adding {remaining_days} business day(s)")

while remaining_days > 0:
    d = d + datetime.timedelta(days=1)
    print(f"  Next day: {fmt(d)} (weekday: {d.weekday()})")
    # Only count weekdays (Monday=0 to Friday=4)
    if d.weekday() < 5:
        # Check if this date is a holiday
        if holidays is not None and fmt(d) in holidays:
            print(f"    -> Holiday, skipping")
            continue  # Skip holidays
        print(f"    -> Business day, decrementing counter")
        remaining_days -= 1
    else:
        print(f"    -> Weekend, skipping")

print(f"Final result: {fmt(d)}")