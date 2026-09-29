# S-Files Index

## s1_library.js
- Library class
  - constructor()
  - addBook(isbn, title, copies)
  - checkout(isbn, member, day)
  - available(isbn)
  - _getMemberLoans(member, isbn)
  - _memberHasBook(member, isbn)
  - placeHold(isbn, member)
  - fines(member)
  - dueDay(isbn, member)
  - search(text)
  - removeBook(isbn)

## s2_logs.py
- parse_line(line)
- parse_log(text)
- bad_lines(text)
- status_counts(entries)
- error_rate(entries)
- top_paths(entries, n=3)
- percentile(entries, p)
- main()

## s3_matrix.js
- Matrix class
  - constructor(rows, cols)
  - get(row, col)
  - set(row, col, value)
  - rows()
  - cols()
  - add(other)
  - multiply(other)
  - transpose()
  - determinant()
  - minor(row, col)
  - cofactor(row, col)
  - adjugate()
  - inverse()
## s5_expr.js
- evaluate(expr, vars = {})
- tokenize(expr)
- toRPN(expr)
