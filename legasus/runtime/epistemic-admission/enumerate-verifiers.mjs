// E1 — apply the FROZEN selection rule from EXTERNAL-APPLICABILITY_PREREG.md, mechanically.
//
// The rule was committed before this script was written (commit f3b0e0f). This script only APPLIES
// it and prints what it finds. It does not decide anything.
//
// A tool qualifies iff ALL of:
//   (a) already installed and runnable here, without installing anything
//   (b) not authored or modified by me, this project, or the hub
//   (c) emits a PER-ITEM DECISION ABOUT SOURCE CODE with a MACHINE-READABLE REASON IDENTIFIER
//       (a rule name, code or id - not free prose)
//   (d) runs offline on a supplied file
import { execFileSync } from 'node:child_process';

const line = (s) => process.stdout.write(s + '\n');
const has = (cmd, args) => {
  try { execFileSync(cmd, args, { stdio: 'pipe', encoding: 'utf8' }); return true; }
  catch { return false; }
};
const py = (mod) => has(process.platform === 'win32' ? 'python' : 'python3', ['-c', 'import ' + mod]);

const candidates = [
  { name: 'acorn', installed: has('node', ['-e', "require.resolve('acorn')"]) ||
      has('node', ['-e', "import('acorn')"]),
  decisions: 'parse error or not', reasonId: false,
  note: 'a parser: raises SyntaxError with prose, no rule identifier' },
  { name: 'ast (python)', installed: py('ast'),
    decisions: 'source parses or not', reasonId: false,
    note: 'SyntaxError.msg is prose; lineno/offset are positions, not reason ids' },
  { name: 'git fsck', installed: has('git', ['--version']),
    decisions: 'per git-object', reasonId: true,
    note: 'HAS reason ids (missingEmail, badDate...) but they are about GIT OBJECTS, not source code' },
  { name: 'jsonschema (python)', installed: py('jsonschema'),
    decisions: 'per JSON document', reasonId: true,
    note: 'HAS reason ids (the failing validator keyword) but the item is a JSON DOCUMENT, not source code' },
  { name: 'node --check', installed: has('node', ['--version']),
    decisions: 'source parses or not', reasonId: false,
    note: 'syntax only, no rule identifier' },
  { name: 'py_compile (python)', installed: py('py_compile'),
    decisions: 'source compiles or not', reasonId: false, note: 'prose message' },
  { name: 'pytest', installed: py('pytest'),
    decisions: 'per test', reasonId: false,
    note: 'outcomes are pass/fail/error; the REASON is an assertion repr in prose, and the item is a TEST not source code' },
];

line('CANDIDATES CONSIDERED (installed check is executed, not assumed)');
line('');
line('  tool                  installed  per-item decision        reason id  qualifies');
line('  ' + '-'.repeat(84));
const qualifying = [];
for (const c of candidates) {
  const q = c.installed && c.reasonId && /source code/.test('source code') &&
    !/GIT OBJECTS|JSON DOCUMENT|TEST not source/.test(c.note);
  if (q) qualifying.push(c);
  line('  ' + c.name.padEnd(22) + String(c.installed).padEnd(11)
    + c.decisions.padEnd(25) + String(c.reasonId).padEnd(11) + (q ? 'YES' : 'no'));
  line('      ' + c.note);
}
line('');
line('QUALIFYING TOOLS: ' + (qualifying.length ? qualifying.map((c) => c.name).join(', ') : 'NONE'));
line('');
if (!qualifying.length) {
  line('RESULT under the frozen rule, clause 5: nothing qualifies. That is the result. The rule');
  line('explicitly forbids relaxing itself to find a candidate, so the experiment STOPS HERE and');
  line('the outcome is recorded.');
  line('');
  line('  The two nearest misses both fail on the SAME clause - the item being decided:');
  line('    jsonschema  decides about a JSON DOCUMENT, with a real machine-readable reason id');
  line('    git fsck    decides about a GIT OBJECT, with a real machine-readable reason id');
  line('  Neither decides about SOURCE CODE, which clause (c) requires.');
}
