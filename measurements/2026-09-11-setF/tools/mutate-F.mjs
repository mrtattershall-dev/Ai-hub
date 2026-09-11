// mutate-F.mjs : proves checks-F.mjs catches real mistakes. Each mutant = refs/ + ONE planted bug (exact string
// replace or append; a missing or repeated anchor aborts that mutant). The goals that fail must be EXACTLY the
// expected ones (kind 'fail'), or show CT - implementation right, own test wrong (kind 'ct').
//   node mutate-F.mjs [substring]   run only the mutants whose name contains substring
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
  // s1 library (s10 is built on it, so s10 runs too)
  ['checkout lets a member take the same book twice', 's1_library.js', "    if (this._has(isbn, member)) throw new Error(member + ' already has ' + isbn);\n    if (this.available(isbn) <= 0)", '    if (this.available(isbn) <= 0)', g(1, 2), [1, 10]],
  ['no hold hand-over on return', 's1_library.js', '    if (q && q.length) {', '    if (false) {', g(1, 4, 5, 8), [1, 10]],
  ['fine is 20 cents a day (s10 too)', 's1_library.js', '* 25;', '* 20;', [...g(1, 6, 7, 8), ...g(10, 6, 7)], [1, 10]],
  ['the due day counts as overdue', 's1_library.js', 'today > l.day + 14', 'today >= l.day + 14', g(1, 5), [1, 10]],
  ['loan limit is 4', 's1_library.js', ">= 3) throw new Error('loan limit", ">= 4) throw new Error('loan limit", g(1, 7), [1, 10]],
  ['toJSON loans unsorted', 's1_library.js', 'day: l.day })).sort((a, b) => cmp(a.isbn, b.isbn) || cmp(a.member, b.member));', 'day: l.day }));', g(1, 8), [1, 10]],
  ['search is case-sensitive (s10 too)', 's1_library.js', 'b.title.toLowerCase().includes(t)', 'b.title.includes(text)', [...g(1, 9), ...g(10, 9)], [1, 10]],
  ['notes invent a method', 'S1_NOTES.md', null, '\n- `renewLoan(isbn, member)` - extends a loan.\n', g(1, 10), [1]],
  ['notes miss dueDay', 'S1_NOTES.md', '- `dueDay(isbn, member)` - the day the loan is due. Throws if the member does not have the book.\n', '', g(1, 10), [1]],
  // s2 logs
  ['a - size is -1', 's2_logs.py', '"bytes": 0 if size == "-" else int(size)', '"bytes": -1 if size == "-" else int(size)', g(2, 1, 6), [2]],
  ['top_paths keeps the query string', 's2_logs.py', 'p = e["path"].split("?", 1)[0]', 'p = e["path"]', g(2, 4, 9), [2]],
  ['percentile one rank too high', 's2_logs.py', 'return vals[max(1, math.ceil(p * len(vals) / 100)) - 1]', 'return vals[min(len(vals) - 1, math.ceil(p * len(vals) / 100))]', g(2, 5, 10), [2]],
  ['a gap of exactly gap_minutes splits', 's2_logs.py', '> gap_minutes * 60:', '>= gap_minutes * 60:', g(2, 8), [2]],
  ['CLI errors count 4xx too', 's2_logs.py', 'e["status"] >= 500))', 'e["status"] >= 400))', g(2, 9), [2]],
  ['the seconds field is required', 's2_logs.py', '(?: (\\d+(?:\\.\\d+)?))?$', '(?: (\\d+(?:\\.\\d+)?))$', g(2, 10), [2]],
  // s3 matrix
  ['scalar mul ignores the number', 's3_matrix.js', "if (typeof x === 'number') return new Matrix(this.a.map((row) => row.map((v) => v * x)));", "if (typeof x === 'number') return new Matrix(this.toArray());", g(3, 3), [3]],
  ['transpose returns a copy', 's3_matrix.js', 'transpose() { return new Matrix(this.a[0].map((_, j) => this.a.map((row) => row[j]))); }', 'transpose() { return new Matrix(this.toArray()); }', g(3, 4), [3]],
  ['determinant ignores row swaps', 's3_matrix.js', 'det = -det; }', '}', g(3, 6), [3]],
  ['solve ignores the length of b', 's3_matrix.js', 'if (!Array.isArray(b) || b.length !== this.a.length) throw', 'if (!Array.isArray(b)) throw', g(3, 8), [3]],
  // The naive formatter: (-0.0004).toFixed(3) is '-0.000', which strips to '-0'. (Removing only the guard is a no-op:
  // the reference rounds first, and (-0).toFixed(3) is already '0.000'.)
  ["toString writes '-0'", 's3_matrix.js', "(Math.round(v * 1000) / 1000).toFixed(3).replace(/\\.?0+$/, '');\n  return s === '-0' || s === '' ? '0' : s;", "v.toFixed(3).replace(/\\.?0+$/, '');\n  return s;", g(3, 9), [3]],
  // s4 markdown
  ['> not escaped', 's4_markdown.py', '.replace("<", "&lt;").replace(">", "&gt;")', '.replace("<", "&lt;")', g(4, 1), [4]],
  ['no <em>', 's4_markdown.py', '        s = re.sub(r"\\*(.+?)\\*", r"<em>\\1</em>", s)\n', '', g(4, 3, 4), [4]],
  ['ordered lists stop at 9', 's4_markdown.py', 'OL_ITEM = re.compile(r"^\\d+\\. ")', 'OL_ITEM = re.compile(r"^\\d\\. ")', g(4, 7), [4]],
  ['code blocks not escaped', 's4_markdown.py', '_esc("\\n".join(body))', '("\\n".join(body))', g(4, 8), [4]],
  ['blockquote not converted', 's4_markdown.py', '"<blockquote>" + to_html("\\n".join(inner)) + "</blockquote>"', '"<blockquote>" + _inline(" ".join(inner)) + "</blockquote>"', g(4, 9), [4]],
  ['duplicate slugs not numbered', 's4_markdown.py', 'base if seen[base] == 1 else "%s-%d" % (base, seen[base])))', 'base))', g(4, 10), [4]],
  // s5 expressions
  ['division by zero allowed', 's5_expr.js', "case '/': if (r === 0) throw new Error('division by zero'); return l / r;", "case '/': return l / r;", g(5, 1, 9), [5]],
  ['^ not right-associative', 's5_expr.js', 'l: base, r: unary() }; }', 'l: base, r: primary() }; }', g(5, 3, 8), [5]],
  ['an unknown variable is 0', 's5_expr.js', 'throw new Error(`unknown variable ${n.n}`);', 'return 0;', g(5, 4, 9), [5]],
  ['error positions off by one', 's5_expr.js', "`unexpected '${t.value}' at ${t.pos}`", "`unexpected '${t.value}' at ${t.pos + 1}`", g(5, 6), [5]],
  ["unary minus is '-' in RPN", 's5_expr.js', "case 'neg': return [...rpn(n.x), 'neg'];", "case 'neg': return [...rpn(n.x), '-'];", g(5, 8), [5]],
  ['< gives a boolean', 's5_expr.js', "case '<': return l < r ? 1 : 0;", "case '<': return l < r;", g(5, 10), [5]],
  // s6 graph
  ['bfs in insertion order', 's6_graph.py', '            for m in sorted(self._adj[n]):\n                if m not in seen:', '            for m in self._adj[n]:\n                if m not in seen:', g(6, 2), [6]],
  ['Dijkstra never relaxes', 's6_graph.py', 'if m not in dist or nd < dist[m]:', 'if m not in dist:', g(6, 3), [6]],
  ['topo_order not smallest first', 's6_graph.py', 'n = heapq.heappop(ready)', 'n = ready.pop()', g(6, 5), [6]],
  ['remove_node leaves edges into it', 's6_graph.py', '        for edges in self._adj.values():\n            edges.pop(n, None)\n', '', g(6, 6), [6]],
  ['reachable always includes the start', 's6_graph.py', 'seen, stack = set(), list(self._adj[a])', 'seen, stack = {a}, list(self._adj[a])', g(6, 7), [6]],
  ['to_dot leaves out isolated nodes', 's6_graph.py', '            if n not in touched:\n', '            if False:\n', g(6, 9), [6]],
  ['from_text counts lines from 0', 's6_graph.py', 'for i, line in enumerate(text.splitlines(), 1):', 'for i, line in enumerate(text.splitlines()):', g(6, 10), [6]],
  // s7 cache (s10 uses it)
  ['get is not a use', 's7_cache.js', '    this.st.hits++;\n    this._touch(key, e);\n    return e.value;', '    this.st.hits++;\n    return e.value;', g(7, 1, 3, 8, 9), [7, 10]],
  ['peek is a use', 's7_cache.js', 'peek(key) { const e = this._live(key); return e ? e.value : undefined; }', 'peek(key) { return this.get(key); }', g(7, 4), [7, 10]],
  ['size counts expired entries', 's7_cache.js', 'size() { this._purge(); return this.map.size; }', 'size() { return this.map.size; }', g(7, 5), [7, 10]],
  ['evictions not counted', 's7_cache.js', '      this.st.evictions++;\n', '', g(7, 6), [7, 10]],
  ["delete reports 'lru'", 's7_cache.js', "    this.map.delete(key);\n    this._ev(key, e.value, 'deleted');", "    this.map.delete(key);\n    this._ev(key, e.value, 'lru');", g(7, 7), [7, 10]],
  ['toJSON most recent first', 's7_cache.js', 'entries: [...this.map].map(([k, e]) => [k, e.value])', 'entries: [...this.map].reverse().map(([k, e]) => [k, e.value])', g(7, 9), [7, 10]],
  ['a failed factory stores something', 's7_cache.js', '    const v = factory(key);\n    this.set(key, v);', '    let v;\n    try { v = factory(key); } catch (err) { this.set(key, undefined); throw err; }\n    this.set(key, v);', g(7, 10), [7, 10]],
  // s8 gradebook
  ['points above max accepted', 's8_grades.py', 'not 0 <= points <= self._assign[assignment]["max"]', 'not 0 <= points', g(8, 1), [8]],
  ['percent not rounded', 's8_grades.py', 'return round(acc / total_w, 2)', 'return acc / total_w', g(8, 2), [8]],
  ['weights not rescaled', 's8_grades.py', '        return round(acc / total_w, 2)', '        total_w += sum(w for c, w in self._weights.items() if c not in cats)\n        return round(acc / total_w, 2)', g(8, 4), [8]],
  ['drop_lowest drops the highest', 's8_grades.py', 'items = sorted(items, key=lambda pm: pm[0] / pm[1])[n:]', 'items = sorted(items, key=lambda pm: pm[0] / pm[1])[:-n]', g(8, 5), [8]],
  ['curve not capped', 's8_grades.py', 'new = min(mx, p + points)', 'new = p + points', g(8, 7), [8]],
  ['to_csv percent without 2 decimals', 's8_grades.py', '"" if p is None else "%.2f" % p', '"" if p is None else str(p)', g(8, 8, 10), [8]],
  ['median of an even count', 's8_grades.py', '"median": round(statistics.median(pts), 2)', '"median": sorted(pts)[len(pts) // 2]', g(8, 9), [8]],
  // s9 board page
  ['web: blank card added', 's9_board.js', "  const text = $('s9-new').value.trim();\n  if (!text) return;\n", "  const text = $('s9-new').value.trim();\n", g(9, 1), [9]],
  ['web: moving wraps around', 's9_board.js', 'const to = COLS[COLS.indexOf(c) + d];', 'const to = COLS[(COLS.indexOf(c) + d + 3) % 3];', g(9, 2), [9]],
  ['web: nothing saved', 's9_board.js', "const save = () => localStorage.setItem('s9-board', JSON.stringify(board));", 'const save = () => {};', g(9, 5, 10), [9]],
  ['web: Doing holds 4', 's9_board.js', 'board.doing.length >= 3', 'board.doing.length >= 4', g(9, 6), [9]],
  ['web: Enter ignored', 's9_board.js', "$('s9-new').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });", '', g(9, 7), [9]],
  ['web: filter is case-sensitive', 's9_board.js', "if (f && !text.toLowerCase().includes(f)) li.style.display = 'none';", "if (f && !text.includes(f)) li.style.display = 'none';", g(9, 8), [9]],
  ['web: duplicates allowed', 's9_board.js', "  if (COLS.some((c) => board[c].some((t) => t.trim().toLowerCase() === text.toLowerCase()))) { msg('Card already exists'); return; }\n", '', g(9, 9), [9]],
  // s10 desk + index
  ['availability upside down', 's10_desk.js', 'function availability(library, isbn) { return `${library.available(isbn)}/${library.copies(isbn)}`; }', 'function availability(library, isbn) { return `${library.copies(isbn)}/${library.available(isbn)}`; }', g(10, 2), [10]],
  ['makeLookup never answers from the cache', 's10_desk.js', '    if (cache.has(isbn)) return cache.get(isbn);\n', '', g(10, 4), [10]],
  ['fineReport sorted by name', 's10_desk.js', '.sort((a, b) => library.fines(b) - library.fines(a) || (a < b ? -1 : a > b ? 1 : 0))', '.sort()', g(10, 6), [10]],
  ['restore of a missing key throws', 's10_desk.js', '  if (!cache.has(key)) return null;\n', '', g(10, 8), [10]],
  ['index misses a file', 'S_INDEX.md', '- **s7_cache.js** -', '- **the cache** -', g(10, 10), [10]],
  ['index invents a function', 'S_INDEX.md', null, '\n- s3_matrix.js also has `rank()`.\n', g(10, 10), [10]],
  ['index misses a name', 'S_INDEX.md', '`searchLines`', 'search lines', g(10, 10), [10]],
  // own tests wrong
  ['JS own assert wrong -> CT', 's3_matrix.js', null, "\nrequire('assert').strictEqual(1, 2);\n", g(3, ...ALL), [3], 'ct'],
  ['PY own assert wrong -> CT', 's8_grades.py', null, "\nassert 1 == 2, 'own test wrong'\n", g(8, ...ALL), [8], 'ct'],
];
const pickName = process.argv[2];
let ok = 0, ran = 0;
for (const [name, file, from, to, expect, only, kind = 'fail'] of M) {
  if (pickName && !name.includes(pickName)) continue;
  ran++;
  const base = mkdtempSync(join(tmpdir(), 'mutF-')); const w = join(base, 'w'); cpSync(REFS, w, { recursive: true });
  const p = join(w, file);
  if (from === null) appendFileSync(p, to);
  else { const s = readFileSync(p, 'utf8'); if (s.split(from).length !== 2) { console.log(`ANCHOR ${s.split(from).length - 1}x  ${name}`); rmSync(base, { recursive: true, force: true }); continue; } writeFileSync(p, s.replace(from, () => to)); }
  const out = join(base, 'r.json');
  spawnSync(process.execPath, [join(HERE, 'checks-F.mjs'), w, '--out', out], { encoding: 'utf8', timeout: 600000, env: { ...process.env, ONLY: only.join(',') } });
  let res = [];
  try { res = JSON.parse(readFileSync(out, 'utf8')).results; } catch { console.log(`ERROR ${name}: no results`); rmSync(base, { recursive: true, force: true }); continue; }
  const bad = res.filter((r) => !r.asIs).map((r) => r.goal).sort((a, b) => a - b);
  const ct = res.filter((r) => !r.asIs && r.impl).map((r) => r.goal).sort((a, b) => a - b);
  const want = [...expect].sort((a, b) => a - b);
  const pass = JSON.stringify(bad) === JSON.stringify(want) && (kind !== 'ct' || JSON.stringify(ct) === JSON.stringify(want));
  if (pass) ok++;
  console.log(`${pass ? 'ok  ' : 'MISS'} ${name.padEnd(46)} want ${kind} ${want.join(',').padEnd(30)} got ${bad.join(',')}${kind === 'ct' ? ' (CT ' + ct.length + ')' : ''}${pass ? '' : ' | ' + res.filter((r) => !r.asIs).map((r) => r.goal + ':' + r.why.slice(0, 50)).join(' ; ')}`);
  rmSync(base, { recursive: true, force: true });
}
console.log(`\nmutants caught exactly: ${ok}/${ran}`);
