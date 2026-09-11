# r-files

- **r1_ledger.js** - exports `Ledger` (open, deposit, balance, withdraw, transfer, history, freeze, unfreeze, undo, applyInterest, toCSV, fromCSV).
- **r2_text.py** - `words`, `word_count`, `sentences`, `top_words`, `bigrams`, `avg_sentence_length`, `read_counts`, `summary`, `main` (command line).
- **r3_tasks.js** - exports `TaskGraph` (add, has, size, depend, order, earliestStart, totalTime, criticalPath, remove, toJSON, fromJSON, ready).
- **r4_geom.js** - exports `distance`, `polygonArea`, `perimeter`, `centroid`, `boundingBox`, `pointInPolygon`, `convexHull`, `translate`, `scale`, `isConvex`, `rotate`; helpers `chkPt`, `chkPts`, `signedArea`, `onSegment`.
- **r5_store.py** - class `Store` (set, get, delete, keys, begin, commit, rollback, count_prefix, items, save, load, incr, stats).
- **r6_days.py** - `parse`, `fmt`, `add_days`, `is_weekend`, `add_business_days`, `business_days_between`, `month_end`, `add_months`, `iso_week`, `weekday_name`, `next_weekday`.
- **r7_grid.py** - `parse_grid`, `neighbors`, `shortest_path`, `render`, `parse_costs`, `cheapest_path`, `reachable`, `count_regions`, `life_step`, `life_run`, `is_still`, `to_text`.
- **r8_money.js** - exports `parseMoney`, `formatMoney`, `addMoney`, `subtractMoney`, `multiplyMoney`, `splitMoney`, `allocateMoney`, `taxMoney`, `convertMoney`, `sumMoney`, `compareMoney`.
- **r9_app.html** - the to-do page (input, list, count, filters, clear button, empty message).
- **r9_app.js** - the to-do page's logic (no exports).
- **r10_report.js** - exports `Ledger` (re-exported), `balancesReport`, `totalReport`, `interestPreview`, `evenSplit`, `historyReport`, `taxReport`, `convertBalances`, `currencyReport`, `richest`.
