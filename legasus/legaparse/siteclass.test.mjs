// WITNESSES for site equivalence. The danger is that "equivalent" quietly becomes "close enough", so
// the REJECT cases are the point: each names a specific way two positions are NOT interchangeable.
//
// ADMIT cases exist so the rule cannot pass by rejecting everything - the failure mode this project has
// hit six times.
import { legalRegion, siteEquivalent } from './siteclass.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

// A module with two helpers and a consumer that uses one of them.
const MOD = L(
  'BASE = 1',                       // 0
  '',                               // 1
  'def helper_a(v):',               // 2
  '    return v + BASE',            // 3
  '',                               // 4
  'def helper_b(v):',               // 5
  '    return v * 2',               // 6
  '',                               // 7
  'def consume(v):',                // 8
  '    return helper_a(v)',         // 9
);

// The same module, but with an IMPORT-TIME use: `RESULT = helper_a(1)` runs when the module loads, so a
// definition placed after it genuinely fails. This is the difference a textual-mention rule cannot see.
const MOD_EXEC = L(
  'BASE = 1',                       // 0
  '',                               // 1
  'def helper_a(v):',               // 2
  '    return v + BASE',            // 3
  '',                               // 4
  'def helper_b(v):',               // 5
  '    return v * 2',               // 6
  '',                               // 7
  'RESULT = helper_a(1)',           // 8
  'OTHER = helper_b(2)',            // 9
);

// A loop with guarded branches and a fall-through owner.
const LOOP = L(
  'def run(items):',                // 0
  '    out = []',                   // 1
  '    for x in items:',            // 2
  '        if x == "a":',           // 3
  '            out.append(1)',      // 4
  '            continue',           // 5
  '        if x == "b":',           // 6
  '            out.append(2)',      // 7
  '            continue',           // 8
  '        out.append(0)',          // 9
  '    return out',                 // 10
);

const cases = [
  // ---- ADMIT
  { name: 'ADMIT   sibling def at two interchangeable module boundaries',
    src: MOD, op: { parent_scope: 'module', kind: 'sibling_def', requires: ['BASE'], provides: ['helper_c'] },
    a: 4, b: 7, expect: true },
  { name: 'ADMIT   branch sibling at two boundaries inside one legal region',
    src: LOOP, op: { parent_scope: 'run', kind: 'branch', requires: ['out'], provides: [],
      indent: 8, fallthrough_line: 9 },
    a: 5, b: 8, expect: true },

  // ---- REJECT
  // My first version of this case was mislabelled. "After line 3 at module indent" is after helper_a's
  // body ends, which IS position 4 - equivalent, not a scope crossing. A real scope witness has to
  // compare positions whose STRUCTURAL PARENT differs, which needs the insertion indent to differ.
  { name: 'ADMIT   after the last line of a body, at the outer indent, == after that body',
    src: MOD, op: { parent_scope: 'module', kind: 'sibling_def', requires: ['BASE'], provides: ['helper_c'], indent: 0 },
    a: 4, b: 3, expect: true },
  { name: 'REJECT  crosses a scope boundary (inside helper_a vs module body)',
    src: MOD, op: { parent_scope: 'module', kind: 'statement', requires: ['BASE'], provides: [], indent: 4 },
    a: 3, b: 6, expect: false },
  { name: 'REJECT  crosses a required definition/use dependency (before BASE exists)',
    src: MOD, op: { parent_scope: 'module', kind: 'sibling_def', requires: ['BASE'], provides: ['helper_c'] },
    a: 4, b: 0, expect: false },
  // This witness was WRONG and the code was right. It asserted that a module-level def must precede a
  // mention of it inside `consume`'s body - but Python resolves the name when consume() RUNS, so both
  // placements are legal. A textual mention is not a dependency. Replaced by the two real cases:
  { name: 'ADMIT   definition after a DEFERRED mention (resolved at call time, not at parse time)',
    src: MOD, op: { parent_scope: 'module', kind: 'sibling_def', requires: [], provides: ['helper_a'], indent: 0 },
    a: 1, b: 9, expect: true },
  { name: 'REJECT  placed after an IMPORT-TIME use, which really does execute first',
    src: MOD_EXEC, op: { parent_scope: 'module', kind: 'sibling_def', requires: [], provides: ['helper_a'], indent: 0 },
    a: 1, b: 9, expect: false },
  { name: 'REJECT  moves past a terminator, changing reachability',
    src: LOOP, op: { parent_scope: 'run', kind: 'statement', requires: ['out'], provides: [], indent: 8 },
    a: 3, b: 10, expect: false },
  { name: 'REJECT  branch placed after the fall-through owner never runs',
    src: LOOP, op: { parent_scope: 'run', kind: 'branch', requires: ['out'], provides: [],
      indent: 8, fallthrough_line: 9 },
    a: 5, b: 10, expect: false },
];

let fail = 0;
for (const c of cases) {
  const r = siteEquivalent(c.src, c.op, c.a, c.b);
  const pass = r.equivalent === c.expect;
  if (!pass) fail++;
  console.log('  ' + (pass ? 'ok  ' : 'FAIL') + '  ' + c.name);
  console.log('        region [' + (r.region.ok ? r.region.lo + ',' + r.region.hi : 'none') + ']  '
    + (r.why || '').slice(0, 96));
  if (c.note) console.log('        NOTE: ' + c.note);
}

const admits = cases.filter((c) => c.expect).length;
console.log('');
console.log('  ' + (fail ? fail + ' WITNESS FAILURE(S)' : 'all ' + cases.length + ' witnesses pass'));
console.log('  Non-vacuity: ' + admits + ' ADMIT cases must be accepted. A rule that rejects everything');
console.log('  would pass every REJECT case and be useless.');
console.log('');
console.log('  Structural-parent identity is now enforced as its own predicate, which is what makes the');
console.log('  terminator witness reject for the right reason rather than by numeric luck.');
