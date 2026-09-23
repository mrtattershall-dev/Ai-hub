/**
 * pilotTasks.js - THE FROZEN PILOT QUEUE.
 *
 * Five fixed tasks and their checks, written BEFORE any generation. Freezing them first is what
 * stops a check being quietly shaped by what the model happened to produce.
 *
 *   2 small repairs | 2 small additions preserving existing behaviour | 1 modest multi-file task
 *   3 Node | 2 Python | no downloads, no extra dependencies
 *
 * THE SEED RULE, enforced by pilotSeeds.test.mjs before the pilot may run:
 *
 *     every starting workspace must FAIL at least one requested-behaviour check
 *     and PASS all of its protected-behaviour checks
 *
 * Otherwise a seeded success masquerades as completed work - which is not hypothetical here: the
 * batch runner was already caught scoring an untouched seeded workspace as COMPLETED when the
 * worker was unavailable.
 *
 * Checks run inside the worker against /candidate (read-only). They exit 0 for satisfied.
 */

/** Identical guidance for every task. The model's tools are run_command and run_python. */
export const TESTING_GUIDANCE = [
  'Work only in the supplied workspace.',
  'Use run_command or run_python to inspect and test your changes.',
  'Node, Python 3 and Git are available offline; network access and package installation are unavailable.',
  'Preserve existing required behavior.',
  'Before declaring completion, run relevant checks and report what passed, failed, or could not be tested.',
  'A completion declaration does not determine the evaluator\'s result.',
].join(' ');

/** The tool set this pilot runs with, recorded so the configuration is part of the record. */
export const TOOL_SET_NOTE = {
  removed: ['spawn_subtask', 'verify_project', 'verify_godot', 'see_screen'],
  why: 'each executes model-written code on the host, outside the qualified worker boundary',
  retained_for_testing: ['run_command', 'run_python', 'read_file', 'write_file', 'edit_file', 'list_dir', 'search_file', 'outline_file'],
};

const node = (expr) => `node -e ${JSON.stringify(expr)}`;
/**
 * A Python check is delivered as a FILE, never as `python3 -c "..."`.
 *
 * JSON.stringify turns real newlines into the two characters backslash-n. Inside the
 * double-quoted shell word that reaches `sh -c`, the shell does not interpret them, so Python
 * received a literal backslash-n and died on line 1. Both Python checks could NEVER pass -
 * caught only because each check carries a known-good positive control, which is precisely
 * the difference between a check that fails and a check that cannot run.
 */
const pyFile = (name, src) => ({ script: `python3 /check/${name}`, files: { [name]: src } });

export const PILOT_TASKS = [
  // ── 1. REPAIR (Node) ─────────────────────────────────────────────────────────
  {
    id: 't1-repair-node-average',
    language: 'node',
    kind: 'repair',
    goal: 'stats.js has a bug: average() returns the wrong value for a non-empty list. Fix average() so it returns the arithmetic mean. Do not change the behaviour of total().',
    seed: {
      'package.json': '{"name":"pilot1","type":"commonjs"}\n',
      'stats.js': [
        'function total(xs) { return xs.reduce((a, b) => a + b, 0); }',
        '// BUG: divides by the wrong thing',
        'function average(xs) { return xs.length === 0 ? 0 : total(xs) / (xs.length + 1); }',
        'module.exports = { total, average };',
        '',
      ].join('\n'),
    },
    requested: { script: node("const s=require('/candidate/stats.js'); if (s.average([2,4,6]) !== 4) { console.log('average([2,4,6]) =', s.average([2,4,6]), 'expected 4'); process.exit(1); } if (s.average([]) !== 0) { console.log('average([]) should be 0'); process.exit(1); } console.log('average ok');") },
    protected: { script: node("const s=require('/candidate/stats.js'); if (s.total([1,2,3]) !== 6) { console.log('total broken'); process.exit(1); } console.log('total ok');") },
  },

  // ── 2. REPAIR (Python) ───────────────────────────────────────────────────────
  {
    id: 't2-repair-python-parse',
    language: 'python',
    kind: 'repair',
    goal: 'parser.py has a bug: parse_pairs() drops the last pair when the input has no trailing semicolon. Fix it so every pair is returned. Do not change the behaviour of normalise().',
    seed: {
      'parser.py': [
        'def normalise(s):',
        '    return s.strip().lower()',
        '',
        'def parse_pairs(s):',
        '    # BUG: the final segment is discarded when there is no trailing ";"',
        '    parts = s.split(";")[:-1]',
        '    out = {}',
        '    for p in parts:',
        '        if "=" in p:',
        '            k, v = p.split("=", 1)',
        '            out[normalise(k)] = normalise(v)',
        '    return out',
        '',
      ].join('\n'),
    },
    requested: pyFile('t2_requested.py', [
      "import sys; sys.path.insert(0, '/candidate')",
      'import parser as m',
      "r = m.parse_pairs('A=1;B=2')",
      "assert r == {'a': '1', 'b': '2'}, 'got %r, expected both pairs' % (r,)",
      "r2 = m.parse_pairs('A=1;B=2;')",
      "assert r2 == {'a': '1', 'b': '2'}, 'trailing-semicolon form broke: %r' % (r2,)",
      "print('parse_pairs ok')",
      '',
    ].join('\n')),
    protected: pyFile('t2_protected.py', [
      "import sys; sys.path.insert(0, '/candidate')",
      'import parser as m',
      "assert m.normalise('  HeLLo ') == 'hello', 'normalise broken'",
      "print('normalise ok')",
      '',
    ].join('\n')),
  },

  // ── 3. ADDITION preserving behaviour (Node) ──────────────────────────────────
  {
    id: 't3-add-node-median',
    language: 'node',
    kind: 'addition',
    goal: 'Add a median(xs) function to numbers.js and export it. For an even-length list return the mean of the two middle values; for an empty list return 0. Keep sum() and max() working exactly as they do now.',
    seed: {
      'package.json': '{"name":"pilot3","type":"commonjs"}\n',
      'numbers.js': [
        'function sum(xs) { return xs.reduce((a, b) => a + b, 0); }',
        'function max(xs) { return xs.length ? Math.max(...xs) : null; }',
        'module.exports = { sum, max };',
        '',
      ].join('\n'),
    },
    requested: { script: node("const n=require('/candidate/numbers.js'); if (typeof n.median !== 'function') { console.log('median is not exported'); process.exit(1); } if (n.median([3,1,2]) !== 2) { console.log('median([3,1,2]) =', n.median([3,1,2]), 'expected 2'); process.exit(1); } if (n.median([1,2,3,4]) !== 2.5) { console.log('median([1,2,3,4]) =', n.median([1,2,3,4]), 'expected 2.5'); process.exit(1); } if (n.median([]) !== 0) { console.log('median([]) should be 0'); process.exit(1); } console.log('median ok');") },
    protected: { script: node("const n=require('/candidate/numbers.js'); if (n.sum([1,2,3]) !== 6) { console.log('sum broken'); process.exit(1); } if (n.max([1,9,3]) !== 9) { console.log('max broken'); process.exit(1); } if (n.max([]) !== null) { console.log('max([]) should be null'); process.exit(1); } console.log('sum and max ok');") },
  },

  // ── 4. ADDITION preserving behaviour (Python) ────────────────────────────────
  {
    id: 't4-add-python-slugify',
    language: 'python',
    kind: 'addition',
    goal: 'Add a slugify(s) function to text.py. It should lowercase the text, replace any run of non-alphanumeric characters with a single hyphen, and strip leading and trailing hyphens. Keep word_count() working exactly as it does now.',
    seed: {
      'text.py': [
        'def word_count(s):',
        '    return len([w for w in s.split() if w])',
        '',
      ].join('\n'),
    },
    requested: pyFile('t4_requested.py', [
      "import sys; sys.path.insert(0, '/candidate')",
      'import text as m',
      "assert hasattr(m, 'slugify'), 'slugify is not defined'",
      "r = m.slugify('Hello, World!')",
      "assert r == 'hello-world', 'got %r, expected hello-world' % (r,)",
      "r2 = m.slugify('  --A  B--  ')",
      "assert r2 == 'a-b', 'got %r, expected a-b' % (r2,)",
      "print('slugify ok')",
      '',
    ].join('\n')),
    protected: pyFile('t4_protected.py', [
      "import sys; sys.path.insert(0, '/candidate')",
      'import text as m',
      "assert m.word_count('a b  c') == 3, 'word_count broken'",
      "assert m.word_count('') == 0, 'word_count broken on empty'",
      "print('word_count ok')",
      '',
    ].join('\n')),
  },

  // ── 5. MODEST MULTI-FILE (Node) ──────────────────────────────────────────────
  {
    id: 't5-multifile-node-discount',
    language: 'node',
    kind: 'multi-file',
    goal: 'Add percentage discounts. In pricing.js add applyDiscount(amount, percent) returning the amount reduced by that percentage, rounded to 2 decimal places. In cart.js use it so cartTotal(items, percent) applies the discount to the summed total. Keep cartTotal(items) with no percent behaving exactly as it does now.',
    seed: {
      'package.json': '{"name":"pilot5","type":"commonjs"}\n',
      'pricing.js': [
        'function round2(n) { return Math.round(n * 100) / 100; }',
        'module.exports = { round2 };',
        '',
      ].join('\n'),
      'cart.js': [
        "const { round2 } = require('./pricing');",
        'function cartTotal(items) { return round2(items.reduce((a, i) => a + i.price * i.qty, 0)); }',
        'module.exports = { cartTotal };',
        '',
      ].join('\n'),
    },
    requested: { script: node("const p=require('/candidate/pricing.js'); const c=require('/candidate/cart.js'); if (typeof p.applyDiscount !== 'function') { console.log('applyDiscount is not exported from pricing.js'); process.exit(1); } if (p.applyDiscount(100, 10) !== 90) { console.log('applyDiscount(100,10) =', p.applyDiscount(100,10), 'expected 90'); process.exit(1); } if (p.applyDiscount(10.99, 15) !== 9.34) { console.log('applyDiscount(10.99,15) =', p.applyDiscount(10.99,15), 'expected 9.34'); process.exit(1); } const items=[{price:10,qty:2},{price:5,qty:1}]; if (c.cartTotal(items, 10) !== 22.5) { console.log('cartTotal(items,10) =', c.cartTotal(items,10), 'expected 22.5'); process.exit(1); } console.log('discount ok');") },
    protected: { script: node("const p=require('/candidate/pricing.js'); const c=require('/candidate/cart.js'); if (p.round2(1.005) !== 1.01 && p.round2(2.345) !== 2.35) { console.log('round2 broken'); process.exit(1); } const items=[{price:10,qty:2},{price:5,qty:1}]; if (c.cartTotal(items) !== 25) { console.log('cartTotal(items) =', c.cartTotal(items), 'expected 25'); process.exit(1); } console.log('round2 and undiscounted cartTotal ok');") },
  },
];
