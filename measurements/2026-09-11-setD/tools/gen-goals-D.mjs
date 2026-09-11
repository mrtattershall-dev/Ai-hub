// gen-goals-D.mjs : writes goals-D.json - 10 chains x 10 steps, INTERLEAVED by round
// (goal = (step-1)*10 + chain), so every file is reopened after nine unrelated goals.
// r10 (integration) only uses r1/r8 features from the same round or earlier.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const D = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = 'Put the asserts under if __name__ == "__main__": and run it with python.';

export const CHAINS = [
  [ // r1 ledger (JS)
    'Create r1_ledger.js exporting a Ledger class: open(name) creates an account with balance 0 and throws an Error if it already exists; deposit(name, amount) adds money and throws for an unknown account or an amount that is not a positive number; balance(name) returns the balance and throws for an unknown account. Include asserts that all pass, then run it with node.',
    'Add withdraw(name, amount) to the EXISTING Ledger class in r1_ledger.js: it throws an Error for an unknown account, a non-positive amount, or not enough money, and otherwise reduces the balance. Keep everything else working. Run it with node.',
    'Add transfer(from, to, amount) to the EXISTING Ledger in r1_ledger.js. It is all-or-nothing: if it throws (unknown account, bad amount, not enough money, or from === to) neither balance changes. Run it with node.',
    "Add history(name) to the EXISTING Ledger in r1_ledger.js returning that account's entries in order as {type, amount} objects, type one of 'deposit', 'withdraw', 'transfer-in', 'transfer-out'. Failed operations must not appear. Run it with node.",
    'Add freeze(name) and unfreeze(name) to the EXISTING Ledger in r1_ledger.js (both throw for an unknown account). While an account is frozen, deposit, withdraw and transfer (in either direction) throw an Error without changing anything; balance and history still work. Run it with node.',
    'Add undo() to the EXISTING Ledger in r1_ledger.js: it reverses the most recent successful deposit, withdraw or transfer - the balances AND the history go back to how they were before it. Calling undo() again reverses the one before that. It throws an Error when there is nothing left to undo. Run it with node.',
    "Add applyInterest(ratePct) to the EXISTING Ledger in r1_ledger.js: every account that is not frozen and has a positive balance gets balance * ratePct / 100, rounded to cents (Math.round(x * 100) / 100), added to its balance and recorded in its history as type 'interest'. It returns the total interest paid. undo() never undoes interest: it skips it and reverses the most recent deposit, withdraw or transfer as before. Run it with node.",
    "Add toCSV() to the EXISTING Ledger in r1_ledger.js returning text: the header line 'account,balance', then one line per account sorted by name with the balance written with exactly 2 decimals (e.g. 'alice,12.50'). Lines are joined with '\\n' and there is no trailing newline. Run it with node.",
    "Add a static fromCSV(text) to the EXISTING Ledger in r1_ledger.js that builds a new Ledger from toCSV() output: each account is opened and, if its balance is above 0, given one 'deposit' of that balance. It throws an Error for a missing or wrong header or a malformed line. Ledger.fromCSV(l.toCSV()).toCSV() must equal l.toCSV(). Run it with node.",
    'Write R1_NOTES.md listing every public method of the Ledger class in r1_ledger.js with its arguments and when it throws. Read the file first; do not invent anything.',
  ],
  [ // r2 text (Python)
    'Create r2_text.py with words(text) returning the list of lower-case words in order - a word is a run of letters and digits, and an apostrophe between two letters stays inside the word, so "Don\'t" is "don\'t" - and word_count(text) returning a dict of word to count. ' + MAIN,
    'Add sentences(text) to the EXISTING r2_text.py: split the text into sentences ending in \'.\', \'!\' or \'?\', keeping that punctuation and stripping spaces, so "Hi! How are you? Fine." gives ["Hi!", "How are you?", "Fine."]. A last piece without ending punctuation is kept; empty pieces are dropped. Run it with python.',
    'Add top_words(text, n, stopwords=()) to the EXISTING r2_text.py returning the n most common words as (word, count) tuples, most common first, ties in alphabetical order, leaving out any word in stopwords (compared in lower case). Run it with python.',
    'Add bigrams(text) to the EXISTING r2_text.py returning a dict that maps each pair of neighbouring words in words(text), written as "first second", to how many times it occurs. Run it with python.',
    'Add avg_sentence_length(text) to the EXISTING r2_text.py: the average number of words per sentence (using sentences() and words()), rounded to 2 decimals, and 0.0 when there are no sentences. Run it with python.',
    'Add read_counts(path) to the EXISTING r2_text.py that reads a UTF-8 text file and returns word_count of its contents; a missing file must raise FileNotFoundError. Run it with python.',
    "Make the EXISTING r2_text.py a command-line tool: python r2_text.py FILE N prints the N most common words of that file, one per line as 'word count'. Importing the module must not print anything. Run it with python.",
    'Add a --json option to the EXISTING r2_text.py command line: python r2_text.py FILE N --json prints only a JSON object {"top": [[word, count], ...], "sentences": number_of_sentences}. Without --json the output stays as before. Run it with python.',
    'Change words() in the EXISTING r2_text.py so letters with accents count as letters and case is folded, so "Café CAFÉ café" gives "café" three times. Everything built on words() must keep working. Run it with python.',
    'Add summary(text) to the EXISTING r2_text.py returning a dict {"words": total number of words, "unique": number of different words, "sentences": number of sentences, "top": top_words(text, 3)}. Run it with python.',
  ],
  [ // r3 task graph (JS)
    'Create r3_tasks.js exporting a TaskGraph class: add(id, duration) adds a task and throws an Error if the id already exists or duration is not a positive number; has(id) and size(). Include asserts that all pass, then run it with node.',
    'Add depend(id, onId) to the EXISTING TaskGraph in r3_tasks.js, meaning task id cannot start until task onId has finished. It throws an Error if either task is unknown or if id === onId. Run it with node.',
    'Add order() to the EXISTING TaskGraph in r3_tasks.js returning every id in an order where each task comes after all the tasks it depends on; whenever several tasks are ready, the one that was added first goes first. Run it with node.',
    'Make depend() in the EXISTING r3_tasks.js throw an Error when the new dependency would create a cycle, leaving the graph unchanged. Run it with node.',
    'Add earliestStart(id) to the EXISTING TaskGraph in r3_tasks.js: 0 for a task with no dependencies, otherwise the latest finish time (earliest start + duration) of the tasks it depends on. It throws an Error for an unknown id. Run it with node.',
    'Add totalTime() to the EXISTING TaskGraph in r3_tasks.js: how long it takes to finish every task if any number of tasks can run at once (0 for an empty graph). Run it with node.',
    'Add criticalPath() to the EXISTING TaskGraph in r3_tasks.js returning the ids of a longest chain of dependent tasks, in order, from a task with no dependencies to a task that finishes at totalTime(). If several chains tie, any one of them is fine. Run it with node.',
    'Add remove(id) to the EXISTING TaskGraph in r3_tasks.js that deletes the task and every dependency on it or from it; it throws an Error for an unknown id. Run it with node.',
    'Add toJSON() to the EXISTING TaskGraph in r3_tasks.js returning { tasks: [{ id, duration, deps }] } in the order the tasks were added (deps = the ids it depends on), and a static fromJSON(data) that rebuilds an equal graph (same order()). fromJSON throws an Error if the data has a cycle or an unknown dependency. Run it with node.',
    'Add ready(doneIds) to the EXISTING TaskGraph in r3_tasks.js returning, in the order the tasks were added, the ids that are not in doneIds and whose dependencies are all in doneIds. Run it with node.',
  ],
  [ // r4 geometry (JS)
    'Create r4_geom.js exporting distance(a, b) for points given as {x, y}, and polygonArea(points) returning the area of a simple polygon given by its corners in order (always positive, for either winding). Include asserts that all pass, then run it with node.',
    'Add perimeter(points) to the EXISTING r4_geom.js and export it: the length all the way around the closed polygon. Run it with node.',
    "Add centroid(points) to the EXISTING r4_geom.js and export it: the centre of mass of the polygon's AREA (not the average of the corners), as {x, y}. It throws an Error for a polygon with zero area. Run it with node.",
    'Add boundingBox(points) to the EXISTING r4_geom.js and export it, returning {minX, minY, maxX, maxY}; it throws an Error for an empty list. Run it with node.',
    'Add pointInPolygon(p, points) to the EXISTING r4_geom.js and export it: true if p is inside the polygon or exactly on its edge, false if it is outside. Run it with node.',
    'Add convexHull(points) to the EXISTING r4_geom.js and export it, returning the corners of the convex hull in counter-clockwise order, starting from the point with the lowest y (lowest x among ties), without points that lie on a hull edge between two corners. Run it with node.',
    'Add translate(points, dx, dy) and scale(points, factor, origin) to the EXISTING r4_geom.js and export them. Both return NEW point objects and never change the input; origin defaults to {x: 0, y: 0}. Run it with node.',
    'Make every function in the EXISTING r4_geom.js that takes points throw an Error with a clear message unless each point is an object with finite numeric x and y; the polygon functions (polygonArea, perimeter, centroid, pointInPolygon) also need at least 3 points. Results for valid input must not change. Run it with node.',
    'Add isConvex(points) to the EXISTING r4_geom.js and export it: true if the polygon, with its corners in the given order, is convex (either winding), false otherwise. Run it with node.',
    'Add rotate(points, degrees, origin) to the EXISTING r4_geom.js and export it: rotates counter-clockwise by degrees around origin (default {x: 0, y: 0}), returning new points and leaving the input unchanged. Run it with node.',
  ],
  [ // r5 store (Python)
    'Create r5_store.py with a Store class: set(key, value), get(key, default=None), delete(key) returning True if it removed something and False otherwise, and keys() returning a sorted list. ' + MAIN,
    'Add transactions to the EXISTING Store in r5_store.py: begin(), commit() and rollback(). Changes made after begin() are visible at once; rollback() undoes all of them and commit() keeps them. commit() or rollback() with no open transaction raises RuntimeError. Run it with python.',
    'Make transactions in the EXISTING r5_store.py nest: begin() inside a transaction opens an inner one, rollback() undoes only the innermost, and commit() of an inner one hands its changes to the outer one (a later outer rollback still undoes them). Run it with python.',
    'Add expiry to the EXISTING Store in r5_store.py: Store(now=time.time) takes a clock function, and set(key, value, ttl=None) with ttl seconds makes the key disappear once now() >= the time it was set + ttl (get returns the default and keys() leaves it out). Existing calls must keep working. Run it with python.',
    'Add count_prefix(prefix) and items(prefix="") to the EXISTING Store in r5_store.py: the number of live keys starting with prefix, and a sorted list of (key, value) pairs for them. Run it with python.',
    'Add save(path) and a classmethod load(path, now=time.time) to the EXISTING Store in r5_store.py using JSON. Values are JSON-compatible; expiry times are kept, so a key that expired while saved is gone after load. save() raises RuntimeError while a transaction is open. Run it with python.',
    'Add incr(key, by=1) to the EXISTING Store in r5_store.py: a missing key counts as 0, a value that is not an int raises TypeError, it returns the new value, and inside a transaction rollback() undoes it. Run it with python.',
    'Add a size limit to the EXISTING Store in r5_store.py: Store(max_keys=None, now=time.time). Setting a NEW key when the store already holds max_keys live keys raises OverflowError and changes nothing; updating an existing key is always allowed. Keyword calls like Store(now=clock) must keep working. Run it with python.',
    'Add stats() to the EXISTING Store in r5_store.py returning {"keys": number of live keys, "sets": successful set() calls, "gets": get() calls, "hits": get() calls that found a live key}, counted since the store was created; rollback() does not change the counts. Run it with python.',
    'Make the in operator and len() work on the EXISTING Store in r5_store.py ("a" in store, len(store)), both counting only live keys. Run it with python.',
  ],
  [ // r6 days (Python)
    "Create r6_days.py with parse(s) turning a 'YYYY-MM-DD' string into a datetime.date (raising ValueError for anything else, including impossible dates like '2026-02-30') and fmt(d) turning a date back into 'YYYY-MM-DD'. " + MAIN,
    "Add add_days(s, n) to the EXISTING r6_days.py returning the 'YYYY-MM-DD' date n days after s (n may be negative). Run it with python.",
    'Add is_weekend(s) and add_business_days(s, n) to the EXISTING r6_days.py: add_business_days moves forward n working days (Monday to Friday), so a Friday plus 1 is the next Monday, and n = 0 returns s itself. Run it with python.',
    "Give add_business_days in the EXISTING r6_days.py an optional holidays argument (a collection of 'YYYY-MM-DD' strings) whose dates are skipped like weekends. Existing calls must keep working. Run it with python.",
    'Add business_days_between(a, b, holidays=()) to the EXISTING r6_days.py: the number of working days d with a < d <= b, skipping weekends and holidays, and 0 when b <= a. Run it with python.',
    "Add month_end(s) and add_months(s, n) to the EXISTING r6_days.py: month_end gives the last day of s's month; add_months keeps the day of the month but clamps it to the end of the target month, so '2026-01-31' plus 1 month is '2026-02-28'. n may be negative. Run it with python.",
    'Add iso_week(s) to the EXISTING r6_days.py returning the (ISO year, ISO week number) tuple for the date. Run it with python.',
    "Add weekday_name(s) to the EXISTING r6_days.py returning the English day name, 'Monday' to 'Sunday'. Run it with python.",
    'Add next_weekday(s, name) to the EXISTING r6_days.py: the first date strictly after s that falls on the named weekday (case-insensitive); an unknown name raises ValueError. Run it with python.',
    "Make every function in the EXISTING r6_days.py that takes a date also accept a datetime.date instead of a string; functions that returned 'YYYY-MM-DD' strings still return strings. Run it with python.",
  ],
  [ // r7 grid (Python)
    "Create r7_grid.py with parse_grid(text) turning lines of '.' (open) and '#' (wall) into a list of rows of booleans (True = open), raising ValueError if the lines differ in length or contain any other character, and neighbors(grid, r, c) returning the open cells next to (r, c) as (row, col) tuples in the order up, down, left, right. " + MAIN,
    'Add shortest_path(grid, start, goal) to the EXISTING r7_grid.py: a shortest list of (row, col) cells from start to goal inclusive using up/down/left/right moves, or None if goal cannot be reached. It raises ValueError if start or goal is outside the grid or is a wall. Run it with python.',
    'Add a diagonal=False option to neighbors and shortest_path in the EXISTING r7_grid.py. With diagonal=True the four diagonal moves are allowed too, but only when at least one of the two cells beside that diagonal is open. Existing calls must keep working. Run it with python.',
    "Add render(grid, path=None) to the EXISTING r7_grid.py returning the grid as text, one line per row joined with '\\n': '#' for walls, '.' for open cells and '*' for cells on the path. Run it with python.",
    "Add parse_costs(text) and cheapest_path(costs, start, goal) to the EXISTING r7_grid.py. parse_costs reads a grid where '#' is a wall, '.' costs 1 and a digit '1'-'9' costs that much, returning rows of numbers with 0 for walls. cheapest_path moves up/down/left/right and returns (total, path), where total is the sum of the costs of the cells entered (not the start cell), or None if goal cannot be reached. Run it with python.",
    'Add reachable(grid, start) to the EXISTING r7_grid.py returning the set of open cells that can be reached from start with up/down/left/right moves (start included). Run it with python.',
    'Add count_regions(grid) to the EXISTING r7_grid.py returning how many separate groups of open cells there are (cells connect up/down/left/right). Run it with python.',
    "Add life_step(grid) to the EXISTING r7_grid.py: one step of Conway's Game of Life where True is alive and False is dead, on a grid of the same size with everything outside it dead. It returns a new grid and does not change the input. Run it with python.",
    'Add life_run(grid, n) and is_still(grid) to the EXISTING r7_grid.py: the grid after n life_step() calls, and whether one step leaves the grid unchanged. Run it with python.',
    "Add to_text(grid) to the EXISTING r7_grid.py, the inverse of parse_grid ('.' for True, '#' for False, rows joined with '\\n'), so parse_grid(to_text(g)) == g. Run it with python.",
  ],
  [ // r8 money (JS)
    "Create r8_money.js exporting parseMoney(text), which turns strings like '$1,234.56', '12', '0.5' or '-$3.50' into an integer number of cents (123456, 1200, 50, -350) and throws an Error for anything else, and formatMoney(cents), which turns cents back into '$1,234.56' (negative amounts as '-$1,234.56'). Include asserts that all pass, then run it with node.",
    'Add addMoney(...amounts) and subtractMoney(a, b) to the EXISTING r8_money.js and export them; both work on cents and throw an Error unless every argument is an integer. Run it with node.',
    'Add multiplyMoney(cents, factor) to the EXISTING r8_money.js and export it: the result is rounded to a whole cent, with halves rounded away from zero (5 * 0.5 = 2.5 becomes 3, and -2.5 becomes -3). Run it with node.',
    'Add splitMoney(cents, n) to the EXISTING r8_money.js and export it: n integer amounts that add up exactly to cents and differ by at most 1, larger ones first (1000 split 3 ways is [334, 333, 333]). Run it with node.',
    'Add allocateMoney(cents, ratios) to the EXISTING r8_money.js and export it: integer amounts in proportion to ratios that add up exactly to cents. Each part first gets the whole-cent part of its share, then the leftover cents go one each to the parts with the largest fractional remainders (earlier parts win ties). Run it with node.',
    'Add taxMoney(cents, ratePct) to the EXISTING r8_money.js and export it, returning { net, tax, gross }: net is cents, tax is net * ratePct / 100 rounded to a whole cent (halves away from zero) and gross = net + tax. Run it with node.',
    'Add convertMoney(cents, from, to, rates) to the EXISTING r8_money.js and export it. rates maps currency codes to how many US dollars one unit is worth, e.g. { USD: 1, EUR: 1.1 }; the result is in cents of the target currency, rounded with halves away from zero; an unknown code throws an Error. Run it with node.',
    "Give formatMoney in the EXISTING r8_money.js an optional currency code: formatMoney(cents, code = 'USD') uses '$' for USD, '€' for EUR and '£' for GBP, and for any other code writes the code and a space first ('JPY 1,234.56'). Existing calls must keep working. Run it with node.",
    'Add sumMoney(list) and compareMoney(a, b) to the EXISTING r8_money.js and export them: the total of an array of cents (0 for an empty array; it throws an Error unless every item is an integer), and -1, 0 or 1. Run it with node.',
    "Make parseMoney in the EXISTING r8_money.js also accept '€' and '£' in place of '$', and a currency code after the number ('12.50 EUR'), still returning cents. Everything it accepted or rejected before must stay the same. Run it with node.",
  ],
  [ // r9 web app (HTML + JS)
    'Create r9_app.html with a text input with id "r9-input" and a list <ul id="r9-list">. Typing text and pressing Enter adds it as a new <li> and clears the input. Put the logic in r9_app.js, loaded at the end of the body.',
    'In the EXISTING r9_app.js, trim the text before adding it and ignore input that is empty or only spaces.',
    'Add an element with id "r9-count" to the EXISTING r9_app.html that always shows how many items are not done, as "3 items left" ("1 item left" for one, "0 items left" for none). Wire it up in r9_app.js.',
    'In the EXISTING r9 app (r9_app.html, r9_app.js), clicking an item\'s text toggles it between done and not done; a done item\'s <li> has the class "done", and the count updates.',
    'In the EXISTING r9 app (r9_app.html, r9_app.js), give every <li> a delete button with the class "r9-del" that removes that item (the count updates).',
    'Add three filter buttons with ids "r9-all", "r9-active" and "r9-done" to the EXISTING r9 app (r9_app.html, r9_app.js) that show all items, only items not done, or only done items. Hidden items must not be visible, and switching back shows them again.',
    'Add a button with id "r9-clear" to the EXISTING r9 app (r9_app.html, r9_app.js) that removes every done item.',
    'Make the EXISTING r9 app (r9_app.html, r9_app.js) save the items (text and done state) in localStorage under the key "r9-items", so reloading the page shows the same list.',
    'Add an element with id "r9-empty" to the EXISTING r9 app (r9_app.html, r9_app.js) that shows "Nothing to do" whenever the list has no items, and is hidden otherwise.',
    'In the EXISTING r9 app (r9_app.html, r9_app.js), adding an item whose trimmed text matches an existing item (ignoring upper and lower case) does nothing.',
  ],
  [ // r10 integration report (JS) - uses r1_ledger.js and r8_money.js
    "Create r10_report.js that uses the EXISTING r1_ledger.js and r8_money.js (require them; read them first so you use their real exports) and exports balancesReport(ledger, names): an array with one line per name, 'name: ' followed by formatMoney of that account's balance in cents (Math.round(balance * 100)), e.g. 'alice: $12.50'. Include asserts that all pass, then run it with node.",
    "Add totalReport(ledger, names) to the EXISTING r10_report.js and export it: 'Total: ' followed by the formatted sum of those balances, adding the cents with addMoney from r8_money.js. Run it with node.",
    "Add interestPreview(ledger, names, ratePct) to the EXISTING r10_report.js and export it: one line per name, 'name: ' plus the formatted interest that balance would earn, computed in cents with multiplyMoney(cents, ratePct / 100). It must not change the ledger. Run it with node.",
    'Add evenSplit(ledger, from, names) to the EXISTING r10_report.js and export it: it moves the whole balance of from to the accounts in names with ledger.transfer, split as evenly as possible to the cent with splitMoney (larger shares to earlier names), and returns the amounts moved, in cents. Run it with node.',
    "Add historyReport(ledger, name) to the EXISTING r10_report.js and export it: one line per history entry of that account - the entry's type, a space and its formatted amount, e.g. 'deposit $10.00'. Run it with node.",
    "Add taxReport(ledger, names, ratePct) to the EXISTING r10_report.js and export it: one line per name, 'name: net $X tax $Y gross $Z', using taxMoney on the balance in cents and formatMoney for the three amounts. Run it with node.",
    'Add convertBalances(ledger, names, code, rates) to the EXISTING r10_report.js and export it: an array of each balance converted from USD to code with convertMoney, in cents. Run it with node.',
    "Add currencyReport(ledger, names, code, rates) to the EXISTING r10_report.js and export it: one line per name, 'name: ' followed by formatMoney(converted cents, code), e.g. 'alice: €9.09'. Run it with node.",
    'Add richest(ledger, n) to the EXISTING r10_report.js and export it: the names of the n accounts with the highest balances, highest first, ties in alphabetical order. The Ledger has no list of names, so read them from ledger.toCSV(). Run it with node.',
    'Write R_INDEX.md listing every r-file in the workspace (every r*.js, r*.py and r*.html file) and, for each .js and .py file, every function or class it exports or defines at the top level. Read the files first; do not invent anything.',
  ],
];

if (process.argv[1] && process.argv[1].endsWith('gen-goals-D.mjs')) {
  for (const [i, c] of CHAINS.entries()) if (c.length !== 10) throw new Error(`chain ${i + 1} has ${c.length} steps`);
  const goals = [];
  for (let step = 0; step < 10; step++) for (const c of CHAINS) goals.push(c[step]);
  writeFileSync(join(D, 'goals-D.json'), JSON.stringify(goals, null, 2) + '\n');
  console.log(`wrote ${goals.length} goals`);
}
