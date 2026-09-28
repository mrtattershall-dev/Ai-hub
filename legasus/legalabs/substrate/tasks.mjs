// THE TASK FAMILY, authored under the fifteen frozen construction rules.
//
// Authored from the construction procedure, NOT from a sense of what would make a good test of Legasus,
// challenge the 1.5B, or produce variance. Whatever the procedure yields is the substrate; if it turns
// out degenerate that is a finding about the procedure, recorded at family level, and individual tasks
// are not adjusted (rule 9).
//
// RULE 13, matched pairs. Each operation_count appears once per analogy class, so applicability class is
// not confounded with authored complexity:
//
//     ops   analogy_specified        no_supported_analogy
//      2    a01 weighted tallies     b01 undo via snapshot
//      3    a02 hourly buckets       b02 continuation lines
//      4    a03 date column          b03 nested comments
//
// Sources are freshly authored, deliberately NOT the setH seed files, which are entangled with goals
// 1-80 and with this model's measured history.
const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL) + NL;

// ---------------------------------------------------------------------------------------------------
// a01 — ANALOGY. A tally keyed by name exists; add a parallel weighted tally, named as the relation.
const a01src = L(
  'class Tally:',
  '    def __init__(self):',
  '        self._counts = {}',
  '',
  '    def add(self, key):',
  '        self._counts[key] = self._counts.get(key, 0) + 1',
  '',
  '    def count(self, key):',
  '        return self._counts.get(key, 0)',
  '',
  '    def total(self):',
  '        return sum(self._counts.values())',
);

// ---------------------------------------------------------------------------------------------------
// b01 — NO ANALOGUE. Nothing in the file retains prior state; undo requires a history the file has no
// precedent for.
const b01src = L(
  'class Stack:',
  '    def __init__(self):',
  '        self._items = []',
  '',
  '    def push(self, v):',
  '        self._items.append(v)',
  '',
  '    def pop(self):',
  '        return self._items.pop()',
  '',
  '    def peek(self):',
  '        return self._items[-1] if self._items else None',
  '',
  '    def size(self):',
  '        return len(self._items)',
);

export const TASKS = [
  {
    id: 'a01',
    lead: 'tally.py', language: 'py', run_with: 'python',
    goal: 'Add weighted counting to the EXISTING Tally in tally.py: add_weighted(key, amount) records '
      + 'an amount rather than a single occurrence, weighted_count(key) returns the recorded amount for '
      + 'a key and 0 when there is none, and weighted_total() returns the sum over all keys. Keep the '
      + 'plain counts working exactly as they do now. Run it with python.',
    analogy: 'the weighted counts work the same way as the existing plain counts',
    interface: ['add_weighted', 'weighted_count', 'weighted_total', 'amount'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing plain-count feature as the relation to parallel; '
      + 'that feature has a declaration, a recorder, a reader and an aggregate, and the new feature '
      + 'occupies the same four positions',
    structural_class: 'parallel-state-feature',
    source: a01src,
    operations: [
      { id: 'op1', intent: 'declare the parallel accumulator',
        anchor: '        self._counts = {}' + NL,
        code: '        self._weights = {}' + NL },
      { id: 'op2', intent: 'recorder, reader and aggregate for the parallel accumulator',
        anchor: '    def total(self):' + NL + '        return sum(self._counts.values())' + NL,
        code: L('',
          '    def add_weighted(self, key, amount):',
          '        self._weights[key] = self._weights.get(key, 0) + amount',
          '',
          '    def weighted_count(self, key):',
          '        return self._weights.get(key, 0)',
          '',
          '    def weighted_total(self):',
          '        return sum(self._weights.values())') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L(
      'import tally',
      't = tally.Tally()',
      't.add("a"); t.add("a"); t.add("b")',
      'assert t.count("a") == 2, t.count("a")',
      'assert t.count("z") == 0',
      'assert t.total() == 3, t.total()',
      'print("OK")'),
    delta_probe: L(
      'import tally',
      't = tally.Tally()',
      't.add_weighted("a", 5); t.add_weighted("a", 2); t.add_weighted("b", 1)',
      'assert t.weighted_count("a") == 7, t.weighted_count("a")',
      'assert t.weighted_count("z") == 0',
      'assert t.weighted_total() == 8, t.weighted_total()',
      't.add("a")',
      'assert t.count("a") == 1, t.count("a")',
      'assert t.weighted_count("a") == 7, "plain and weighted must stay separate"',
      'print("OK")'),
  },

  {
    id: 'b01',
    lead: 'stack.py', language: 'py', run_with: 'python',
    goal: 'Add snapshot and undo to the EXISTING Stack in stack.py: snapshot() marks the current '
      + 'contents, and undo() restores the contents to the most recent mark and forgets that mark. '
      + 'undo() with no mark leaves the stack unchanged. Keep push, pop, peek and size working exactly '
      + 'as they do now. Run it with python.',
    interface: ['snapshot', 'undo'],
    analogy_class: 'no_supported_analogy',
    analogy_justification: 'no existing feature in this file retains prior state - push, pop, peek and '
      + 'size are all single-step operations over one list - so there is no structural relation for the '
      + 'requested history behaviour to parallel',
    structural_class: 'novel-state-feature',
    source: b01src,
    operations: [
      { id: 'op1', intent: 'declare the history the new behaviour needs',
        anchor: '        self._items = []' + NL,
        code: '        self._marks = []' + NL },
      { id: 'op2', intent: 'mark and restore, using that history',
        anchor: '    def size(self):' + NL + '        return len(self._items)' + NL,
        code: L('',
          '    def snapshot(self):',
          '        self._marks.append(list(self._items))',
          '',
          '    def undo(self):',
          '        if self._marks:',
          '            self._items = self._marks.pop()') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L(
      'import stack',
      's = stack.Stack()',
      's.push(1); s.push(2)',
      'assert s.peek() == 2, s.peek()',
      'assert s.pop() == 2',
      'assert s.size() == 1, s.size()',
      'assert stack.Stack().peek() is None',
      'print("OK")'),
    delta_probe: L(
      'import stack',
      's = stack.Stack()',
      's.push(1)',
      's.snapshot()',
      's.push(2); s.push(3)',
      's.undo()',
      'assert s.size() == 1, s.size()',
      'assert s.peek() == 1, s.peek()',
      's.undo()',
      'assert s.size() == 1, "undo with no mark must leave the stack unchanged"',
      'print("OK")'),
  },
];
