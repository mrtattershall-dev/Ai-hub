import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Scores the append suite against ON-DISK state, because the file is the ground truth and a
// counter is only a report about it. Each check names what it reads and what it wants.
const results = process.argv[2];
const label = process.argv[3] || '';

const rows = readFileSync(results, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

const read = (dir, rel) => {
  const p = join(dir, 'workspace', rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};
const count = (s, re) => (String(s || '').match(re) || []).length;

const CHECKS = {
  'ap1-DUP-PY': (d) => ({ got: 'def foo x' + count(read(d, 'ctl.py'), /def foo\(/g), refusedWant: true }),
  'ap2-DUP-JS': (d) => ({ got: 'function jfoo x' + count(read(d, 'ctl.js'), /function jfoo\b/g), refusedWant: true }),
  'ap3-NEWDEF': (d) => {
    const s = read(d, 'ctl.py');
    return { got: 'foo x' + count(s, /def foo\(/g) + ' bar x' + count(s, /def bar\(/g) + ' baz x' + count(s, /def baz\(/g), refusedWant: false };
  },
  'ap4-NEWFILE': (d) => {
    const s = read(d, 'newmod.py');
    return { got: s === null ? 'newmod.py MISSING' : 'newmod.py qux x' + count(s, /def qux\(/g), refusedWant: false };
  },
  'ap5-NONSOURCE': (d) => ({ got: 'NOTES.md has second line: ' + /second line/.test(read(d, 'NOTES.md') || ''), refusedWant: false }),
  'ap6-NODEFS': (d) => {
    const s = read(d, 'ctl.py');
    return { got: 'has x = foo(): ' + /x = foo\(\)/.test(s || '') + ', foo x' + count(s, /def foo\(/g), refusedWant: false };
  },
  'ap7-DECLARED': (d) => ({ got: 'def foo x' + count(read(d, 'ctl.py'), /def foo\(/g), refusedWant: false }),
};

// What each scenario's on-disk state must be, stated as the string the check produces.
const WANT_FIXED = {
  'ap1-DUP-PY': 'def foo x1',
  'ap2-DUP-JS': 'function jfoo x1',
  'ap3-NEWDEF': 'foo x1 bar x1 baz x1',
  'ap4-NEWFILE': 'newmod.py qux x1',
  'ap5-NONSOURCE': 'NOTES.md has second line: true',
  'ap6-NODEFS': 'has x = foo(): true, foo x1',
  'ap7-DECLARED': 'def foo x2',
};

console.log('='.repeat(78));
console.log('APPEND-ROUTE SUITE' + (label ? ' — ' + label : ''));
console.log('='.repeat(78));
let pass = 0, fail = 0;
for (const id of Object.keys(CHECKS)) {
  const r = rows.find((x) => x.id === id);
  if (!r) { console.log('  MISSING  ' + id); fail++; continue; }
  if (!r.dir) { console.log('  NO DIR   ' + id + ' (run with --keep)'); fail++; continue; }
  const { got, refusedWant } = CHECKS[id](r.dir);
  const dup = r.duplicateNotes || 0, rm = r.refusedNotes || 0;
  const want = WANT_FIXED[id];
  const ok = got === want && (refusedWant ? dup + rm > 0 : dup + rm === 0);
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + id.padEnd(14)
    + 'dup=' + dup + ' rm=' + rm + '  ' + got + (ok ? '' : '   WANT: ' + want + (refusedWant ? ' + a refusal' : ' + no refusal')));
  ok ? pass++ : fail++;
}
console.log('');
console.log('  ' + pass + ' pass / ' + fail + ' fail   (scored against the POST-FIX expectation)');
console.log('='.repeat(78));
