# Ledger Class Methods

## Constructor
- **Method**: `constructor()`
- **Arguments**: None
- **Description**: Initializes a new Ledger instance with an empty accounts object.
- **Throws**: None

## Static Method: fromCSV
- **Method**: `static fromCSV(text)`
- **Arguments**: 
  - `text` (string): CSV formatted text.
- **Description**: Creates a Ledger instance from a CSV string.
- **Throws**: 
  - Error: If CSV must have at least a header and one data line.
  - Error: If CSV header must be "account,balance".
  - Error: If malformed line.
  - Error: If invalid balance.

## Method: toCSV
- **Method**: `toCSV()`
- **Arguments**: None
- **Description**: Converts the Ledger instance to a CSV formatted string.
- **Throws**: None