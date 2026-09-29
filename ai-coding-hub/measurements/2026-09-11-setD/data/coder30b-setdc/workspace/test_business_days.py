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

# Import the functions from r6_days.py
import r6_days

# Test month_end function
result = r6_days.month_end("2026-01-01")
expected = "2026-01-31"
print(f"Test month_end 1: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

result = r6_days.month_end("2026-02-01")
expected = "2026-02-28"
print(f"Test month_end 2: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

result = r6_days.month_end("2024-02-01")
expected = "2024-02-29"
print(f"Test month_end 3: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

# Test add_months function
result = r6_days.add_months("2026-01-31", 1)
expected = "2026-02-28"
print(f"Test add_months 1: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

result = r6_days.add_months("2026-01-31", 2)
expected = "2026-03-31"
print(f"Test add_months 2: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

result = r6_days.add_months("2026-01-31", -1)
expected = "2025-12-31"
print(f"Test add_months 3: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

result = r6_days.add_months("2026-01-31", 12)
expected = "2027-01-31"
print(f"Test add_months 4: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

result = r6_days.add_months("2026-01-31", -12)
expected = "2025-01-31"
print(f"Test add_months 5: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

print("All business_days_between tests completed!")
# Test iso_week function
import r6_days

print("Testing iso_week function...")

# Test case 1: A regular date
result = r6_days.iso_week("2023-01-01")
expected = (2022, 52)  # 2023-01-01 is in ISO week 52 of 2022
print(f"Test iso_week 1: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

# Test case 2: A date that's in the first week of a year
result = r6_days.iso_week("2023-01-02")
expected = (2023, 1)  # 2023-01-02 is in ISO week 1 of 2023
print(f"Test iso_week 2: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

# Test case 3: A date in the middle of a year
result = r6_days.iso_week("2023-06-15")
expected = (2023, 24)  # 2023-06-15 is in ISO week 24 of 2023
print(f"Test iso_week 3: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

print("All iso_week tests completed!")

# Test weekday_name function
print("Testing weekday_name function...")

# Test case 1: Monday
result = r6_days.weekday_name(0)
expected = "Monday"
print(f"Test weekday_name 1: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

# Test case 2: Tuesday
result = r6_days.weekday_name(1)
expected = "Tuesday"
print(f"Test weekday_name 2: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

# Test case 3: Wednesday
result = r6_days.weekday_name(2)
expected = "Wednesday"
print(f"Test weekday_name 3: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

# Test case 4: Thursday
result = r6_days.weekday_name(3)
expected = "Thursday"
print(f"Test weekday_name 4: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

# Test case 5: Friday
result = r6_days.weekday_name(4)
expected = "Friday"
print(f"Test weekday_name 5: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

# Test case 6: Saturday
result = r6_days.weekday_name(5)
expected = "Saturday"
print(f"Test weekday_name 6: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

# Test case 7: Sunday
result = r6_days.weekday_name(6)
expected = "Sunday"
print(f"Test weekday_name 7: {result} == {expected} ? {result == expected}")
if result != expected:
    print(f"  FAILED: Expected {expected}, got {result}")

print("All weekday_name tests completed!")
