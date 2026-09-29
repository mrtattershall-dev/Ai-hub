# Library Class Methods

## addBook(isbn, title, copies = 1)
- **Arguments**: 
  - `isbn`: The ISBN of the book.
  - `title`: The title of the book.
  - `copies`: The number of copies to add (default is 1).
- **Throws**: 
  - Throws an error if `copies` is not a positive integer.

## copies(isbn)
- **Arguments**: 
  - `isbn`: The ISBN of the book.
- **Returns**: 
  - The number of copies available for the given ISBN.

## titles()
- **Returns**: 
  - An array of all book titles sorted alphabetically.