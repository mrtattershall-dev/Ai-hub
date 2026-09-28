// WITNESSES for the escape guard, and then the guard run over the real tree.
//
// The positive control matters more than usual here: a scanner that flags nothing would pass every
// clean file and be worthless, which is the exact vacuity this project has hit repeatedly.
import { scan, scanFile } from './escape-guard.mjs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const NL = String.fromCharCode(10);
const BS = String.fromCharCode(92);           // one backslash, kept out of literal form on purpose

const cases = [
  { name: 'CORRUPTED  a heredoc-eaten regex string is caught',
    // source text: const re = '^\s*(?:def\s+' ;  exactly what landed on disk in the real incident
    src: "const re = '^" + BS + "s*(?:def" + BS + "s+';", expect: 2 },
  { name: 'CORRUPTED  a lone escaped metacharacter is caught',
    src: 'const re = "' + BS + '.mjs$";', expect: 1 },
  { name: 'CLEAN      correctly doubled escapes are NOT flagged',
    src: "const re = '^" + BS + BS + "s*(?:def" + BS + BS + "s+';", expect: 0 },
  { name: 'CLEAN      real JS escapes are NOT flagged',
    src: "const s = '" + BS + "n" + BS + "t" + BS + "r" + BS + BS + "';", expect: 0 },
  { name: 'CLEAN      a literal regex is not a string literal',
    src: 'const re = /^' + BS + 's*(?:def|class)' + BS + 'b/;', expect: 0 },
  { name: 'CLEAN      a comment mentioning an escape is not code',
    src: '// the pattern ' + BS + 's* matches whitespace' + NL + 'const x = 1;', expect: 0 },
];

let fail = 0;
for (const c of cases) {
  const hits = scan(c.src, '<case>');
  const ok = hits.length === c.expect;
  if (!ok) fail++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + c.name
    + '   found ' + hits.length + ', expected ' + c.expect);
}
const caught = cases.filter((c) => c.expect > 0).length;
const clean = cases.filter((c) => c.expect === 0).length;
console.log('');
console.log('  ' + (fail ? fail + ' WITNESS FAILURE(S)' : 'all ' + cases.length + ' witnesses pass'));
console.log('  Non-vacuity: ' + caught + ' corrupted cases must be CAUGHT and ' + clean
  + ' clean cases must pass. A scanner that flags');
console.log('  everything fails the clean cases; one that flags nothing fails the corrupted ones.');

// ---- and now the real tree
const ROOT = 'C:/Users/tatte/Projects/ai-coding-hub-indent/legasus';
const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) { if (e !== 'node_modules') walk(p); continue; }
    if (/\.(mjs|js)$/.test(e)) files.push(p);
  }
}(ROOT));

let bad = 0;
for (const f of files) {
  for (const h of scanFile(f)) {
    bad++;
    console.log('    ' + h.file.replace(ROOT, 'legasus') + ':' + h.line + '  ' + h.escape + '   ' + h.text);
  }
}
console.log('');
console.log('  scanned ' + files.length + ' file(s) under legasus/: '
  + (bad ? bad + ' CORRUPTED ESCAPE(S)' : 'no corrupted escapes'));
if (fail || bad) process.exitCode = 1;
