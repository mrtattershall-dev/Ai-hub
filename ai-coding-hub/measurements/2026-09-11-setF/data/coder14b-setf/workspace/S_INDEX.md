# S-Files Index

## JavaScript Files

### s1_library.js
- **Class**: Library
  - `addBook(isbn, title, copies = 1)`
  - `copies(isbn)`
  - `titles()`

### s3_matrix.js
- **Class**: Matrix
  - `mul(x)`
  - `get(key)`
  - `peek(key)`
  - `has(key)`
  - `size()`
  - `getLeastUsedKey()`

### s5_expr.js
- **Function**: evaluate(expr, vars = {})
- **Function**: isOperator(c)
- **Function**: precedence(op)
- **Function**: applyOp(a, b, op)
- **Function**: infixToPostfix(expr)
- **Function**: evaluatePostfix(postfix)
- **Function**: tokenize(expr)
- **Function**: toRPN(expr)
- **Function**: compile(expr)

### s7_cache.js
- **Class**: Cache
  - `set(key, value)`
  - `get(key)`
  - `peek(key)`
  - `has(key)`
  - `size()`
  - `getLeastUsedKey()`

### s9_board.js
- **Function**: updateCounters()
- **Function**: saveCards()
- **Function**: loadCards()
- **Function**: cardExists(text)
- **Function**: removeCard(event)

## Python Files

### s2_logs.py
- **Function**: log(message)
- **Function**: error(message)
- **Function**: info(message)

### s4_markdown.py
- **Function**: markdown_to_html(markdown)
- **Function**: html_to_markdown(html)

### s6_graph.py
- **Function**: plot(data)
- **Function**: save_plot(filename)

### s8_grades.py
- **Class**: Gradebook
  - `add_assignment(self, assignment)`
  - `add_student(self, student)`
  - `record(self, student, assignment, points, max_points, category=None)`
  - `set_missing_zero(self)`
  - `set_weight(self, assignment, weight)`
  - `curve(self, points, max_points)`
  - `drop_lowest(self, student)`
  - `percent(self, student, assignment)`
  - `letter_grade(self, student, assignment)`
  - `score(self, student, assignment)`
  - `report(self, student)`
  - `stats(self)`
  - `to_csv(self)`
  - `read_csv(file_path)`

## HTML Files

### s9_board.html
- **HTML Structure**: Contains sections for `todo`, `doing`, and `done` lists.
- **JavaScript**: Includes event listeners for drag-and-drop, card removal, and filtering.