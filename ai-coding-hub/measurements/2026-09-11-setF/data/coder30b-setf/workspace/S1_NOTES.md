# Library Class Public Methods

## `addBook(isbn, title, copies = 1)`
- **Arguments**: 
  - `isbn` (string): The ISBN of the book
  - `title` (string): The title of the book
  - `copies` (integer, optional): Number of copies to add (default: 1)
- **Throws**: 
  - `Error`: If `copies` is not a positive integer

## `copies(isbn)`
- **Arguments**: 
  - `isbn` (string): The ISBN of the book
- **Throws**: 
  - None

## `checkout(isbn, member, day = 0)`
- **Arguments**: 
  - `isbn` (string): The ISBN of the book to checkout
  - `member` (string): The member checking out the book
  - `day` (integer, optional): The current day (default: 0)
- **Throws**: 
  - `Error`: If the ISBN is unknown
  - `Error`: If no copies are available for the ISBN
  - `Error`: If the member has reached the limit of 3 books on loan
  - `Error`: If the member has 500 or more cents in fines

## `available(isbn)`
- **Arguments**: 
  - `isbn` (string): The ISBN of the book
- **Throws**: 
  - None

## `placeHold(isbn, member)`
- **Arguments**: 
  - `isbn` (string): The ISBN of the book to place a hold on
  - `member` (string): The member placing the hold
- **Throws**: 
  - `Error`: If the ISBN is unknown
  - `Error`: If the book is available (cannot place hold on available books)
  - `Error`: If the member already has the book
  - `Error`: If the member already has a hold on this book
  - `Error`: If the member has reached the limit of 3 books on loan

## `fines(member)`
- **Arguments**: 
  - `member` (string): The member identifier
- **Throws**: 
  - None

## `dueDay(isbn, member)`
- **Arguments**: 
  - `isbn` (string): The ISBN of the book
  - `member` (string): The member identifier
- **Throws**: 
  - None

## `search(text)`
- **Arguments**: 
  - `text` (string): The search text
- **Throws**: 
  - None

## `removeBook(isbn)`
- **Arguments**: 
  - `isbn` (string): The ISBN of the book to remove
- **Throws**: 
  - `Error`: If the book does not exist
  - `Error`: If copies of the book are currently on loan
  - `Error`: If the book has holds