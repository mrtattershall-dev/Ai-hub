# q-files

- **q1_stock.js** - exports `Warehouse` (addItem, stock, skus, remove, reserve, available, release, fulfil, lowStock, toJSON, fromJSON, history).
- **q2_table.py** - `parse_csv`, `to_csv`, `select`, `where`, `order_by`, `group_count`, `aggregate`, `join`, `pivot`, `main` (command line).
- **q3_calendar.js** - exports `Calendar` (add, get, list, conflicts, remove, move, freeSlots, firstFree, toText, fromText), `formatTime`, `parseTime`.
- **q4_template.js** - exports `render`, `compile`.
- **q5_limits.py** - classes `RateLimited`, `TokenBucket`, `SlidingWindow`, `KeyedLimiter`; decorator `limited`.
- **q6_jpath.py** - `get`, `set_path`, `delete`, `find`, `flatten`, `unflatten`, `diff`, `merge`.
- **q7_buffer.js** - exports `TextBuffer` (insert, remove, undo, redo, lines, lineCol, posOf, find, findAll, replaceAll, beginGroup, endGroup, wordAt, toJSON, fromJSON, stats).
- **q8_units.py** - `convert`, `parse_quantity`, `scale_recipe`, `format_quantity`, `to_metric`, `shopping_list`, `main` (command line).
- **q9_shop.html** - the shop page (products, cart, total, count, discount code, clear, delivery message).
- **q9_shop.js** - the shop page's logic (no exports).
- **q10_report.js** - exports `Warehouse` (re-exported), `skuLine`, `itemLine`, `reservedLine`, `shoutLine`, `stockTable`, `emptyNote`, `lowReport`, `jsonReport`, `historyReport`.
