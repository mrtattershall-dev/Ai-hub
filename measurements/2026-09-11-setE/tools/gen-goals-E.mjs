// gen-goals-E.mjs : writes goals-E.json - 10 NEW projects x 10 steps, INTERLEAVED by round like set D
// (goal = (step-1)*10 + project), so every file is reopened after nine unrelated goals.
// q10 (integration) only uses q1/q4 features from the same round or earlier.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const D = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = 'Put the asserts under if __name__ == "__main__": and run it with python.';

export const CHAINS = [
  [ // q1 warehouse (JS)
    'Create q1_stock.js exporting a Warehouse class: addItem(sku, qty) adds stock and throws an Error unless qty is a positive integer; stock(sku) returns the quantity (0 for an unknown sku); skus() returns the known skus sorted. Include asserts that all pass, then run it with node.',
    'Add remove(sku, qty) to the EXISTING Warehouse in q1_stock.js: it throws an Error unless qty is a positive integer and there is enough stock, and on a throw the stock is unchanged. Keep everything else working. Run it with node.',
    'Add reserve(sku, qty, orderId) and available(sku) to the EXISTING Warehouse in q1_stock.js. Reserved units are held for that order and available(sku) is stock minus everything reserved. reserve throws an Error if there is not enough available, or if that order already holds a reservation for that sku. Run it with node.',
    'Add release(orderId) to the EXISTING Warehouse in q1_stock.js: it frees every reservation that order holds and returns how many units were freed (0 if it held none). Run it with node.',
    'Add fulfil(orderId) to the EXISTING Warehouse in q1_stock.js: it takes the reserved units out of stock and clears that order\'s reservations; it throws an Error for an order with no reservations. Run it with node.',
    'Change remove() in the EXISTING q1_stock.js so it can only take AVAILABLE units: removing more than is available throws an Error even when stock would cover it, and nothing changes. Run it with node.',
    'Add lowStock(threshold) to the EXISTING Warehouse in q1_stock.js returning, sorted, the skus whose available quantity is below threshold. Run it with node.',
    'Add toJSON() and a static fromJSON(data) to the EXISTING Warehouse in q1_stock.js. toJSON returns { stock: { sku: qty }, reservations: [{ orderId, sku, qty }] } with reservations sorted by orderId then sku; fromJSON rebuilds a Warehouse with the same state. Run it with node.',
    "Add history(sku) to the EXISTING Warehouse in q1_stock.js returning that sku's events in order as { type, qty } objects (plus orderId for reservation events), type one of 'add', 'remove', 'reserve', 'release', 'fulfil'. Failed operations must not appear. Run it with node.",
    'Write Q1_NOTES.md listing every public method of the Warehouse class in q1_stock.js with its arguments and when it throws. Read the file first; do not invent anything.',
  ],
  [ // q2 table toolkit (Python)
    'Create q2_table.py with parse_csv(text) returning a list of dicts that uses the first line as the headers. Values stay strings, empty text gives [], and a field in double quotes may contain commas ("a, b") and doubled quotes (""). ' + MAIN,
    'Add to_csv(rows, headers=None) to the EXISTING q2_table.py returning CSV text: the headers default to the keys of the first row, in order; a field containing a comma, a quote or a newline is quoted, with quotes doubled; lines are joined with "\\n". parse_csv(to_csv(rows)) must equal rows. Run it with python.',
    'Add select(rows, columns) to the EXISTING q2_table.py returning new rows with only those columns, in that order; an unknown column raises KeyError. Run it with python.',
    "Add where(rows, column, op, value) to the EXISTING q2_table.py with op one of '=', '!=', '<', '>', '<=', '>='. Compare as numbers when both sides parse as numbers, otherwise as strings. An unknown op raises ValueError. Run it with python.",
    'Add order_by(rows, column, descending=False) to the EXISTING q2_table.py: numeric order when every value in the column parses as a number, otherwise string order; rows with equal values keep their original order. Run it with python.',
    'Add group_count(rows, column) to the EXISTING q2_table.py returning a dict of each value to how many rows have it. Run it with python.',
    "Add aggregate(rows, group_col, value_col, fn) to the EXISTING q2_table.py, fn one of 'sum', 'avg', 'min', 'max', returning a dict of group -> number computed on the numeric values of value_col ('avg' rounded to 2 decimals). An unknown fn raises ValueError. Run it with python.",
    "Add join(left, right, on) to the EXISTING q2_table.py: an inner join on column on, left rows in order and, for each, matching right rows in order. Right columns other than on are added; one whose name is already in the left row is added as 'right_' + name. Run it with python.",
    'Make the EXISTING q2_table.py a command-line tool: python q2_table.py FILE [--where COLUMN=VALUE] [--select A,B] prints the resulting table as CSV (using where with "=" and select). Importing the module must not print anything. Run it with python.',
    'Add pivot(rows, index, column, value) to the EXISTING q2_table.py returning a dict of each index value to a dict of column value -> the value field (as in the row, a string); a repeated (index, column) pair raises ValueError. Run it with python.',
  ],
  [ // q3 calendar (JS)
    'Create q3_calendar.js exporting a Calendar class: add(id, start, end) where start and end are minutes from midnight (integers, 0 <= start < end <= 1440; it throws an Error otherwise, or for a duplicate id); get(id) returns { id, start, end } or null; list() returns every meeting sorted by start, then id. Include asserts that all pass, then run it with node.',
    'Add conflicts(start, end) to the EXISTING Calendar in q3_calendar.js returning the ids of meetings that overlap the range, sorted by start. Meetings that only touch (one ends exactly when the other starts) do not overlap. Run it with node.',
    'Make add() in the EXISTING q3_calendar.js throw an Error when the new meeting would overlap an existing one, leaving the calendar unchanged. Run it with node.',
    'Add remove(id) to the EXISTING Calendar in q3_calendar.js returning true if it removed a meeting and false otherwise. Run it with node.',
    'Add move(id, newStart) to the EXISTING Calendar in q3_calendar.js: it keeps the duration, throws an Error for an unknown id, a range outside the day, or an overlap with another meeting, and on a throw changes nothing. Run it with node.',
    'Add freeSlots(dayStart, dayEnd, minLength) to the EXISTING Calendar in q3_calendar.js returning the gaps between meetings inside [dayStart, dayEnd] as [start, end] pairs, sorted, keeping only gaps at least minLength long. Run it with node.',
    'Add firstFree(duration, after = 0) to the EXISTING Calendar in q3_calendar.js returning the earliest start >= after at which a meeting of that duration fits before midnight (1440), or null. Run it with node.',
    "Add and export two functions in the EXISTING q3_calendar.js: formatTime(minutes) returning 'HH:MM' (e.g. 545 -> '09:05') and parseTime(text) turning 'HH:MM' back into minutes; parseTime throws an Error for anything else, such as '24:00' or '9:5'. Run it with node.",
    "Add toText() to the EXISTING Calendar in q3_calendar.js returning one line per meeting in list() order, written as 'HH:MM-HH:MM id', lines joined with '\\n' and no trailing newline. Run it with node.",
    'Add a static fromText(text) to the EXISTING Calendar in q3_calendar.js that rebuilds a Calendar from toText() output; it throws an Error for a malformed line or an overlap. Calendar.fromText(c.toText()).toText() must equal c.toText(). Run it with node.',
  ],
  [ // q4 template engine (JS)
    'Create q4_template.js exporting render(template, data) that replaces every {{name}} with data[name] (spaces inside the braces are allowed: {{ name }}); a missing name renders as an empty string. Include asserts that all pass, then run it with node.',
    'Make render() in the EXISTING q4_template.js accept dotted paths like {{user.name}}; a path with a missing part renders as an empty string. Keep everything else working. Run it with node.',
    'Make render() in the EXISTING q4_template.js HTML-escape inserted values (& < > " and \' become &amp; &lt; &gt; &quot; &#39;), while {{{name}}} inserts the value raw. Run it with node.',
    "Add filters to the EXISTING q4_template.js: {{name | upper}}, {{name | lower}} and {{name | trim}}, applied left to right when chained ({{ name | trim | upper }}). An unknown filter throws an Error that names it. Run it with node.",
    'Add sections to the EXISTING q4_template.js: {{#items}}...{{/items}} repeats the block for every element of an array (inside it {{.}} is the element, and an object element\'s fields are available by name); a false, null or empty value renders nothing; any other true value renders the block once. Run it with node.',
    'Add inverted sections to the EXISTING q4_template.js: {{^items}}...{{/items}} renders its block only when the value is false, missing or an empty array. Run it with node.',
    'Make render() in the EXISTING q4_template.js throw an Error that names the tag for a section that is never closed or a closing tag that does not match the open section. Run it with node.',
    'Add comments to the EXISTING q4_template.js: {{! anything }} renders nothing. Run it with node.',
    'Add partials to the EXISTING q4_template.js: render(template, data, partials) where {{> name}} inserts partials[name], rendered with the current data. A missing partial throws an Error that names it. Run it with node.',
    'Add compile(template) to the EXISTING q4_template.js and export it: it parses the template once and returns a function (data, partials) that renders it. render() must keep working and give the same results. Run it with node.',
  ],
  [ // q5 rate limiters (Python)
    'Create q5_limits.py with a TokenBucket class: TokenBucket(capacity, refill_per_sec, now=time.monotonic) starts full and refills continuously up to capacity; allow(cost=1) returns True and spends the tokens if there are enough, otherwise returns False and spends nothing. ' + MAIN,
    'Add tokens() to the EXISTING TokenBucket in q5_limits.py returning the current number of tokens (a float, after refilling). Run it with python.',
    'Add a SlidingWindow class to the EXISTING q5_limits.py: SlidingWindow(limit, window_sec, now=time.monotonic) with allow() returning True for at most limit calls in any window_sec seconds (a call made at time t counts until t + window_sec) and False otherwise. Run it with python.',
    'Add wait_time(cost=1) to the EXISTING TokenBucket in q5_limits.py returning how many seconds until allow(cost) would succeed (0.0 if it would succeed now); a cost larger than the capacity raises ValueError. Run it with python.',
    'Add a KeyedLimiter class to the EXISTING q5_limits.py: KeyedLimiter(factory) keeps a separate limiter per key, created by calling factory() the first time a key is seen; allow(key) uses that key\'s limiter; keys() returns the keys sorted. Run it with python.',
    'Add reset(key) to the EXISTING KeyedLimiter in q5_limits.py: it forgets that key\'s limiter, so the next allow(key) starts a fresh one; an unknown key is not an error. Run it with python.',
    'Add stats() to the EXISTING KeyedLimiter in q5_limits.py returning {key: {"allowed": n, "denied": m}} counting every allow(key) call; reset(key) does not clear the counts. Run it with python.',
    'Make the EXISTING q5_limits.py validate its input: TokenBucket raises ValueError unless capacity and refill_per_sec are positive numbers, SlidingWindow raises ValueError unless limit is a positive integer and window_sec a positive number, and allow(cost) raises ValueError for a cost that is not positive. Run it with python.',
    'Add a RateLimited exception class and a decorator limited(limiter) to the EXISTING q5_limits.py: the wrapped function raises RateLimited instead of running whenever limiter.allow() returns False, and otherwise returns the function\'s result. Run it with python.',
    'Make allow() on the EXISTING SlidingWindow in q5_limits.py accept a cost (allow(cost=1)) that counts as cost calls; a request that would go over the limit is refused and counts nothing. Run it with python.',
  ],
  [ // q6 JSON paths (Python)
    "Create q6_jpath.py with get(data, path) reading paths like 'a.b.0.c' through dicts (keys) and lists (integer indexes); a missing key or index raises KeyError whose message contains the path. " + MAIN,
    'Give get() in the EXISTING q6_jpath.py an optional default: get(data, path, default) returns default instead of raising when anything is missing. Calls without a default must keep raising KeyError. Run it with python.',
    'Add set_path(data, path, value) to the EXISTING q6_jpath.py: it sets the value in place, creating missing dicts along the way; a list index that exists is replaced, and one past the end raises IndexError. Run it with python.',
    'Add delete(data, path) to the EXISTING q6_jpath.py that removes the value at path and returns it; a missing path raises KeyError. Run it with python.',
    "Make get() in the EXISTING q6_jpath.py understand a * segment ('users.*.name'): it stands for every element of a list or every value of a dict, and the result is then a list of the matches, in order, leaving out elements where the rest of the path is missing. Run it with python.",
    'Add find(data, predicate) to the EXISTING q6_jpath.py returning the sorted list of dotted paths of every leaf value (anything that is not a dict or list) for which predicate(value) is true. Run it with python.',
    'Add flatten(data) and unflatten(flat) to the EXISTING q6_jpath.py: flatten returns a dict of dotted path -> leaf value; unflatten rebuilds the nested structure, creating lists where every key at a level is a number 0..n-1. unflatten(flatten(d)) == d for dicts of dicts, lists and leaves. Run it with python.',
    'Add diff(a, b) to the EXISTING q6_jpath.py returning a sorted list of (path, old, new) tuples for every leaf that differs: changed (both values), added (old None) or removed (new None). Run it with python.',
    "Make get(), set_path() and delete() in the EXISTING q6_jpath.py also accept the path as a list of segments (['a', 'b.c', 0]), so keys that contain dots can be reached. Dotted strings keep working. Run it with python.",
    'Add merge(a, b) to the EXISTING q6_jpath.py returning a new deep merge of two dicts: nested dicts merge, anything else from b wins (lists are replaced, not merged), and neither input is changed. Run it with python.',
  ],
  [ // q7 text buffer (JS)
    "Create q7_buffer.js exporting a TextBuffer class: new TextBuffer(text = ''), text(), insert(pos, str) and remove(pos, length); a position outside the text throws an Error and changes nothing. Include asserts that all pass, then run it with node.",
    'Add undo() and redo() to the EXISTING TextBuffer in q7_buffer.js: undo reverses the last edit and redo applies it again; a new edit clears what could be redone; both return true when they did something and false when there was nothing to do. Run it with node.',
    'Add lines(), lineCol(pos) and posOf(line, col) to the EXISTING TextBuffer in q7_buffer.js: lines() splits the text on \\n, lineCol returns { line, col } counted from 0, and posOf is its inverse; positions outside the text throw an Error. Run it with node.',
    'Add find(str, from = 0) and findAll(str) to the EXISTING TextBuffer in q7_buffer.js: find returns the index of the first match at or after from, or -1; findAll returns the indexes of every non-overlapping match. Run it with node.',
    'Add replaceAll(search, replacement) to the EXISTING TextBuffer in q7_buffer.js returning how many replacements it made; one undo() must reverse all of them. Run it with node.',
    'Add beginGroup() and endGroup() to the EXISTING TextBuffer in q7_buffer.js: every edit between them is undone (and redone) as one step. Run it with node.',
    "Add wordAt(pos) to the EXISTING TextBuffer in q7_buffer.js returning the word (letters, digits and _) that contains pos or ends right before it, or '' when there is none. Run it with node.",
    'Give the EXISTING TextBuffer in q7_buffer.js an options argument: new TextBuffer(text, { maxUndo }) keeps at most maxUndo undo steps, dropping the oldest. Existing calls must keep working. Run it with node.',
    'Add toJSON() and a static fromJSON(data) to the EXISTING TextBuffer in q7_buffer.js that keep the text and the undo and redo history, so undo() after fromJSON(b.toJSON()) behaves like undo() on b. Run it with node.',
    'Add stats() to the EXISTING TextBuffer in q7_buffer.js returning { chars, words, lines }, where words are runs of letters, digits and _, and an empty text has 0 lines. Run it with node.',
  ],
  [ // q8 units and recipes (Python)
    'Create q8_units.py with convert(value, from_unit, to_unit) for the mass units g, kg, oz and lb (1 oz = 28.349523125 g, 1 lb = 16 oz), raising ValueError for an unknown unit. ' + MAIN,
    'Add the volume units ml, l, tsp (4.92892159375 ml), tbsp (3 tsp) and cup (16 tbsp) to convert() in the EXISTING q8_units.py; converting between a mass and a volume raises ValueError. Run it with python.',
    'Add the temperatures C, F and K to convert() in the EXISTING q8_units.py (they are offsets, not factors); converting a temperature to any other kind raises ValueError. Run it with python.',
    "Add parse_quantity(text) to the EXISTING q8_units.py turning strings like '2 kg', '0.5 l', '3/4 cup' or '1 1/2 cups' into (number, unit), accepting plural and long names (cups, tablespoons, teaspoons, grams, kilograms, ounces, pounds, liters, litres, milliliters) and raising ValueError for anything else. Run it with python.",
    'Add scale_recipe(recipe, factor) to the EXISTING q8_units.py: recipe is a list of (qty, unit, name) tuples; it returns a new list with every qty multiplied by factor and leaves the input unchanged. Run it with python.',
    "Add format_quantity(qty, unit) to the EXISTING q8_units.py: a quantity within 0.01 of a whole number plus a half, third or quarter is written as a fraction ('1 1/2 cup', '3/4 tsp', '2 cup'); anything else with at most 2 decimals and no trailing zeros ('1.37 kg'). Run it with python.",
    'Add to_metric(recipe) to the EXISTING q8_units.py returning a new recipe with masses converted to g and volumes to ml, rounded to 1 decimal; items in other units (temperatures included) are unchanged. Run it with python.',
    'Add shopping_list(recipes) to the EXISTING q8_units.py: it combines several recipes, adds up items with the same name whose units can be converted into the unit of that name\'s first occurrence (anything else stays a separate line), and returns (qty, unit, name) tuples sorted by name. Run it with python.',
    'Give convert() in the EXISTING q8_units.py an optional density (grams per ml): with a density, conversion between mass and volume is allowed; without one it still raises ValueError. Run it with python.',
    "Make the EXISTING q8_units.py a command-line tool: python q8_units.py VALUE FROM TO prints the converted value rounded to 2 decimals and the unit ('473.18 ml'). Importing the module must not print anything. Run it with python.",
  ],
  [ // q9 shopping cart page (HTML + JS)
    'Create q9_shop.html listing three products - Apple 50 cents, Bread 225 cents, Milk 199 cents - each with a button that has the class "q9-add" and the attributes data-name and data-price (the price in cents), plus a cart list <ul id="q9-cart">. Clicking a button adds that product to the cart as an <li> reading "Name xN" (e.g. "Apple x2"). Put the logic in q9_shop.js, loaded at the end of the body.',
    'Add an element with id "q9-total" to the EXISTING q9 shop (q9_shop.html, q9_shop.js) that always shows the cart total as "$X.XX" ("$0.00" when empty).',
    'Give every cart <li> in the EXISTING q9 shop (q9_shop.html, q9_shop.js) a "+" button with the class "q9-inc" and a "-" button with the class "q9-dec" that change that product\'s quantity by one; at 0 the item leaves the cart. The total keeps up.',
    'Add an element with id "q9-count" to the EXISTING q9 shop (q9_shop.html, q9_shop.js) showing how many units are in the cart, as "3 items" ("1 item" for one, "0 items" for none).',
    'Add a discount code to the EXISTING q9 shop (q9_shop.html, q9_shop.js): an input with id "q9-code" and a button with id "q9-apply". The code SAVE10 takes 10% off the total (rounded to the nearest cent); any other code shows "Invalid code" in an element with id "q9-msg" and changes nothing.',
    'Make the EXISTING q9 shop (q9_shop.html, q9_shop.js) save the cart (products and quantities) in localStorage under the key "q9-cart", so reloading the page shows the same cart and total.',
    'Add a button with id "q9-clear" to the EXISTING q9 shop (q9_shop.html, q9_shop.js) that empties the cart, and an element with id "q9-empty" that shows "Cart is empty" whenever the cart has no items and is hidden otherwise.',
    'Add an element with id "q9-delivery" to the EXISTING q9 shop (q9_shop.html, q9_shop.js) that shows "Free delivery" when the total (after any discount) is $10.00 or more, and otherwise "Add $X.XX for free delivery".',
    'In the EXISTING q9 shop (q9_shop.html, q9_shop.js), pressing Enter in the "q9-code" input applies the code just like the button does.',
    'In the EXISTING q9 shop (q9_shop.html, q9_shop.js), the discount must survive a reload too: save the applied code in localStorage under the key "q9-code" and apply it again when the page loads.',
  ],
  [ // q10 integration report (JS) - uses q1_stock.js and q4_template.js
    "Create q10_report.js that uses the EXISTING q1_stock.js and q4_template.js (require them; read them first so you use their real exports) and exports skuLine(warehouse, sku): render('{{sku}}: {{qty}}', ...) with that sku's stock, e.g. 'apple: 5'. Include asserts that all pass, then run it with node.",
    "Add itemLine(warehouse, sku) to the EXISTING q10_report.js and export it: render('{{item.sku}} has {{item.qty}}', ...) with an item object { sku, qty } built from the warehouse, e.g. 'apple has 5'. Run it with node.",
    "Add reservedLine(warehouse, sku) to the EXISTING q10_report.js and export it: render('{{sku}}: {{available}} of {{qty}} free', ...) using available(sku) and stock(sku). Run it with node.",
    "Add shoutLine(warehouse, sku) to the EXISTING q10_report.js and export it: render('{{sku | upper}}: {{qty}}', ...), e.g. 'APPLE: 5'. Run it with node.",
    "Add stockTable(warehouse) to the EXISTING q10_report.js and export it: render('{{#rows}}{{sku}}={{qty}};{{/rows}}', ...) with one row per sku in skus() order, e.g. 'apple=5;pear=2;'. Run it with node.",
    "Add emptyNote(warehouse) to the EXISTING q10_report.js and export it: render('{{^rows}}no stock{{/rows}}{{#rows}}{{sku}} {{/rows}}', ...) with the rows of stockTable, so an empty warehouse gives 'no stock'. Run it with node.",
    "Add lowReport(warehouse, threshold) to the EXISTING q10_report.js and export it: render('low: {{#low}}{{.}} {{/low}}', ...) with low = warehouse.lowStock(threshold), e.g. 'low: pear '. Run it with node.",
    "Add jsonReport(warehouse) to the EXISTING q10_report.js and export it: render('{{{json}}}', ...) with json = JSON.stringify(warehouse.toJSON()), so quotes are not escaped. Run it with node.",
    "Add historyReport(warehouse, sku) to the EXISTING q10_report.js and export it: it renders the template 'history: {{> events}}' with the partial events = '{{#events}}{{type}} {{qty}}, {{/events}}' and events = warehouse.history(sku). Run it with node.",
    'Write Q_INDEX.md listing every q-file in the workspace (every q*.js, q*.py and q*.html file) and, for each .js and .py file, every function or class it exports or defines at the top level. Read the files first; do not invent anything.',
  ],
];

if (process.argv[1] && process.argv[1].endsWith('gen-goals-E.mjs')) {
  for (const [i, c] of CHAINS.entries()) if (c.length !== 10) throw new Error(`chain ${i + 1} has ${c.length} steps`);
  const goals = [];
  for (let step = 0; step < 10; step++) for (const c of CHAINS) goals.push(c[step]);
  writeFileSync(join(D, 'goals-E.json'), JSON.stringify(goals, null, 2) + '\n');
  console.log(`wrote ${goals.length} goals`);
}
