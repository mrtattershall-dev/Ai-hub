# S_NOTES.md

## s1_stack.js

### Class: Stack

#### Constructor
- **`constructor()`**
  - Initializes an empty stack.

#### Methods
- **`push(item)`**
  - **Arguments:** `item` (any)
  - **Description:** Adds an item to the top of the stack.
  - **Throws:** None

- **`pop()`**
  - **Arguments:** None
  - **Description:** Removes and returns the item from the top of the stack.
  - **Throws:** Error if the stack is empty

- **`peek()`**
  - **Arguments:** None
  - **Description:** Returns the item at the top of the stack without removing it.
  - **Throws:** Error if the stack is empty

- **`size()`**
  - **Arguments:** None
  - **Description:** Returns the number of items in the stack.
  - **Throws:** None

- **`isEmpty()`**
  - **Arguments:** None
  - **Description:** Checks if the stack is empty.
  - **Throws:** None

## s2_dates.js

### Function: isLeapYear
- **`isLeapYear(year)`**
  - **Arguments:** `year` (number)
  - **Description:** Determines if a given year is a leap year.
  - **Throws:** None

### Function: daysBetween
- **`daysBetween(a, b)`**
  - **Arguments:** `a` (string), `b` (string)
  - **Description:** Calculates the number of days between two dates in the format 'YYYY-MM-DD'.
  - **Throws:** Error if the date strings are malformed

### Function: testDaysBetween
- **`testDaysBetween()`**
  - **Arguments:** None
  - **Description:** Tests the `daysBetween` function with various assertions.
  - **Throws:** None