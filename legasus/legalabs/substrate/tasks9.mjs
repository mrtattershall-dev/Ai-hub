// SCOPE AND SELF-REFERENCE FAMILY. Authored blind, under Narrowability V2 from the start.
//
// Narrow on purpose. This is not a re-proof of revision 6; it buys prospective standing for exactly
// two rules that currently have development standing only:
//
//     scope_availability          enclosing parameters and locals resolve a requirement
//     self-referential binding    x = f(x) reads its target before it writes it
//
//   id   ops  case                                    must
//   k01   2   requirement is an enclosing PARAMETER    resolve as enclosing scope, narrow nothing
//   k02   2   similarly named symbol NOT in scope      resolve as the MODULE binding, and ORDER
//   k03   2   X = X + 1 at module level                the read of X survives as a requirement
//   k04   2   X = OTHER * 2 at module level            X must NOT become a requirement on itself
//
// k02 is the sharp negative for scope: the enclosing unit has a parameter `value`, and the operation
// requires `values` - a different name that IS bound at module level. A resolver that walks upward
// until something looks close would claim enclosing scope and silently lose a real ordering
// constraint. Exact matching must resolve it as the module binding instead.
//
// k03/k04 are the self-reference pair. They differ in one character of intent: whether the new value
// is computed FROM the old one. `TOTAL = TOTAL + 1` must keep the read; `TOTAL = STEP * 2` must not
// acquire a phantom requirement on its own name just because that name is on the left.
//
// Operation counts are 2 on every task, so size explains nothing.
const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL) + NL;
const Q = String.fromCharCode(34);

const k01src = L(
  'class Cache:',
  '    def __init__(self):',
  '        self._store = {}',
  '',
  '    def get(self, key):',
  '        if key in self._store:',
  '            return self._store[key]',
  '        return None',
);

const k02src = L(
  '# Statistics.',
  '',
  'values = [1, 2, 3]',
  '',
  '',
  'def describe(value):',
  '    return str(value)',
  '',
  '',
  'def size():',
  '    return len(values)',
);

const k03src = L(
  '# Running total.',
  '',
  'TOTAL = 5',
  '',
  '',
  'def total():',
  '    return TOTAL',
);

const k04src = L(
  '# Step scaling.',
  '',
  'STEP = 4',
  '',
  '',
  'def step():',
  '    return STEP',
);

export const TASKS9 = [
  {
    id: 'k01',
    lead: 'cache.py', language: 'py', run_with: 'python',
    goal: 'Add default values to the EXISTING Cache in cache.py: put(key, value) stores a value, and '
      + 'get must fall back to a registered default for the requested key before returning None. '
      + 'default(key, value) registers that default. Keep direct hits working exactly as they do now. '
      + 'Run it with python.',
    analogy: 'the defaults table works the same way as the existing store',
    interface: ['put', 'default', 'key', 'value'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing store as the relation to parallel; that '
      + 'feature has a declaration and a reader, and the new table occupies the same positions',
    structural_class: 'parallel-state-feature',
    source: k01src,
    operations: [
      { id: 'op1', intent: 'declare the parallel table and the writer',
        anchor: '        self._store = {}' + NL,
        code: L('        self._defaults = {}') },
      { id: 'op2', intent: 'a branch inside get, requiring the unit PARAMETER `key`',
        anchor: '        if key in self._store:' + NL + '            return self._store[key]' + NL,
        code: L('        if key in self._defaults:',
          '            return self._defaults[key]') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L('import cache',
      'c = cache.Cache()',
      'c._store["a"] = 1',
      'assert c.get("a") == 1, c.get("a")',
      'assert c.get("zz") is None',
      'print("OK")'),
    delta_probe: L('import cache',
      'c = cache.Cache()',
      'c._defaults["b"] = 9',
      'assert c.get("b") == 9, c.get("b")',
      'c._store["a"] = 1',
      'assert c.get("a") == 1, "direct hits must be unchanged"',
      'assert c.get("zz") is None',
      'print("OK")'),
  },

  {
    id: 'k02',
    lead: 'statistics.py', language: 'py', run_with: 'python',
    goal: 'Add a total to the EXISTING statistics.py: TOTAL holds the sum of the values when the '
      + 'module is imported, and total() returns it. Keep values, describe and size working exactly as '
      + 'they do now. Run it with python.',
    analogy: 'the total is assembled the same way as the existing size helper',
    interface: ['TOTAL', 'total'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing size helper as the relation to parallel; that '
      + 'feature reads the shared collection, and the new value occupies the same position',
    structural_class: 'parallel-state-feature',
    source: k02src,
    operations: [
      { id: 'op1', intent: 'a module statement requiring `values`, NOT the parameter `value`',
        anchor: 'def size():' + NL + '    return len(values)' + NL,
        code: L('', '', 'TOTAL = sum(values)') },
      { id: 'op2', intent: 'the accessor',
        anchor: '# Statistics.' + NL,
        code: L('', 'def total():', '    return TOTAL') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L('import statistics',
      'assert statistics.values == [1, 2, 3], statistics.values',
      'assert statistics.describe(7) == "7", statistics.describe(7)',
      'assert statistics.size() == 3, statistics.size()',
      'print("OK")'),
    delta_probe: L('import statistics',
      'assert statistics.TOTAL == 6, statistics.TOTAL',
      'assert statistics.total() == 6, statistics.total()',
      'assert statistics.size() == 3, "the existing helper must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'k03',
    lead: 'running.py', language: 'py', run_with: 'python',
    goal: 'Add an increment to the EXISTING running.py: TOTAL must be one greater than its starting '
      + 'value when the module is imported, and bumped() returns the resulting value. Keep total '
      + 'working exactly as it does now. Run it with python.',
    analogy: 'the increment is applied the same way as the existing total is declared',
    interface: ['bumped'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing total declaration as the relation to parallel; '
      + 'that feature is a module constant read by a function, and the new behaviour occupies the same '
      + 'position over the same name',
    structural_class: 'parallel-state-feature',
    source: k03src,
    operations: [
      { id: 'op1', intent: 'a SELF-REFERENTIAL binding: the new value is computed from the old one',
        anchor: 'TOTAL = 5' + NL,
        code: L('', 'TOTAL = TOTAL + 1') },
      { id: 'op2', intent: 'the accessor',
        anchor: 'def total():' + NL + '    return TOTAL' + NL,
        code: L('', '', 'def bumped():', '    return TOTAL') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L('import running',
      'assert running.total() == running.TOTAL, running.TOTAL',
      'print("OK")'),
    delta_probe: L('import running',
      'assert running.TOTAL == 6, running.TOTAL',
      'assert running.bumped() == 6, running.bumped()',
      'assert running.total() == 6, "the accessor reads the same name"',
      'print("OK")'),
  },

  {
    id: 'k04',
    lead: 'stepping.py', language: 'py', run_with: 'python',
    goal: 'Add a doubled step to the EXISTING stepping.py: DOUBLE holds twice STEP when the module is '
      + 'imported, and doubled() returns it. Keep STEP and step working exactly as they do now. Run it '
      + 'with python.',
    analogy: 'the doubled step is assembled the same way as the existing step is declared',
    interface: ['DOUBLE', 'doubled'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing step declaration as the relation to parallel; '
      + 'that feature is a module constant read by a function, and the new value occupies the same '
      + 'position',
    structural_class: 'parallel-state-feature',
    source: k04src,
    operations: [
      { id: 'op1', intent: 'a FRESH binding computed from another name, not from itself',
        anchor: 'STEP = 4' + NL,
        code: L('', 'DOUBLE = STEP * 2') },
      { id: 'op2', intent: 'the accessor',
        anchor: 'def step():' + NL + '    return STEP' + NL,
        code: L('', '', 'def doubled():', '    return DOUBLE') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L('import stepping',
      'assert stepping.STEP == 4, stepping.STEP',
      'assert stepping.step() == 4, stepping.step()',
      'print("OK")'),
    delta_probe: L('import stepping',
      'assert stepping.DOUBLE == 8, stepping.DOUBLE',
      'assert stepping.doubled() == 8, stepping.doubled()',
      'assert stepping.step() == 4, "the existing helper must be unchanged"',
      'print("OK")'),
  },
];
