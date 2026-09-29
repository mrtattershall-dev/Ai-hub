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

def month_end(s):
    """Return the last day of the month for date s.
    
    Args:
        s (str): Date in 'YYYY-MM-DD' format
        
    Returns:
        str: Last day of the month in 'YYYY-MM-DD' format
    """
    from datetime import datetime, timedelta
    
    date = parse(s)
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
        s (str): Date in 'YYYY-MM-DD' format
        n (int): Number of months to add (can be negative)
        
    Returns:
        str: New date in 'YYYY-MM-DD' format
    """
    from datetime import datetime, timedelta
    
    date = parse(s)
    
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
        date (str): Date in 'YYYY-MM-DD' format
        
    Returns:
        tuple: (ISO year, ISO week number) 
    """
    from datetime import datetime
    
    d = parse(date)
    # Use the isocalendar() method which returns (ISO year, ISO week, ISO weekday)
    iso_year, iso_week, _ = d.isocalendar()
    return (iso_year, iso_week)
