# s1_library.js - the Library class

- `addBook(isbn, title, copies = 1)` - adds copies of a book; an isbn that exists gets more copies and keeps its first title. Throws unless copies is a positive integer.
- `copies(isbn)` - how many copies the library owns (0 for an unknown isbn).
- `titles()` - every title, sorted.
- `available(isbn)` - copies minus the copies on loan.
- `checkout(isbn, member, day = 0)` - lends one copy. Throws for an unknown isbn, when no copy is available, when the member already has the book, at the loan limit (3 books), or with 500 or more cents of unpaid fines.
- `returnBook(isbn, member, day = 0)` - ends the loan and returns the fine in cents (25 per day late; a loan is due 14 days after it starts). The copy goes to the first member holding the book. Throws if the member does not have the book.
- `loans(member)` - the isbns the member has, sorted.
- `placeHold(isbn, member)` - queues the member for a book with no available copy. Throws for an unknown isbn, if a copy is available, if the member already has or holds it, or at the loan limit / fines rule.
- `holds(isbn)` - the queue, in order.
- `dueDay(isbn, member)` - the day the loan is due. Throws if the member does not have the book.
- `overdue(today)` - `{ isbn, member, daysLate }` for every loan past due, most days late first.
- `fines(member)` - unpaid fines in cents.
- `pay(member, cents)` - lowers the fines; throws for an amount that is not positive or more than is owed.
- `toJSON()` / `Library.fromJSON(data)` - save and rebuild the whole state (books, loans, holds, fines).
- `search(text)` - isbns whose title contains text, ignoring case, sorted by title then isbn.
- `removeBook(isbn)` - removes a book and returns true; false for an unknown isbn; throws when a copy is on loan or the book has holds.
