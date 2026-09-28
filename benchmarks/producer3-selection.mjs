// r4 — producer #3 selection, applying the rule frozen in 0baca08.
//
// Coordinates are declared from each tool's DOCUMENTED DESIGN, with a one-line justification each and an
// explicit mapsTo, so the assignment that DRIVES the ranking is auditable and disputable rather than
// asserted. No candidate's output on any subject is observed before the rule selects.
//
// THE HONEST HAZARD, stated up front: the ranking is my coordinate assignment. A generous reading of one
// candidate's coordinates could hand it the win. Two defences, neither perfect:
//   1. every coordinate names what it mapsTo, so a disputed call is visible rather than buried in a score;
//   2. where a coordinate is ARGUABLE it is resolved CONSERVATIVELY - assigned to one of the six rather
//      than counted as foreign - which biases AGAINST the hypothesis this experiment wants to confirm.
import { execFileSync } from 'node:child_process';
import { CONTEXT_DIMENSIONS, SUBJECT_DIMENSIONS } from '../legasus/legaknow/justification.mjs';

const SIX = [...CONTEXT_DIMENSIONS, ...SUBJECT_DIMENSIONS];

const AXES = ['evidenceUnit', 'identityScheme', 'executionModel', 'nativeVocabulary', 'criterion',
  'stateHistory', 'isolationModel'];

const DOCTEST = {
  evidenceUnit: 'one doctest EXAMPLE',
  identityScheme: 'DocTest name + example ordinal',
  executionModel: 'sequential, shared globals per docstring',
  nativeVocabulary: 'PASS / OUTPUT_MISMATCH / UNEXPECTED_EXCEPTION',
  criterion: 'documented output matches actual output',
  stateHistory: 'examples share one namespace, in order',
  isolationModel: 'in-process, runner captures stdout',
};

const GIT = {
  evidenceUnit: 'a blob/tree/commit object',
  identityScheme: 'content-addressed SHA over object bytes',
  executionModel: 'none - it does not execute the subject at all',
  nativeVocabulary: 'object type, oid, tracked/untracked, clean/dirty',
  criterion: 'content identity and recorded history',
  stateHistory: 'an explicit DAG of commits',
  isolationModel: 'separate process, no subject execution',
};

// mapsTo: one of the six, or null meaning FOREIGN - Legasus has no name for it.
const C = (name, mapsTo, why) => ({ name, mapsTo, why });

const CANDIDATES = [
  {
    tool: 'trace', probe: ['python', '-c', 'import trace'],
    fact: 'which lines and callers actually executed during a run',
    consumedBecause: 'r4 already reasons about WITNESSED SITES; sweep.json is built from exactly this',
    evidenceUnit: 'a source LINE, or a caller->callee edge',
    identityScheme: 'filename + line number',
    executionModel: 'the subject runs WITH A TRACE FUNCTION ATTACHED',
    nativeVocabulary: 'executed / not executed, hit counts, caller edges',
    criterion: 'the interpreter reported this line',
    stateHistory: 'counts ACCUMULATED across a whole run',
    isolationModel: 'in-process, sys.settrace on the subject itself',
    coordinates: [
      C('workload', null,
        'FOREIGN. "line L executed" is true RELATIVE TO THE SET of invocations that ran. invocation names'
        + ' ONE call; a workload is a set, and the claim is about the set.'),
      C('observerPresence', null,
        'FOREIGN. Attaching a trace function changes what the interpreter does - it suppresses some'
        + ' optimizations and alters timing. NO dimension records whether an observer was attached.'),
      C('countMode', 'criterion', 'count vs trace vs caller-edges IS the criterion being applied'),
      C('ignoreDirs', 'criterion',
        'ARGUABLE - it is the measurement aperture rather than the criterion. Resolved CONSERVATIVELY'
        + ' as criterion, which counts AGAINST this candidate.'),
      C('interpreter', 'environment', 'CPython build and version'),
    ],
  },
  {
    tool: 'timeit', probe: ['python', '-c', 'import timeit'],
    fact: 'how long a statement takes to execute',
    consumedBecause: 'a repair that preserves behaviour but destroys performance is not a repair, and the'
      + ' capability frontier has no way to say so today',
    evidenceUnit: 'a timed STATEMENT',
    identityScheme: 'the statement source text',
    executionModel: 'the statement runs many times in a tight loop',
    nativeVocabulary: 'elapsed seconds per loop, best-of-N',
    criterion: 'wall-clock duration under a chosen timer',
    stateHistory: 'none between repeats, by design',
    isolationModel: 'in-process, gc disabled during timing',
    coordinates: [
      C('wallClockInstant', null,
        'FOREIGN. A timing holds AT AN INSTANT. history is ordinal/DAG-shaped, not temporal; nothing'
        + ' among the six records WHEN an observation was taken.'),
      C('machineContention', null,
        'FOREIGN. The same statement on the same bytes gives a different answer under load. No dimension'
        + ' names the contending world outside the process.'),
      C('repeatCount', 'criterion', 'best-of-N IS the criterion'),
      C('timerFunction', 'criterion', 'perf_counter vs process_time changes what is being asserted'),
      C('setupStatement', 'invocation', 'the setup plus statement IS the invocation'),
      C('interpreter', 'environment', 'CPython build and version'),
    ],
  },
  {
    tool: 'pytest', probe: ['python', '-c', 'import pytest'],
    fact: 'whether authored test cases pass',
    consumedBecause: 'the capability frontier is built from test outcomes; this is the most direct fact'
      + ' Legasus consumes',
    evidenceUnit: 'a collected test NODE',
    identityScheme: 'nodeid - path::class::function[param]',
    executionModel: 'collection phase, then per-node setup/call/teardown',
    nativeVocabulary: 'passed / failed / error / skipped / xfail / xpass',
    criterion: 'assertions authored in the test body',
    stateHistory: 'fixtures are CACHED and REUSED across nodes by scope',
    isolationModel: 'in-process, fixture-scoped teardown',
    coordinates: [
      C('collectionCohort', null,
        'FOREIGN. "test T passed" depends on WHICH OTHER TESTS were collected in the same session,'
        + ' because module- and session-scoped fixtures are built once and reused. The verdict is about'
        + ' T but scoped by a SET T is not a member of.'),
      C('pluginSet', null,
        'FOREIGN. Loaded plugins change collection, assertion rewriting and reporting. No dimension'
        + ' records the composition of the OBSERVING APPARATUS.'),
      C('nodeid', 'invocation', 'the nodeid names the call'),
      C('fixtureScope', 'environment',
        'ARGUABLE - fixture scope is nearer collectionCohort than to environment. Resolved'
        + ' CONSERVATIVELY as environment, which counts AGAINST this candidate.'),
      C('rootdirAndIni', 'criterion', 'configuration selects which assertions apply'),
    ],
  },
  {
    tool: 'difflib', probe: ['python', '-c', 'import difflib'],
    fact: 'how close two texts are, and where they differ',
    consumedBecause: 'doctest OUTPUT_MISMATCH is a difference judgement; Legasus consumes want-vs-got',
    evidenceUnit: 'a matching block between two sequences',
    identityScheme: 'index ranges into the two sequences',
    executionModel: 'pure function, subject never runs',
    nativeVocabulary: 'equal / replace / delete / insert, ratio',
    criterion: 'longest contiguous matching blocks',
    stateHistory: 'none',
    isolationModel: 'in-process library call, no subject execution',
    coordinates: [
      C('relatum', null,
        'FOREIGN. "a is 0.87 similar" is meaningless without B. All six dimensions describe the subject'
        + ' or the world it sits in; NONE names a SECOND SUBJECT the claim is relative to.'),
      C('junkPredicate', 'criterion', 'autojunk and isjunk change what counts as a match'),
      C('sequenceA', 'implementation', 'the subject text itself'),
    ],
  },
  {
    tool: 'symtable', probe: ['python', '-c', 'import symtable'],
    fact: 'binding and scope structure of a module',
    consumedBecause: 'region derivation reasons about bindings',
    evidenceUnit: 'a symbol within a scope',
    identityScheme: 'scope chain + symbol name',
    executionModel: 'static analysis, subject never runs',
    nativeVocabulary: 'local / global / free / imported / assigned / referenced',
    criterion: 'the language scoping rules',
    stateHistory: 'none - lexical structure only',
    isolationModel: 'separate process, no subject execution',
    coordinates: [
      C('scopeChain', 'implementation', 'the lexical position IS part of the code under analysis'),
      C('grammarVersion', 'criterion', 'which language version accepts the binding'),
    ],
  },
  {
    tool: 'py_compile', probe: ['python', '-c', 'import py_compile'],
    fact: 'whether a source file is syntactically valid Python',
    consumedBecause: 'a candidate that does not compile is not a candidate',
    evidenceUnit: 'a source FILE',
    identityScheme: 'filesystem path',
    executionModel: 'compile only, subject never runs',
    nativeVocabulary: 'compiles / SyntaxError with position',
    criterion: 'the grammar accepts the source',
    stateHistory: 'none - each file independent',
    isolationModel: 'separate process, no subject execution',
    coordinates: [
      C('sourcePath', 'implementation', 'the file being compiled'),
      C('optimizationLevel', 'environment', '-O and -OO change the emitted code'),
    ],
  },
  {
    tool: 'unittest', probe: ['python', '-c', 'import unittest'],
    fact: 'whether authored test cases pass',
    consumedBecause: 'test outcomes feed the capability frontier',
    evidenceUnit: 'a TestCase method',
    identityScheme: 'dotted test id',
    executionModel: 'per-test setUp/tearDown, fresh instance each test',
    nativeVocabulary: 'ok / FAIL / ERROR / skip / expectedFailure / unexpectedSuccess',
    criterion: 'assertions authored in the test body',
    stateHistory: 'each test isolated by construction',
    isolationModel: 'in-process, per-test fixtures',
    coordinates: [
      C('testId', 'invocation', 'the dotted id names the call'),
      C('interpreter', 'environment', 'CPython build and version'),
    ],
  },
  {
    tool: 'sqlite3', probe: ['python', '-c', 'import sqlite3'],
    fact: 'the contents of a relational database at a point in time',
    consumedBecause: null,      // and this is why it is ineligible
    evidenceUnit: 'a row',
    identityScheme: 'primary key within a table',
    executionModel: 'the subject never runs; SQL runs instead',
    nativeVocabulary: 'rows, types, constraint violations',
    criterion: 'the SQL semantics of the query',
    stateHistory: 'MVCC snapshot within a transaction',
    isolationModel: 'separate connection, no subject execution',
    coordinates: [
      C('snapshotInstant', null, 'FOREIGN. the transaction point-in-time view'),
      C('isolationLevel', null, 'FOREIGN. no dimension names the consistency model'),
      C('databaseFile', 'repository', 'the store being read'),
    ],
  },
];

const available = (c) => {
  try { execFileSync(c.probe[0], c.probe.slice(1), { stdio: 'ignore', timeout: 20000 }); return true; }
  catch (e) { return false; }
};

console.log('PRODUCER #3 SELECTION — rule frozen in 0baca08');
console.log('');
console.log('the six declared dimensions: ' + SIX.join(', '));
console.log('');

const rows = CANDIDATES.map((c) => {
  const ok = available(c);
  const vsDoctest = AXES.filter((a) => c[a] !== DOCTEST[a]).length;
  const vsGit = AXES.filter((a) => c[a] !== GIT[a]).length;
  const foreign = c.coordinates.filter((k) => k.mapsTo === null);
  const bad = c.coordinates.filter((k) => k.mapsTo !== null && !SIX.includes(k.mapsTo));
  const reasons = [];
  if (!ok) reasons.push('not available');
  if (!c.consumedBecause) reasons.push('NOT a fact Legasus has reason to consume');
  if (vsDoctest < 3) reasons.push('too near doctest');
  if (vsGit < 3) reasons.push('too near git');
  if (bad.length) reasons.push('declares a mapsTo that is not one of the six: ' + bad[0].mapsTo);
  return { c, ok, vsDoctest, vsGit, foreign, eligible: reasons.length === 0, reasons };
});

console.log('  tool         avail  vs-doctest  vs-git  FOREIGN  eligible  why not');
for (const r of rows) {
  console.log('  ' + r.c.tool.padEnd(13) + String(r.ok).padEnd(7)
    + String(r.vsDoctest).padStart(6) + String(r.vsGit).padStart(8)
    + String(r.foreign.length).padStart(9) + '  ' + String(r.eligible).padEnd(9)
    + (r.reasons.join('; ') || ''));
}

const eligible = rows.filter((r) => r.eligible)
  .sort((a, b) => b.foreign.length - a.foreign.length || b.vsGit - a.vsGit
    || a.c.tool.localeCompare(b.c.tool));

console.log('');
console.log('eligible: ' + eligible.length);
if (!eligible.length || eligible[0].foreign.length === 0) {
  console.log('');
  console.log('THE RULE SELECTS NOTHING. No eligible candidate carries a coordinate outside the six, so');
  console.log('the closed dimension set is unfalsified BY ANYTHING AVAILABLE HERE - a statement about');
  console.log('this environment, not about the ontology.');
  process.exit(0);
}

// DID THE PRIMARY CRITERION DISCRIMINATE? P2's ordering saturated and the tiebreak decided; that must be
// reported here whether or not it repeats.
const top = eligible.filter((r) => r.foreign.length === eligible[0].foreign.length);
const spread = [...new Set(eligible.map((r) => r.foreign.length))];
console.log('foreign-coordinate counts among eligible: ' + spread.join(', '));
console.log('candidates tied at the top: ' + top.length + '  (' + top.map((r) => r.c.tool).join(', ')
  + ')');
if (top.length > 1) {
  const gitSpread = [...new Set(top.map((r) => r.vsGit))];
  console.log('  first tiebreak (axes differing from GIT) values among them: ' + gitSpread.join(', ')
    + (gitSpread.length === 1
      ? '  -> ALSO SATURATED; the LEXICOGRAPHIC tiebreak decides, exactly as in P2'
      : '  -> discriminates'));
}

const chosen = eligible[0];
console.log('');
console.log('SELECTED: ' + chosen.c.tool);
console.log('  fact consumed   : ' + chosen.c.fact);
console.log('  why Legasus     : ' + chosen.c.consumedBecause);
console.log('  FOREIGN coordinates - the ones Legasus has NO NAME FOR:');
for (const k of chosen.foreign) console.log('    ' + k.name + '  -  ' + k.why);
console.log('  coordinates that DO map:');
for (const k of chosen.c.coordinates.filter((x) => x.mapsTo !== null)) {
  console.log('    ' + k.name.padEnd(18) + '-> ' + k.mapsTo);
}
console.log('');
console.log('runner-up: ' + (eligible[1] ? eligible[1].c.tool + ' (' + eligible[1].foreign.length + ')'
  : 'none'));
