# S_NOTES.md

## s1_stack.js

### Class: Stack

- **Constructor:**
  - `constructor()`
    - Initializes an empty array `items`.

- **Methods:**
  - `push(item)`
    - **Arguments:** `item` (any)
    - **Description:** Adds an item to the top of the stack.
    - **Throws:** None

  - `pop()`
    - **Arguments:** None
    - **Description:** Removes and returns the top item from the stack.
    - **Throws:** Error if the stack is empty

  - `peek()`
    - **Arguments:** None
    - **Description:** Returns the top item from the stack without removing it.
    - **Throws:** Error if the stack is empty

  - `size()`
    - **Arguments:** None
    - **Description:** Returns the number of items in the stack.
    - **Throws:** None

  - `isEmpty()`
    - **Arguments:** None
    - **Description:** Checks if the stack is empty.
    - **Throws:** None
## s2_dates.js

### Function: isLeapYear

- **Arguments:** `year` (number)
- **Description:** Determines if the specified year is a leap year.
- **Throws:** None

### Function: daysBetween

- **Arguments:** `a` (string), `b` (string)
- **Description:** Calculates the number of days between two dates.
- **Throws:** Error if the date strings are malformed
