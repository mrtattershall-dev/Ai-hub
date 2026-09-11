# Set F workspace index

- **s1_library.js** - `Library`: books, loans, holds, due days, fines and limits.
- **s2_logs.py** - access-log analysis: `parse_line`, `parse_log`, `bad_lines`, `status_counts`, `error_rate`, `top_paths`, `percentile`, `by_hour`, `between`, `sessions`, and `main` for the command line.
- **s3_matrix.js** - `Matrix`: arithmetic, determinant, inverse, solving and text conversion.
- **s4_markdown.py** - `to_html` converts the markdown subset to HTML; `toc` lists the headings with slugs.
- **s5_expr.js** - `evaluate`, `tokenize`, `toRPN` and `compile` for arithmetic expressions.
- **s6_graph.py** - `Graph`: a weighted directed graph with search, paths, ordering and DOT output.
- **s7_cache.js** - `Cache`: an LRU cache with expiry, stats and eviction callbacks.
- **s8_grades.py** - `Gradebook` and `letter`, plus `main` for the command line.
- **s9_board.html** / **s9_board.js** - the kanban board page (browser code, no exports).
- **s10_desk.js** - built on s1 and s7: `shelfLine`, `availability`, `memberLine`, `makeLookup`, `overdueLines`, `fineReport`, `canBorrow`, `snapshot`, `restore`, `searchLines`.
