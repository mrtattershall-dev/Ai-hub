// mutate-D.mjs : proves checks-D.mjs catches real mistakes. Each mutant = refs/ + ONE planted bug (exact string
// replace or append; a missing anchor aborts, so no mutant can silently test nothing). The goals that fail must be
// EXACTLY the expected ones (kind 'fail'), or show CT - implementation right, own test wrong (kind 'ct').
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const REFS = join(HERE, '..', 'refs');
const g = (chain, ...steps) => steps.map((s) => (s - 1) * 10 + chain);
const M = [
  ['transfer into a frozen account allowed', 'r1_ledger.js', 'this._live(a, from); this._live(b, to);', 'this._live(a, from);', g(1, 5), [1]],
  ['undo of a transfer keeps its history', 'r1_ledger.js', "drop(a, 'transfer-out', op.amount); drop(b, 'transfer-in', op.amount);", '', g(1, 6), [1]],
  ['interest paid to frozen accounts', 'r1_ledger.js', 'if (a.frozen || !(a.balance > 0)) continue;', 'if (!(a.balance > 0)) continue;', g(1, 7), [1]],
  ['toCSV with one decimal', 'r1_ledger.js', 'balance.toFixed(2)', 'balance.toFixed(1)', g(1, 8), [1]],
  ['notes invent a method', 'R1_NOTES.md', null, '\n- `mergeAccounts(a, b)` - merges two accounts.\n', g(1, 10), [1]],
  ['sentences drops the last piece', 'r2_text.py', 're.finditer(r"[^.!?]*[.!?]+|[^.!?]+$", text)', 're.finditer(r"[^.!?]*[.!?]+", text)', g(2, 2, 5, 8), [2]],
  ['CLI runs on import', 'r2_text.py', 'if __name__ == "__main__":', 'if True:', g(2, 7), [2]],
  ['words back to ASCII only', 'r2_text.py', 'WORD = re.compile(r"[^\\W_]+(?:\'[^\\W_]+)*")', 'WORD = re.compile(r"[a-z0-9]+(?:\'[a-z0-9]+)*")', g(2, 9), [2]],
  ['order() alphabetical, not insertion', 'r3_tasks.js', 'const ids = [...this.tasks.keys()]; const done = new Set();', 'const ids = [...this.tasks.keys()].sort(); const done = new Set();', g(3, 3), [3]],
  ['no cycle check', 'r3_tasks.js', "if (this._reaches(onId, id)) throw new Error('cycle: ' + onId + ' already depends on ' + id);", '', g(3, 4, 9), [3]],
  ['criticalPath reversed', 'r3_tasks.js', 'path.unshift(pick); cur = pick;', 'path.push(pick); cur = pick;', g(3, 7), [3]],
  ['centroid = corner average', 'r4_geom.js', 'return { x: cx / (6 * A), y: cy / (6 * A) };', 'return { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length };', g(4, 3), [4]],
  ['edge points count as outside', 'r4_geom.js', 'if (onSegment(p, a, b)) return true;', '', g(4, 5), [4]],
  ['translate changes its input', 'r4_geom.js', 'function translate(points, dx, dy) { chkPts(points); return points.map((p) => ({ x: p.x + dx, y: p.y + dy })); }', 'function translate(points, dx, dy) { chkPts(points); for (const p of points) { p.x += dx; p.y += dy; } return points; }', g(4, 7), [4]],
  ['inner commit drops its changes', 'r5_store.py', '        if self._tx:\n            self._tx[-1].extend(log)\n', '', g(5, 3), [5]],
  ['expiry one tick late (> not >=)', 'r5_store.py', 'if e[1] is not None and self._now() >= e[1]:', 'if e[1] is not None and self._now() > e[1]:', g(5, 4), [5]],
  ['misses not counted as gets', 'r5_store.py', '        self._stats["gets"] += 1\n        e = self._live(key)\n        if e is _MISSING:\n            return default\n', '        e = self._live(key)\n        if e is _MISSING:\n            return default\n        self._stats["gets"] += 1\n', g(5, 9), [5]],
  ['add_months does not clamp', 'r6_days.py', 'return fmt(dt.date(y, m, min(d.day, calendar.monthrange(y, m)[1])))', 'return fmt(dt.date(y, m, d.day))', g(6, 6), [6]],
  ['business days count the start day', 'r6_days.py', '    while d < b:\n        d += dt.timedelta(days=1)\n        if not _off(d, hol):\n            count += 1\n', '    while d < b:\n        if not _off(d, hol):\n            count += 1\n        d += dt.timedelta(days=1)\n', g(6, 5), [6]],
  ['diagonal cuts between two walls', 'r7_grid.py', 'if _open(grid, r + dr, c + dc) and (_open(grid, r + dr, c) or _open(grid, r, c + dc)):', 'if _open(grid, r + dr, c + dc):', g(7, 3), [7]],
  ['life: cells never survive on 2', 'r7_grid.py', 'new.append(n == 3 or (bool(grid[r][c]) and n == 2))', 'new.append(n == 3)', g(7, 8, 9), [7]],
  ['multiply rounds halves up, not away', 'r8_money.js', 'function multiplyMoney(cents, factor) { ints([cents]); return roundAway(cents * factor); }', 'function multiplyMoney(cents, factor) { ints([cents]); return Math.round(cents * factor); }', g(8, 3), [8, 10]],
  ['split gives the extra cents last (breaks r10 too)', 'r8_money.js', 'base + (i < rem ? 1 : 0)', 'base + (i >= n - rem ? 1 : 0)', [...g(8, 4), ...g(10, 4)], [8, 10]],
  ['unknown currency code without a space', 'r8_money.js', "code + ' '", 'code', g(8, 8), [8]],
  ['web: text not trimmed', 'r9_app.js', 'const text = input.value.trim();', 'const text = input.value;', g(9, 2, 10), [9]],
  ['web: Active filter shows done items', 'r9_app.js', "if ((filter === 'active' && it.done) || (filter === 'done' && !it.done)) li.classList.add('hidden');", "if (filter === 'done' && !it.done) li.classList.add('hidden');", g(9, 6), [9]],
  ['web: nothing saved', 'r9_app.js', "function save() { localStorage.setItem('r9-items', JSON.stringify(items)); }", 'function save() {}', g(9, 8), [9]],
  ['richest ties reverse-alphabetical', 'r10_report.js', "(a.name < b.name ? -1 : a.name > b.name ? 1 : 0)", "(a.name < b.name ? 1 : a.name > b.name ? -1 : 0)", g(10, 9), [10]],
  ['index misses a file', 'R_INDEX.md', '- **r7_grid.py** -', '- **the grid module** -', g(10, 10), [10]],
  ['index invents a function', 'R_INDEX.md', null, '\n- r4_geom.js also has `isEven(n)`.\n', g(10, 10), [10]],
  ['JS own assert wrong -> CT', 'r3_tasks.js', null, "\nrequire('assert').strictEqual(1, 2);\n", g(3, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10), [3], 'ct'],
  ['PY own assert wrong -> CT', 'r6_days.py', null, "\nassert 1 == 2, 'own test wrong'\n", g(6, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10), [6], 'ct'],
];
let ok = 0;
for (const [name, file, from, to, expect, only, kind = 'fail'] of M) {
  const base = mkdtempSync(join(tmpdir(), 'mutD-')); const w = join(base, 'w'); cpSync(REFS, w, { recursive: true });
  const p = join(w, file);
  if (from === null) appendFileSync(p, to);
  else { const s = readFileSync(p, 'utf8'); if (!s.includes(from)) { console.log(`ANCHOR MISSING  ${name}`); rmSync(base, { recursive: true, force: true }); continue; } writeFileSync(p, s.replace(from, to)); }
  const out = join(base, 'r.json');
  spawnSync(process.execPath, [join(HERE, 'checks-D.mjs'), w, '--out', out], { encoding: 'utf8', timeout: 600000, env: { ...process.env, ONLY: only.join(',') } });
  const res = JSON.parse(readFileSync(out, 'utf8')).results;
  const bad = res.filter((r) => !r.asIs).map((r) => r.goal).sort((a, b) => a - b);
  const ct = res.filter((r) => !r.asIs && r.impl).map((r) => r.goal).sort((a, b) => a - b);
  const want = [...expect].sort((a, b) => a - b);
  const pass = JSON.stringify(bad) === JSON.stringify(want) && (kind !== 'ct' || JSON.stringify(ct) === JSON.stringify(want));
  if (pass) ok++;
  console.log(`${pass ? 'ok  ' : 'MISS'} ${name.padEnd(48)} want ${kind} ${want.join(',').padEnd(30)} got ${bad.join(',')}${kind === 'ct' ? ' (CT ' + ct.length + ')' : ''}${pass ? '' : ' | ' + res.filter((r) => !r.asIs).map((r) => r.goal + ':' + r.why.slice(0, 50)).join(' ; ')}`);
  rmSync(base, { recursive: true, force: true });
}
console.log(`\nmutants caught exactly: ${ok}/${M.length}`);
