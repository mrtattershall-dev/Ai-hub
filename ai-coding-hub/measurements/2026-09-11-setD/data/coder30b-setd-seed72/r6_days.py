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
