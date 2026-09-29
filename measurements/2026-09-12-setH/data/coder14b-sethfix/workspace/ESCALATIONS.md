# Escalations

Runs that stopped and need a person. Newest at the bottom.

## 2026-09-12 07:06:04 — loop
- run: `084b9176-de79-4d22-ae5e-7c806634e438`  (status: stopped)
- goal: Create s2_logs.py with parse_line(line) for access-log lines like 127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045 (ip, time, request, status, bytes, seconds). It returns a dict with ip, time (the text inside the brackets), method, path, status (int), bytes (int; 
- what happened: Stopped: the model produced the same response 3 times in the last 5 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-12 07:13:42 — tunnel
- run: `2db90c7d-2051-46cd-99b9-9b938f934f0a`  (status: interrupted)
- goal: Create s5_expr.js exporting evaluate(expr) that computes + - * / on numbers (integers and decimals) with the usual precedence and left-to-right order, allowing spaces; it throws an Error for division by zero and for anything it cannot parse. Include asserts that all pass, then run it with node.
- what happened: Run paused at step 4 — the model is unreachable. Check Ollama is running, or re-point the tunnel in Settings, then Resume. (Model stream failed before any content: Premature close)
- what to do: The model endpoint was unreachable. Re-point the Ollama tunnel, then Resume.

## 2026-09-12 07:14:34 — tool_loop
- run: `d96a82d6-33dd-418a-b698-afe793ac9720`  (status: stopped)
- goal: Create s6_graph.py with a Graph class for a directed graph: add_node(n) (adding an existing node is not an error), add_edge(a, b, weight=1) which adds both nodes and raises ValueError unless weight is a positive number (adding an edge that exists replaces its weight), nodes() returning every node so
- what happened: Stopped: the same tool call returned the identical answer 3 times - the tool refused every time, so nothing the model asked for had any effect.

## 2026-09-12 07:16:31 — loop
- run: `f3f65610-5e18-4950-b9b0-a749f9423ea4`  (status: stopped)
- goal: Create s7_cache.js exporting a Cache class: new Cache(capacity) (it throws an Error unless capacity is a positive integer), set(key, value), get(key) (undefined when missing), has(key) and size(). When the cache is full, setting a new key evicts the least recently used entry, where both get and set 
- what happened: Stopped: the model produced the same response 3 times in the last 7 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-12 07:17:53 — loop
- run: `997efd91-585c-4411-be61-c26aef955cef`  (status: stopped)
- goal: Create s8_grades.py with a Gradebook class: add_student(name) (ValueError if it exists), add_assignment(name, max_points) (ValueError for a duplicate name or a max_points that is not a positive number), record(student, assignment, points) (KeyError for an unknown student or assignment, ValueError un
- what happened: Stopped: the model produced the same response 3 times in the last 8 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-12 07:20:52 — loop
- run: `66e9d9ff-fe71-4bc8-b94e-ecb897a9808e`  (status: stopped)
- goal: Create s10_desk.js that uses the EXISTING s1_library.js and s7_cache.js (require them; read them first so you use their real exports) and exports shelfLine(library): the library's titles() joined with ', ', or '(empty)' when it has no books. Include asserts that all pass, then run it with node.
- what happened: Stopped: the model produced the same response 3 times in the last 8 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-12 07:22:54 — error
- run: `ac9bc89f-cb7d-4629-81a6-1acc1e5ceae0`  (status: stopped)
- goal: Add checkout(isbn, member) and available(isbn) to the EXISTING Library in s1_library.js: checkout lends one copy to member, and available(isbn) is the copies minus the copies on loan. checkout throws an Error for an unknown isbn, when no copy is available, or when that member already has that book, 
- what happened: s1_library.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:24:54 — error
- run: `deddb8c0-6d8d-4781-b1f7-b41f79207764`  (status: stopped)
- goal: Add parse_log(text) and bad_lines(text) to the EXISTING s2_logs.py: parse_log returns the parsed dicts of every valid line, skipping blank and malformed lines; bad_lines returns the 1-based line numbers of the malformed lines that are not blank. Run it with python.
- what happened: s1_library.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:27:02 — error
- run: `900e4fe2-0e35-47a8-a2d4-5a2464b252c0`  (status: stopped)
- goal: Add add(other) and sub(other) to the EXISTING Matrix in s3_matrix.js, each returning a new Matrix and throwing an Error when the shapes differ; neither changes the matrices it is given. Run it with node.
- what happened: s1_library.js did not parse at the end of the run — restored the version this run committed at ce1e8f3. That removed: available.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:27:55 — error
- run: `24f72c20-562a-4b9d-8833-5660322659dc`  (status: stopped)
- goal: Add headings to to_html in the EXISTING s4_markdown.py: a line that starts with 1 to 3 # characters and a space becomes <h1>, <h2> or <h3> with the rest of the line as its text, and it is always a block of its own, even with no blank line around it. Run it with python.
- what happened: s4_markdown.py does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:30:31 — error
- run: `c126ac36-1bad-4473-9132-bd0dc03494e4`  (status: stopped)
- goal: Make evaluate() in the EXISTING s5_expr.js handle parentheses and unary minus: '-(2+3)*2' is -10 and '2*-3' is -6. Run it with node.
- what happened: s4_markdown.py does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:32:20 — error
- run: `4e741fc5-e9f0-4830-945f-e998b5774811`  (status: stopped)
- goal: Add bfs(start) to the EXISTING Graph in s6_graph.py returning the nodes reachable from start in breadth-first order, visiting neighbors in sorted order; an unknown start raises KeyError. Run it with python.
- what happened: s4_markdown.py did not parse at the end of the run — restored the version this run committed at 96f6a8d.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:35:04 — loop
- run: `4cf59e58-629a-4c9a-aa71-d3f423eae65b`  (status: stopped)
- goal: Add percent(student) to the EXISTING Gradebook in s8_grades.py returning the student's total points divided by the total max_points of the assignments they have a score for, as a percentage rounded to 2 decimals, or None when they have no scores; an unknown student raises KeyError. Run it with pytho
- what happened: Stopped: the model produced the same response 3 times in the last 4 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-12 07:39:47 — error
- run: `346b7cfe-8cfb-43d5-a64f-8fd1983a0a10`  (status: stopped)
- goal: Add availability(library, isbn) to the EXISTING s10_desk.js and export it: it returns 'available/copies' for that book, e.g. '1/2'. Run it with node.
- what happened: s10_desk.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:42:49 — error
- run: `1f5b74f0-bb9f-49b6-9c49-806bc32ba0fb`  (status: stopped)
- goal: Add returnBook(isbn, member) and loans(member) to the EXISTING Library in s1_library.js: returnBook ends that loan and throws an Error if the member does not have that book; loans(member) returns the isbns that member has on loan, sorted. Run it with node.
- what happened: s1_library.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:43:43 — error
- run: `8eeeee98-f2ff-4597-bfc2-441f4f9afebd`  (status: stopped)
- goal: Add status_counts(entries) and error_rate(entries) to the EXISTING s2_logs.py: status_counts returns a dict of status -> count; error_rate returns the fraction of entries whose status is 500 or more, rounded to 4 decimals (0.0 when there are no entries). Run it with python.
- what happened: s1_library.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:44:43 — error
- run: `6e187cd9-d4d7-4953-a1e6-7c95d29ccdbb`  (status: stopped)
- goal: Add mul(x) to the EXISTING Matrix in s3_matrix.js: with a number it returns the scalar multiple, with a Matrix it returns the matrix product, and it throws an Error when the inner dimensions do not match. Run it with node.
- what happened: s1_library.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:47:33 — error
- run: `da7271a7-bc45-4f1b-afc1-e2035746bc1e`  (status: stopped)
- goal: Add emphasis to to_html in the EXISTING s4_markdown.py, in paragraphs and headings: **text** becomes <strong>text</strong> and *text* becomes <em>text</em>; markers without a partner stay as they are. Run it with python.
- what happened: s4_markdown.py does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:48:43 — error
- run: `b94ebb25-d8af-472f-bf92-abad8d1c69ad`  (status: stopped)
- goal: Add the ^ operator (power) to evaluate() in the EXISTING s5_expr.js: it binds tighter than * and /, is right-associative ('2^3^2' is 512), and a leading minus applies after it ('-2^2' is -4). Run it with node.
- what happened: s4_markdown.py does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:50:02 — error
- run: `ad8a87a8-b608-4c21-8c24-78a331acdc8a`  (status: stopped)
- goal: Add shortest_path(a, b) to the EXISTING Graph in s6_graph.py returning (cost, [a, ..., b]) for the cheapest path by total weight, or None when b cannot be reached; shortest_path(a, a) is (0, [a]). An unknown node raises KeyError. Run it with python.
- what happened: s4_markdown.py does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:51:06 — error
- run: `c9d397f0-d9ea-46ff-a66f-317c9228d9c2`  (status: stopped)
- goal: Add keys() to the EXISTING Cache in s7_cache.js returning the keys from the most recently used to the least recently used. Run it with node.
- what happened: s4_markdown.py does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:52:24 — error
- run: `1b044c3a-5be8-4825-873e-47341c1f90cc`  (status: stopped)
- goal: Add a module-level letter(percent) to the EXISTING s8_grades.py (A for 90 or more, B for 80 or more, C for 70 or more, D for 60 or more, otherwise F) and a Gradebook.report() method returning a list of (student, percent, letter) sorted by student, with letter "-" when percent is None. Run it with py
- what happened: s4_markdown.py does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:56:43 — error
- run: `aa2d8cd2-46ae-48c1-83a5-82a9ff6a01ba`  (status: stopped)
- goal: Add elements with the ids "s9-count-todo", "s9-count-doing" and "s9-count-done" to the EXISTING s9 board (s9_board.html, s9_board.js), each always showing just the number of cards in that column.
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:57:49 — error
- run: `8bc322d9-754c-47af-81fb-75324ea7273d`  (status: stopped)
- goal: Add memberLine(library, member) to the EXISTING s10_desk.js and export it: 'member: isbn1, isbn2' from loans(member), or 'member: none' when the member has no loans. Run it with node.
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 07:59:48 — error
- run: `16e8c72c-7297-42bb-af2a-4a6b0279effc`  (status: stopped)
- goal: Add holds to the EXISTING Library in s1_library.js: placeHold(isbn, member) queues a member for a book with no available copy, and throws an Error if a copy is available or the member already holds or has that book. When a copy comes back through returnBook it goes straight to the first member in th
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:00:30 — error
- run: `0f12aeae-0b86-4482-9a81-66072766bb0a`  (status: stopped)
- goal: Add top_paths(entries, n=3) to the EXISTING s2_logs.py returning a list of (path, count) tuples, most requested first and ties by path; a query string does not count as part of the path ("/a?x=1" counts as "/a"). Run it with python.
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:01:16 — error
- run: `77c19403-6eed-4180-878c-ca53d6230762`  (status: stopped)
- goal: Add transpose() and a static identity(n) to the EXISTING Matrix in s3_matrix.js; identity throws an Error unless n is a positive integer. Run it with node.
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:02:03 — error
- run: `04188d70-f452-4843-ab4e-d3dc2f202488`  (status: stopped)
- goal: Add inline code to to_html in the EXISTING s4_markdown.py: `code` becomes <code>code</code>, the code is escaped like everything else, and ** or * inside it are not turned into emphasis. Run it with python.
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:03:27 — error
- run: `e8842976-60f9-4d97-9bef-29c86292893b`  (status: stopped)
- goal: Add variables to the EXISTING s5_expr.js: evaluate(expr, vars = {}) where a name ([A-Za-z_][A-Za-z0-9_]*) takes its value from vars; an unknown name throws an Error whose message contains the name. Run it with node.
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:04:53 — error
- run: `51723b35-f0e4-435e-8e3b-3c1c856fbbc0`  (status: stopped)
- goal: Add has_cycle() to the EXISTING Graph in s6_graph.py returning True when the graph has a directed cycle (an edge from a node to itself counts). Run it with python.
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:06:12 — error
- run: `9b0ca9d1-5e36-492c-abcb-cc49740fb262`  (status: stopped)
- goal: Add peek(key) to the EXISTING Cache in s7_cache.js returning the value like get(key) but without counting as a use. Run it with node.
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:09:45 — error
- run: `a3a58e96-74f3-43f0-a632-f256fb5fd507`  (status: stopped)
- goal: Add categories to the EXISTING Gradebook in s8_grades.py: add_assignment(name, max_points, category="default") and set_weight(category, weight) (ValueError unless weight is a positive number; a category without a set weight weighs 1). percent(student) becomes the weighted average of the student's pe
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:10:54 — error
- run: `f70d78c7-fb19-4e2b-aca2-cab88d464021`  (status: stopped)
- goal: Give every card in the EXISTING s9 board (s9_board.html, s9_board.js) a button with the class "s9-del" that removes the card.
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:12:10 — error
- run: `1380b856-3d08-4008-908a-e3aee9bc3723`  (status: stopped)
- goal: Add makeLookup(library, cache) to the EXISTING s10_desk.js and export it: it returns a function (isbn) that gives availability(library, isbn), keeping each answer in the given Cache (from s7_cache.js) under the isbn and answering from the cache when it has one. Run it with node.
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:12:57 — error
- run: `78d9c76b-7a65-4472-81c3-64af44953014`  (status: stopped)
- goal: Add due days to the EXISTING Library in s1_library.js: checkout(isbn, member, day = 0) and returnBook(isbn, member, day = 0) take the day number (an integer) it happens on; a loan is due 14 days after it starts, and a hold that turns into a loan starts on the day of that return. Add dueDay(isbn, mem
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:14:28 — error
- run: `ccadea9b-8ce8-48f5-9cc9-ecd1e3a99cb7`  (status: stopped)
- goal: Add percentile(entries, p) to the EXISTING s2_logs.py returning the p-th percentile of the seconds values by nearest rank (the smallest value such that at least p percent of the values are less than or equal to it). It raises ValueError unless 0 < p <= 100 and there is at least one value. Run it wit
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:15:27 — error
- run: `33f89f3c-9750-48af-9db9-4bdd23879966`  (status: stopped)
- goal: Add equals(other, eps = 1e-9) to the EXISTING Matrix in s3_matrix.js: true when both have the same shape and every pair of entries differs by at most eps, otherwise false. Run it with node.
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:16:34 — error
- run: `acc15d2a-fe48-4a69-ab77-b5cecf4acfe6`  (status: stopped)
- goal: Add links to to_html in the EXISTING s4_markdown.py: [text](url) becomes <a href="url">text</a>, with a double quote in the url written as &quot;. Run it with python.
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:21:42 — error
- run: `cf9a7fb4-881f-4040-b64d-11efd9a264c2`  (status: stopped)
- goal: Add functions to evaluate() in the EXISTING s5_expr.js: min(...) and max(...) with one or more arguments, abs(x) and sqrt(x). sqrt of a negative number throws an Error, an unknown function throws an Error whose message contains its name, and abs or sqrt with other than one argument throws an Error. 
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:23:15 — error
- run: `7a925499-d8e5-4eef-9ca9-bc9e4ecbdf83`  (status: stopped)
- goal: Add topo_order() to the EXISTING Graph in s6_graph.py returning the nodes in topological order, always taking the smallest node that is ready next; it raises ValueError when the graph has a cycle. Run it with python.
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:24:23 — error
- run: `57774903-993e-42b3-bccc-15f54252a9c9`  (status: stopped)
- goal: Add expiry to the EXISTING Cache in s7_cache.js: new Cache(capacity, { ttl, now }) makes an entry expire ttl milliseconds after it was set, where now() is the clock (Date.now by default); set(key, value, { ttl }) overrides it for one entry. An expired entry counts as missing everywhere (get, has, pe
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:25:34 — error
- run: `b483657b-064f-43bd-a456-2f7a42d909a3`  (status: stopped)
- goal: Add drop_lowest(category, n) to the EXISTING Gradebook in s8_grades.py: from then on percent() ignores the n lowest scores (by percentage of max_points) a student has in that category, but only when the student has more than n scores there. Run it with python.
- what happened: s9_board.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:28:50 — error
- run: `91231920-06c8-4ded-a494-223a1a4a5135`  (status: stopped)
- goal: Make the EXISTING s9 board (s9_board.html, s9_board.js) save the cards in localStorage under the key "s9-board", so reloading the page shows the same cards in the same columns and order.
- what happened: s8_grades.py does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:29:55 — error
- run: `c1d02c0d-dcc9-4eb9-b921-184e53656254`  (status: stopped)
- goal: Add overdueLines(library, today) to the EXISTING s10_desk.js and export it: one line per entry of library.overdue(today), in that order, written 'member owes isbn (N days)', joined with '\n' ('' when there are none). Run it with node.
- what happened: s8_grades.py does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 08:32:45 — error
- run: `26c2665c-ac68-4f36-ad75-692acd05d295`  (status: stopped)
- goal: Add fines to the EXISTING Library in s1_library.js: returnBook now returns the fine for that loan in cents, 25 per day late (0 when on time), and adds it to the member's unpaid fines; fines(member) returns the total unpaid, and pay(member, cents) lowers it, throwing an Error for an amount that is no
- what happened: s8_grades.py does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.
