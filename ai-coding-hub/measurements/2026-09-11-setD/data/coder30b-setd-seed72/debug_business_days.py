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
    
    print(f"Start date: {start_date}, End date: {end_date}")
    print(f"Start date weekday: {start_date.weekday()}")
    print(f"End date weekday: {end_date.weekday()}")
    
    count = 0
    current_date = start_date
    
    # Iterate through each day from a to b (exclusive of a, inclusive of b)
    while current_date < end_date:
        # Check if current date is a weekday (Monday=0 to Friday=4)
        weekday = current_date.weekday()
        is_weekday = weekday < 5
        is_holiday = holidays is not None and fmt(current_date) in holidays
        
        print(f"Date: {fmt(current_date)}, Weekday: {weekday}, Is weekday: {is_weekday}, Is holiday: {is_holiday}")
        
        if is_weekday and not is_holiday:
            count += 1
            print(f"  -> Business day count: {count}")
        current_date = current_date + datetime.timedelta(days=1)
    
    return count

# Test the function
print("Testing business_days_between function...")
result = business_days_between("2026-01-01", "2026-01-05")
print(f"Result: {result}")