/**
 * goalEntry.test.mjs - FG-4 SUBJECT's pure entry selection.   node server/goalEntry.test.mjs
 */
import { goalEntry } from './goalEntry.mjs';

let passed = 0, failed = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); c ? passed++ : failed++; };
const fs = (...have) => (f) => have.includes(f);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('goalEntry - the first named code file, or a refusal');
ok(eq(goalEntry('Add desk() to s10_desk.js, using s1_library.js and s7_cache.js.', fs('s1_library.js', 's7_cache.js')), { entry: undefined, missing: 's10_desk.js' }), 'S1: the named target is missing -> missing=s10_desk.js, NO fall-through to s1_library.js');
ok(eq(goalEntry('Add checkout() to s1_library.js.', fs('s1_library.js')), { entry: 's1_library.js', missing: null }), 'S2: one named file, exists -> entry');
ok(eq(goalEntry('Remove old.js and update index.js.', fs('index.js')), { entry: 'index.js', missing: null }), 'S3: remove-goal, old.js absent is satisfied -> entry=index.js');
ok(eq(goalEntry('Make the library better.', fs('s1_library.js')), { entry: undefined, missing: null }), 'S4: no named code file -> no entry, no refusal');
ok(eq(goalEntry('Add desk() to s10_desk.js, using s1_library.js.', fs('s10_desk.js', 's1_library.js')), { entry: 's10_desk.js', missing: null }), 'S6: the named target exists -> it is the entry');
ok(eq(goalEntry('Delete scratch.py.', fs()), { entry: undefined, missing: null }), 'remove-goal with every named file absent -> satisfied, no entry');
ok(eq(goalEntry('Update README.md and notes.txt.', fs('README.md')), { entry: undefined, missing: null }), 'non-code names are not entries and cannot be "missing"');
ok(eq(goalEntry('Fix S1_Library.js.', (f) => f === 's1_library.js'), { entry: 's1_library.js', missing: null }), 'namedFiles lower-cases; exists() sees the lower-cased form (as the replaced line did)');
ok(eq(goalEntry('', fs('a.js')), { entry: undefined, missing: null }) && eq(goalEntry(undefined, fs('a.js')), { entry: undefined, missing: null }), 'empty / undefined goal -> nothing');

console.log(`\n  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
