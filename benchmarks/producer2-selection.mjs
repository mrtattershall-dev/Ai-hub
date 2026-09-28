// r4 — producer #2 selection, applying the rule frozen in 087ec67.
//
// Axes are scored from each tool's DOCUMENTED DESIGN, not from its output on any subject. No candidate
// behaviour is inspected before the rule selects.
import { execFileSync } from 'node:child_process';

const AXES = ['evidenceUnit', 'identityScheme', 'executionModel', 'nativeVocabulary', 'criterion',
  'stateHistory', 'isolationModel'];

// The reference. Producer #1, as it actually behaves.
const DOCTEST = {
  evidenceUnit: 'one doctest EXAMPLE',
  identityScheme: 'DocTest name + example ordinal',
  executionModel: 'sequential, shared globals per docstring',
  nativeVocabulary: 'PASS / OUTPUT_MISMATCH / UNEXPECTED_EXCEPTION',
  criterion: 'documented output matches actual output',
  stateHistory: 'examples share one namespace, in order',
  isolationModel: 'in-process, runner captures stdout',
};

// Candidates, declared structurally. `probe` establishes AVAILABILITY only.
const CANDIDATES = [
  { tool: 'git', probe: ['git', '--version'],
    fact: 'byte identity and history of repository content',
    evidenceUnit: 'a blob/tree/commit object',
    identityScheme: 'content-addressed SHA over object bytes',
    executionModel: 'none - it does not execute the subject at all',
    nativeVocabulary: 'object type, oid, tracked/untracked, clean/dirty',
    criterion: 'content identity and recorded history',
    stateHistory: 'an explicit DAG of commits',
    isolationModel: 'separate process, no subject execution' },
  { tool: 'py_compile', probe: ['python', '-c', 'import py_compile'],
    fact: 'whether a source file is syntactically valid Python',
    evidenceUnit: 'a source FILE',
    identityScheme: 'filesystem path',
    executionModel: 'compile only, subject never runs',
    nativeVocabulary: 'compiles / SyntaxError with position',
    criterion: 'the grammar accepts the source',
    stateHistory: 'none - each file independent',
    isolationModel: 'separate process, no subject execution' },
  { tool: 'unittest', probe: ['python', '-c', 'import unittest'],
    fact: 'whether authored test cases pass',
    evidenceUnit: 'a TestCase method',
    identityScheme: 'dotted test id (module.Class.method)',
    executionModel: 'per-test setUp/tearDown, fresh instance each test',
    nativeVocabulary: 'ok / FAIL / ERROR / skip / expectedFailure / unexpectedSuccess',
    criterion: 'assertions authored in the test body',
    stateHistory: 'each test isolated by construction',
    isolationModel: 'in-process, per-test fixtures' },
  { tool: 'symtable', probe: ['python', '-c', 'import symtable'],
    fact: 'binding and scope structure of a module',
    evidenceUnit: 'a symbol within a scope',
    identityScheme: 'scope chain + symbol name',
    executionModel: 'static analysis, subject never runs',
    nativeVocabulary: 'local / global / free / imported / assigned / referenced',
    criterion: 'the language scoping rules',
    stateHistory: 'none - lexical structure only',
    isolationModel: 'separate process, no subject execution' },
  { tool: 'pip-check', probe: ['python', '-m', 'pip', '--version'],
    fact: 'whether installed distributions have consistent dependencies',
    evidenceUnit: 'an installed distribution',
    identityScheme: 'distribution name + version',
    executionModel: 'metadata only, nothing runs',
    nativeVocabulary: 'consistent / requires X which is not installed / version conflict',
    criterion: 'declared dependency constraints',
    stateHistory: 'the installed environment as a whole',
    isolationModel: 'separate process, no subject execution' },
];

const available = (c) => {
  try {
    execFileSync(c.probe[0], c.probe.slice(1), { stdio: 'ignore', timeout: 20000 });
    return true;
  } catch (e) { return false; }
};

const rows = [];
for (const c of CANDIDATES) {
  const ok = available(c);
  const differing = AXES.filter((a) => c[a] !== DOCTEST[a]);
  rows.push({ tool: c.tool, available: ok, fact: c.fact, differing: differing.length,
    axes: differing, eligible: ok && differing.length >= 3, spec: c });
}

console.log('PRODUCER #2 SELECTION — rule frozen in 087ec67');
console.log('');
console.log('  tool          avail  axes differing  eligible');
for (const r of rows) {
  console.log('  ' + r.tool.padEnd(14) + String(r.available).padEnd(7)
    + String(r.differing).padStart(8) + '        ' + r.eligible);
}
const eligible = rows.filter((r) => r.eligible)
  .sort((a, b) => b.differing - a.differing || a.tool.localeCompare(b.tool));
console.log('');
console.log('eligible: ' + eligible.length);
if (!eligible.length) {
  console.log('NO ELIGIBLE CANDIDATE. The rule selects nothing and no producer #2 is chosen.');
  process.exit(0);
}
const chosen = eligible[0];
console.log('');
console.log('SELECTED: ' + chosen.tool + '  (differs on ' + chosen.differing + ' of ' + AXES.length
  + ' axes; ties would break lexicographically)');
console.log('  fact consumed : ' + chosen.fact);
for (const a of chosen.axes) {
  console.log('  ' + a.padEnd(17) + 'doctest: ' + DOCTEST[a]);
  console.log('  ' + ''.padEnd(17) + chosen.tool + ': ' + chosen.spec[a]);
}
console.log('');
console.log('runner-up: ' + (eligible[1] ? eligible[1].tool + ' (' + eligible[1].differing + ')' : 'none'));
