// mutate-E.mjs : proves checks-E.mjs catches real mistakes. Each mutant = refs/ + ONE planted bug (exact string
// replace or append; a missing or repeated anchor aborts that mutant). The goals that fail must be EXACTLY the
// expected ones (kind 'fail'), or show CT - implementation right, own test wrong (kind 'ct').
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const REFS = join(HERE, '..', 'refs');
const g = (chain, ...steps) => steps.map((s) => (s - 1) * 10 + chain);
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const M = [
  // q1 warehouse
  ['remove ignores reservations', 'q1_stock.js', "if (qty > this.available(sku)) throw new Error('not enough available stock of ' + sku);\n    this.st.set(sku, this.stock(sku) - qty); this._h(sku, { type: 'remove', qty });", "if (qty > this.stock(sku)) throw new Error('not enough stock');\n    this.st.set(sku, this.stock(sku) - qty); this._h(sku, { type: 'remove', qty });", g(1, 6), [1]],
  ['release counts reservations, not units', 'q1_stock.js', 'return mine.reduce((a, r) => a + r.qty, 0);', 'return mine.length;', g(1, 4), [1]],
  ['lowStock uses stock, not available', 'q1_stock.js', 'this.available(s) < threshold', 'this.stock(s) < threshold', g(1, 7), [1, 10]],
  ['fulfil not in history', 'q1_stock.js', "this._h(r.sku, { type: 'fulfil', qty: r.qty, orderId });", '', g(1, 9), [1, 10]],
  ['notes invent a method', 'Q1_NOTES.md', null, '\n- `transferStock(a, b)` - moves stock between skus.\n', g(1, 10), [1]],
  // q2 table
  ['where compares numbers as strings', 'q2_table.py', '        if na is not None and nb is not None:\n            a, b = na, nb', '        if False:\n            a, b = na, nb', g(2, 4), [2]],
  ['descending order not stable', 'q2_table.py', '    return sorted(rows, key=key, reverse=descending)', '    return list(reversed(sorted(rows, key=key))) if descending else sorted(rows, key=key)', g(2, 5), [2]],
  ['join does not rename clashing columns', 'q2_table.py', '                    row["right_" + k if k in l else k] = v', '                    row[k] = v', g(2, 8), [2]],
  ['CLI runs on import', 'q2_table.py', 'if __name__ == "__main__":', 'if True:', g(2, 9), [2]],
  // q3 calendar
  ['freeSlots ignores minLength', 'q3_calendar.js', 'return gaps.filter(([a, b]) => b - a >= minLength);', 'return gaps;', g(3, 6, 7), [3]],
  ["parseTime accepts '24:00'", 'q3_calendar.js', '+m[1] > 23', '+m[1] > 24', g(3, 8), [3]],
  ['a refused move still moves', 'q3_calendar.js', "    if (this.conflicts(newStart, end, id).length) throw new Error('overlaps');\n    x.start = newStart; x.end = end;", "    x.start = newStart; x.end = end;\n    if (this.conflicts(newStart, end, id).length) throw new Error('overlaps');", g(3, 5), [3]],
  // q4 template
  ['no HTML escaping', 'q4_template.js', 'out += n.raw ? s : escape(s);', 'out += s;', g(4, 3), [4, 10]],
  ['unknown filter ignored', 'q4_template.js', "if (!FILTERS[f]) throw new Error('unknown filter: ' + f);", 'if (!FILTERS[f]) continue;', g(4, 4), [4, 10]],
  ['inverted section blind to [] (breaks q10 too)', 'q4_template.js', 'if (n.inverted) { if (empty) out += renderNodes(n.children, stack, partials); }', 'if (n.inverted) { if (!v) out += renderNodes(n.children, stack, partials); }', [...g(4, 6), ...g(10, 6)], [4, 10]],
  ['missing partial ignored', 'q4_template.js', "if (!partials || !(n.name in partials)) throw new Error('missing partial: ' + n.name);", 'if (!partials || !(n.name in partials)) continue;', g(4, 9), [4, 10]],
  // q5 limiters
  ['refill not capped', 'q5_limits.py', '        self._tokens = min(self.capacity, self._tokens + (t - self._t) * self.rate)', '        self._tokens = self._tokens + (t - self._t) * self.rate', g(5, 1), [5]],
  ['sliding window never forgets', 'q5_limits.py', '        self._calls = [c for c in self._calls if c > t - self.window]', '        self._calls = list(self._calls)', g(5, 3), [5]],
  ['reset clears the stats', 'q5_limits.py', '        self._limiters.pop(key, None)', '        self._limiters.pop(key, None)\n        self._stats.pop(key, None)', g(5, 7), [5]],
  ['limited returns None instead of raising', 'q5_limits.py', '                raise RateLimited(fn.__name__)', '                return None', g(5, 9), [5]],
  // q6 json paths
  ['default ignored', 'q6_jpath.py', '        if default is not _MISSING:\n            return default', '        if False:\n            return default', g(6, 2), [6]],
  ['wildcard does not skip missing', 'q6_jpath.py', '            except (KeyError, IndexError, ValueError, TypeError):\n                continue', '            except (KeyError, IndexError, ValueError, TypeError):\n                raise', g(6, 5), [6]],
  ['diff misses removed keys', 'q6_jpath.py', '        elif k in fa:\n            out.append((k, fa[k], None))', '        elif False:\n            out.append((k, fa[k], None))', g(6, 8), [6]],
  ['merge changes its input', 'q6_jpath.py', '    out = copy.deepcopy(a)', '    out = a', g(6, 10), [6]],
  // q7 text buffer
  ['a new edit keeps redo', 'q7_buffer.js', 'this.undoS.shift();\n    this.redoS = [];', 'this.undoS.shift();', g(7, 2), [7]],
  ['findAll overlaps', 'q7_buffer.js', 'i = this.t.indexOf(str, i + str.length);', 'i = this.t.indexOf(str, i + 1);', g(7, 4), [7]],
  ['maxUndo ignored', 'q7_buffer.js', '    while (this.undoS.length > this.maxUndo) this.undoS.shift();\n', '', g(7, 8), [7]],
  ['empty text has one line', 'q7_buffer.js', "lines: this.t === '' ? 0 : this.lines().length", 'lines: this.lines().length', g(7, 10), [7]],
  // q8 units
  ['wrong pound', 'q8_units.py', '"lb": 16 * 28.349523125', '"lb": 453.0', g(8, 1, 7), [8]],
  ['no mixed numbers', 'q8_units.py', '        qty = sum(_number(p) for p in parts[:-1])', '        qty = _number(parts[-2])', g(8, 4), [8]],
  ['fractions only when exact', 'q8_units.py', '        if abs(frac - f) <= 0.01:', '        if abs(frac - f) <= 0.0001:', g(8, 6), [8]],
  ['CLI not rounded', 'q8_units.py', '    print(f"{convert(float(value), frm, to):.2f} {to}")', '    print(f"{convert(float(value), frm, to)} {to}")', g(8, 10), [8]],
  // q9 web shop
  ['web: discount never applied', 'q9_shop.js', "const total = () => (code === 'SAVE10' ? Math.round(subtotal() * 0.9) : subtotal());", 'const total = () => subtotal();', g(9, 5, 8, 9, 10), [9]],
  ["web: '1 items'", 'q9_shop.js', "n + (n === 1 ? ' item' : ' items')", "n + ' items'", g(9, 4), [9]],
  ['web: empty message never hidden', 'q9_shop.js', "$('q9-empty').style.display = cart.length ? 'none' : '';", "$('q9-empty').style.display = '';", g(9, 7), [9]],
  ['web: code not saved', 'q9_shop.js', "if (code) localStorage.setItem('q9-code', code); else localStorage.removeItem('q9-code');", '', g(9, 10), [9]],
  // q10 report + index
  ['shoutLine without the filter', 'q10_report.js', "'{{sku | upper}}: {{qty}}'", "'{{sku}}: {{qty}}'", g(10, 4), [10]],
  ['index misses a file', 'Q_INDEX.md', '- **q7_buffer.js** -', '- **the text buffer** -', g(10, 10), [10]],
  ['index invents a function', 'Q_INDEX.md', null, '\n- q3_calendar.js also has `snoozeMeeting(id)`.\n', g(10, 10), [10]],
  // own tests wrong
  ['JS own assert wrong -> CT', 'q7_buffer.js', null, "\nrequire('assert').strictEqual(1, 2);\n", g(7, ...ALL), [7], 'ct'],
  ['PY own assert wrong -> CT', 'q6_jpath.py', null, "\nassert 1 == 2, 'own test wrong'\n", g(6, ...ALL), [6], 'ct'],
];
let ok = 0;
for (const [name, file, from, to, expect, only, kind = 'fail'] of M) {
  const base = mkdtempSync(join(tmpdir(), 'mutE-')); const w = join(base, 'w'); cpSync(REFS, w, { recursive: true });
  const p = join(w, file);
  if (from === null) appendFileSync(p, to);
  else { const s = readFileSync(p, 'utf8'); if (s.split(from).length !== 2) { console.log(`ANCHOR ${s.split(from).length - 1}x  ${name}`); rmSync(base, { recursive: true, force: true }); continue; } writeFileSync(p, s.replace(from, () => to)); }
  const out = join(base, 'r.json');
  spawnSync(process.execPath, [join(HERE, 'checks-E.mjs'), w, '--out', out], { encoding: 'utf8', timeout: 600000, env: { ...process.env, ONLY: only.join(',') } });
  const res = JSON.parse(readFileSync(out, 'utf8')).results;
  const bad = res.filter((r) => !r.asIs).map((r) => r.goal).sort((a, b) => a - b);
  const ct = res.filter((r) => !r.asIs && r.impl).map((r) => r.goal).sort((a, b) => a - b);
  const want = [...expect].sort((a, b) => a - b);
  const pass = JSON.stringify(bad) === JSON.stringify(want) && (kind !== 'ct' || JSON.stringify(ct) === JSON.stringify(want));
  if (pass) ok++;
  console.log(`${pass ? 'ok  ' : 'MISS'} ${name.padEnd(46)} want ${kind} ${want.join(',').padEnd(30)} got ${bad.join(',')}${kind === 'ct' ? ' (CT ' + ct.length + ')' : ''}${pass ? '' : ' | ' + res.filter((r) => !r.asIs).map((r) => r.goal + ':' + r.why.slice(0, 50)).join(' ; ')}`);
  rmSync(base, { recursive: true, force: true });
}
console.log(`\nmutants caught exactly: ${ok}/${M.length}`);
