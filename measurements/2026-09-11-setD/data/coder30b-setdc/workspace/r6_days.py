# Fix the test case that was expecting wrong result
# The test was expecting "2026-01-04" but the correct result is "2026-01-05"
# This is because:
# 2025-12-31 (Wednesday) + 1 business day
# 2026-01-01 (Thursday) - holiday, skip
# 2026-01-02 (Friday) - holiday, skip
# 2026-01-03 (Saturday) - weekend, skip
# 2026-01-04 (Sunday) - weekend, skip
# 2026-01-05 (Monday) - business day, return
# So the correct result is "2026-01-05", not "2026-01-04"
def business_days_between(a, b, holidays=None):
    """Return the number of business days d with a < d <= b, skipping weekends and holidays.
    
    Args:
        a (str or datetime.date): Start date in 'YYYY-MM-DD' format or date object
        b (str or datetime.date): End date in 'YYYY-MM-DD' format or date object
        holidays (set, optional): A collection of 'YYYY-MM-DD' strings to skip
        
    Returns:
        int: Number of business days between a and b, or 0 if b <= a
    """
    # Handle both string and datetime.date inputs for a and b
    if isinstance(a, str):
        start_date = parse(a)
    else:
        start_date = a
    
    if isinstance(b, str):
        end_date = parse(b)
    else:
        end_date = b
    
    # Convert to date objects for comparison if needed
    if hasattr(start_date, 'date'):
        start_date = start_date.date()
    if hasattr(end_date, 'date'):
        end_date = end_date.date()
    
    if end_date <= start_date:
        return 0
    
    count = 0
    current_date = start_date
    
    # Iterate through each day from a to b (exclusive of a, inclusive of b)
    while current_date < end_date:
        # Check if current date is a weekday (Monday=0 to Friday=4)
        if current_date.weekday() < 5:
            # Check if current date is not a holiday
            if holidays is None or fmt(current_date) not in holidays:
                count += 1
        current_date = current_date + timedelta(days=1)
    
    return count

def month_end(s):
    """Return the last day of the month for date s.
    
    Args:
        s (str or datetime.date): Date in 'YYYY-MM-DD' format or date object
        
    Returns:
        str: Last day of the month in 'YYYY-MM-DD' format
    """
    from datetime import datetime, timedelta
    
    # Handle both string and datetime.date inputs
    if isinstance(s, str):
        date = parse(s)
    else:
        date = s
    
    # Get the first day of next month
    if date.month == 12:
        next_month = date.replace(year=date.year + 1, month=1, day=1)
    else:
        next_month = date.replace(month=date.month + 1, day=1)
    
    # Subtract one day to get the last day of current month
    last_day = next_month - timedelta(days=1)
    return fmt(last_day)

def add_months(s, n):
    """Add n months to date s, keeping the day of the month but clamping to end of target month.
    
    Args:
        s (str or datetime.date): Date in 'YYYY-MM-DD' format or date object
        n (int): Number of months to add (can be negative)
        
    Returns:
        str: New date in 'YYYY-MM-DD' format
    """
    from datetime import datetime, timedelta
    
    # Handle both string and datetime.date inputs
    if isinstance(s, str):
        date = parse(s)
    else:
        date = s
    
    # Calculate the target month
    target_month = date.month + n
    target_year = date.year
    
    # Adjust year if needed
    while target_month > 12:
        target_month -= 12
        target_year += 1
    while target_month < 1:
        target_month += 12
        target_year -= 1
    
    # Try to create the new date with the same day
    try:
        new_date = date.replace(year=target_year, month=target_month)
    except ValueError:
        # If the day doesn't exist in the target month, use the last day of that month
        # Get the first day of the next month
        if target_month == 12:
            next_month = date.replace(year=target_year + 1, month=1, day=1)
        else:
            next_month = date.replace(year=target_year, month=target_month + 1, day=1)
        
        # Subtract one day to get the last day of target month
        new_date = next_month - timedelta(days=1)
    
    return fmt(new_date)
from datetime import datetime, timedelta

def fmt(date):
    """Format a datetime object to 'YYYY-MM-DD' string."""
    return date.strftime('%Y-%m-%d')

def parse(s):
    """Parse a 'YYYY-MM-DD' string to a datetime object."""
    return datetime.strptime(s, '%Y-%m-%d')
def iso_week(date):
    """Return the ISO year and ISO week number for a given date.

    Args:
        date (str or datetime.date): Date in 'YYYY-MM-DD' format or date object

    Returns:
        tuple: (ISO year, ISO week number) 
    """
    from datetime import datetime
    
    # Handle both string and datetime.date inputs
    if isinstance(date, str):
        d = parse(date)
    else:
        d = date
    
    # Use the isocalendar() method which returns (ISO year, ISO week, ISO weekday)
    iso_year, iso_week, _ = d.isocalendar()
    return (iso_year, iso_week)

def weekday_name(s):
    """Return the English day name for a given weekday number (0-6).
    
    Args:
        s (int): Weekday number (0=Monday, 1=Tuesday, ..., 6=Sunday)
        
    Returns:
        str: English day name
    """
    weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    return weekdays[s]
def next_weekday(s, name):
    """Return the first date strictly after s that falls on the named weekday.
    
    Args:
        s (str or datetime.date): Start date in 'YYYY-MM-DD' format or date object
        name (str): Weekday name (case-insensitive)
        
    Returns:
        str: Date in 'YYYY-MM-DD' format
        
    Raises:
        ValueError: If name is not a valid weekday name
    """
    from datetime import datetime, timedelta
    
    # Handle both string and datetime.date inputs
    if isinstance(s, str):
        # Parse the start date
        start_date = parse(s)
    else:
        start_date = s
    
    # Define weekday names (case-insensitive)
    weekdays = {
        'monday': 0,
        'tuesday': 1,
        'wednesday': 2,
        'thursday': 3,
        'friday': 4,
        'saturday': 5,
        'sunday': 6
    }
    
    # Check if the weekday name is valid
    if name.lower() not in weekdays:
        raise ValueError(f"Unknown weekday name: {name}")
    
    # Get the target weekday number
    target_weekday = weekdays[name.lower()]
    
    # Start checking from the day after the input date
    current_date = start_date + timedelta(days=1)
    
    # Keep advancing until we find the target weekday
    while current_date.weekday() != target_weekday:
        current_date += timedelta(days=1)
    
    return fmt(current_date)
