// CONSTRAINT-GENERALIZATION FAMILY. Authored after Amendment B froze the construction procedure and
// BEFORE any deriver is touched.
//
// Built from independently stated SEMANTIC SITUATIONS, not from the derivers' code. The situation is
// written first as a sentence; the program is then written so that the sentence is true. Nothing here
// was checked against `constraints.mjs` while being authored.
//
//   id   ops  kind under test        half       the situation, stated before the program
//   g01   3   ownership_boundary     POSITIVE   a multi-line loop body inside a method: a sibling
//                                               inserted mid-loop orphans the rest of the loop
//   g02   3   ownership_boundary     NEGATIVE   flat module functions only; nothing is nested deeper
//                                               than the insertion, so nothing can be orphaned
//   g03   2   control_flow_boundary  POSITIVE   an early return at the insertion indent: anything
//                                               placed after it never runs
//   g04   2   control_flow_boundary  NEGATIVE   the only return sits inside a nested branch at a
//                                               DIFFERENT structural parent and constrains nothing
//   g05   3   symbol_availability    POSITIVE   an import-time call consumes the new symbol, so the
//                                               definition must precede it
//   g06   3   symbol_availability    NEGATIVE   the only mention is inside a function body, resolved
//                                               when that function RUNS; textual order is not a
//                                               dependency and must not become one
//
// Rule 13: operation counts are {2,3,3} on both halves, so which half a task is in is not confounded
// with transaction size.
//
// g06 is the case this project has already got wrong once, in a witness it wrote itself. A rule that
// treats any textual mention as an ordering dependency will narrow here, and every boundary it removes
// will be one that executes perfectly well.
const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL) + NL;
const Q = String.fromCharCode(34);

// ---------------------------------------------------------------------------------------------------
// g01 — OWNERSHIP, must fire. `scan` holds a for-loop whose body is several lines. A new method placed
// part-way through that loop ends the method, and the remaining loop lines are re-parented onto
// whatever follows.
const g01src = L(
  'class Counter:',
  '    def __init__(self):',
  '        self._seen = {}',
  '',
  '    def scan(self, words):',
  '        for w in words:',
  '            key = str(w).strip().lower()',
  '            if not key:',
  '                continue',
  '            self._seen[key] = self._seen.get(key, 0) + 1',
  '        return len(self._seen)',
  '',
  '    def seen_count(self, w):',
  '        return self._seen.get(str(w).strip().lower(), 0)',
);

// ---------------------------------------------------------------------------------------------------
// g02 — OWNERSHIP, must NOT fire. Every construct is a module-level def, so no body sits deeper than a
// module-level insertion. There is nothing an insertion could split.
const g02src = L(
  '# Unit conversion helpers.',
  '',
  '',
  'def to_cm(inches):',
  '    return inches * 2.54',
  '',
  '',
  'def to_inches(cm):',
  '    return cm / 2.54',
  '',
  '',
  'def round_cm(inches):',
  '    return round(to_cm(inches), 1)',
);

// ---------------------------------------------------------------------------------------------------
// g03 — CONTROL FLOW, must fire. `classify` returns early at the insertion indent; a branch placed
// after that return is unreachable no matter how correct it looks.
const g03src = L(
  'def classify(n):',
  '    if n < 0:',
  '        return ' + Q + 'negative' + Q,
  '    if n == 0:',
  '        return ' + Q + 'zero' + Q,
  '    return ' + Q + 'positive' + Q,
);

// ---------------------------------------------------------------------------------------------------
// g04 — CONTROL FLOW, must NOT fire. The file's only `return` statements live inside function bodies,
// at a structural parent that is not the module. A module-level insertion is not constrained by them
// in any way, and a rule that looks for "a terminator somewhere" will wrongly narrow here.
const g04src = L(
  '# Tiny registry.',
  '',
  'ITEMS = []',
  '',
  '',
  'def add(x):',
  '    if x is None:',
  '        return False',
  '    ITEMS.append(x)',
  '    return True',
  '',
  '',
  'def size():',
  '    return len(ITEMS)',
);

// ---------------------------------------------------------------------------------------------------
// g05 — SYMBOL AVAILABILITY, must fire. `DEFAULTS` is built at IMPORT time by calling a helper, so a
// helper defined after that line does not exist when the line runs.
const g05src = L(
  '# Settings assembly.',
  '',
  '',
  'def _base():',
  '    return {' + Q + 'retries' + Q + ': 1}',
  '',
  '',
  'DEFAULTS = _base()',
  '',
  '',
  'def get(name):',
  '    return DEFAULTS.get(name)',
);

// ---------------------------------------------------------------------------------------------------
// g06 — SYMBOL AVAILABILITY, must NOT fire. `describe` mentions the new helper inside its body. Python
// resolves that name when `describe` RUNS, not when the module loads, so the definition may sit
// anywhere at module level. A rule that treats a textual mention as a dependency will narrow here and
// every boundary it removes will execute perfectly well.
const g06src = L(
  '# Report formatting.',
  '',
  '',
  'def title(s):',
  '    return str(s).strip().upper()',
  '',
  '',
  'def describe(s):',
  '    return title(s) + ' + Q + ' | ' + Q + ' + _suffix(s)',
  '',
  '',
  'def plain(s):',
  '    return str(s).strip()',
);

export const TASKS5 = [
  {
    id: 'g01',
    lead: 'counter.py', language: 'py', run_with: 'python',
    goal: 'Add rare-word tracking to the EXISTING Counter in counter.py: mark_rare(word) records a '
      + 'word as rare, is_rare(word) reports whether it was recorded, and rare_count() returns how '
      + 'many have been recorded. Words are matched after stripping and lowercasing, the same as scan '
      + 'does. Keep scan and seen_count working exactly as they do now. Run it with python.',
    analogy: 'the rare-word set works the same way as the existing seen counts',
    interface: ['mark_rare', 'is_rare', 'rare_count', 'word'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing seen counts as the relation to parallel; that '
      + 'feature has a declaration, a recorder and a reader, and the new feature occupies the same '
      + 'positions',
    structural_class: 'parallel-state-feature',
    source: g01src,
    operations: [
      { id: 'op1', intent: 'declare the parallel store',
        anchor: '        self._seen = {}' + NL,
        code: '        self._rare = set()' + NL },
      { id: 'op2', intent: 'recorder for the parallel store',
        anchor: '        return len(self._seen)' + NL,
        code: L('',
          '    def mark_rare(self, word):',
          '        self._rare.add(str(word).strip().lower())') },
      { id: 'op3', intent: 'readers over the parallel store',
        anchor: '    def seen_count(self, w):' + NL
          + '        return self._seen.get(str(w).strip().lower(), 0)' + NL,
        code: L('',
          '    def is_rare(self, word):',
          '        return str(word).strip().lower() in self._rare',
          '',
          '    def rare_count(self):',
          '        return len(self._rare)') },
    ],
    dependency_edges: [['op1', 'op2'], ['op1', 'op3']],
    preservation_probe: L(
      'import counter',
      'c = counter.Counter()',
      'assert c.scan([" A ", "a", "", "b"]) == 2, c.scan([" A ", "a", "", "b"])',
      'assert c.seen_count("A") == 2, c.seen_count("A")',
      'assert c.seen_count("zz") == 0',
      'print("OK")'),
    delta_probe: L(
      'import counter',
      'c = counter.Counter()',
      'assert c.rare_count() == 0, c.rare_count()',
      'c.mark_rare(" Xy "); c.mark_rare("xy"); c.mark_rare("q")',
      'assert c.rare_count() == 2, c.rare_count()',
      'assert c.is_rare("XY")',
      'assert not c.is_rare("zz")',
      'c.scan(["a", "a"])',
      'assert c.rare_count() == 2, "the two stores must stay separate"',
      'assert c.seen_count("a") == 2',
      'print("OK")'),
  },

  {
    id: 'g02',
    lead: 'units.py', language: 'py', run_with: 'python',
    goal: 'Add millimetre conversion to the EXISTING units.py: to_mm(inches) converts inches to '
      + 'millimetres, from_mm(mm) converts millimetres back to inches, and round_mm(inches) gives the '
      + 'millimetre value rounded to one decimal place. Keep to_cm, to_inches and round_cm working '
      + 'exactly as they do now. Run it with python.',
    analogy: 'the millimetre helpers work the same way as the existing centimetre helpers',
    interface: ['to_mm', 'from_mm', 'round_mm'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing centimetre helpers as the relation to '
      + 'parallel; that feature has a forward conversion, a reverse conversion and a rounded form, and '
      + 'the new feature occupies the same three positions',
    structural_class: 'parallel-variant-feature',
    source: g02src,
    operations: [
      { id: 'op1', intent: 'the forward conversion',
        anchor: 'def to_cm(inches):' + NL + '    return inches * 2.54' + NL,
        code: L('', '', 'def to_mm(inches):', '    return inches * 25.4') },
      { id: 'op2', intent: 'the reverse conversion',
        anchor: 'def to_inches(cm):' + NL + '    return cm / 2.54' + NL,
        code: L('', '', 'def from_mm(mm):', '    return mm / 25.4') },
      { id: 'op3', intent: 'the rounded form',
        anchor: 'def round_cm(inches):' + NL + '    return round(to_cm(inches), 1)' + NL,
        code: L('', '', 'def round_mm(inches):', '    return round(to_mm(inches), 1)') },
    ],
    dependency_edges: [['op1', 'op3']],
    preservation_probe: L(
      'import units',
      'assert units.to_cm(1) == 2.54, units.to_cm(1)',
      'assert abs(units.to_inches(2.54) - 1) < 1e-9',
      'assert units.round_cm(1) == 2.5, units.round_cm(1)',
      'print("OK")'),
    delta_probe: L(
      'import units',
      'assert units.to_mm(1) == 25.4, units.to_mm(1)',
      'assert abs(units.from_mm(25.4) - 1) < 1e-9',
      'assert units.round_mm(1) == 25.4, units.round_mm(1)',
      'assert units.to_cm(1) == 2.54, "the existing helpers must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'g03',
    lead: 'classify.py', language: 'py', run_with: 'python',
    goal: 'Add a small-number case to the EXISTING classify.py: a positive number below 10 must be '
      + 'reported as "small" instead of "positive". Everything else must keep working exactly as it '
      + 'does now. Run it with python.',
    analogy: 'the small case is written the same way as the existing zero case',
    interface: ['small'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing zero case as the relation to parallel; that '
      + 'case is a guarded branch returning a label, and the new case occupies the same position',
    structural_class: 'parallel-variant-feature',
    source: g03src,
    operations: [
      { id: 'op1', intent: 'the guarded branch for the new case',
        anchor: '    if n == 0:' + NL + '        return ' + Q + 'zero' + Q + NL,
        code: L('    if n < 10:', '        return ' + Q + 'small' + Q) },
      { id: 'op2', intent: 'a reader that reports whether the new case applies',
        anchor: '    return ' + Q + 'positive' + Q + NL,
        code: L('', '', 'def is_small(n):', '    return classify(n) == ' + Q + 'small' + Q) },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L(
      'import classify',
      'assert classify.classify(-5) == "negative", classify.classify(-5)',
      'assert classify.classify(0) == "zero"',
      'assert classify.classify(50) == "positive", classify.classify(50)',
      'print("OK")'),
    delta_probe: L(
      'import classify',
      'assert classify.classify(3) == "small", classify.classify(3)',
      'assert classify.classify(50) == "positive", classify.classify(50)',
      'assert classify.classify(0) == "zero", "zero must still win over small"',
      'assert classify.is_small(3)',
      'assert not classify.is_small(50)',
      'print("OK")'),
  },

  {
    id: 'g04',
    lead: 'registry.py', language: 'py', run_with: 'python',
    goal: 'Add clearing and resetting to the EXISTING registry.py: clear() empties the registry and '
      + 'returns how many entries were removed, and reset(items) empties it and then adds each of the '
      + 'given items, returning the new size. Keep add and size working exactly as they do now. '
      + 'Run it with python.',
    analogy: 'clearing and resetting work the same way as the existing size helper',
    interface: ['clear', 'reset', 'items'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing size helper as the relation to parallel; that '
      + 'feature is a module-level function reading the shared list, and the new feature occupies the '
      + 'same position over the same state',
    structural_class: 'parallel-state-feature',
    source: g04src,
    operations: [
      { id: 'op1', intent: 'the clearing operation over the shared list',
        anchor: 'def size():' + NL + '    return len(ITEMS)' + NL,
        code: L('', '', 'def clear():', '    n = len(ITEMS)', '    del ITEMS[:]', '    return n') },
      { id: 'op2', intent: 'the reset operation, built on the clearing operation',
        anchor: 'ITEMS = []' + NL,
        code: L('', '', 'def reset(items):', '    clear()', '    for x in items:',
          '        add(x)', '    return size()') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L(
      'import registry',
      'assert registry.add(1)',
      'assert not registry.add(None)',
      'assert registry.size() == 1, registry.size()',
      'print("OK")'),
    delta_probe: L(
      'import registry',
      'registry.add(1); registry.add(2)',
      'assert registry.clear() == 2, "clear reports how many were removed"',
      'assert registry.size() == 0, registry.size()',
      'assert registry.reset([7, 8, 9]) == 3, "reset empties then adds"',
      'assert registry.size() == 3, registry.size()',
      'assert registry.reset([]) == 0',
      'assert registry.add(3) and registry.size() == 1, "the existing helpers must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'g05',
    lead: 'settings.py', language: 'py', run_with: 'python',
    goal: 'Add timeout defaults to the EXISTING settings.py: a helper supplies a timeout of 30, that '
      + 'value must be present in DEFAULTS under the name "timeout" when the module is imported, and '
      + 'timeout_of() returns it. Keep the retries default and get working exactly as they do now. '
      + 'Run it with python.',
    analogy: 'the timeout default is assembled the same way as the existing base defaults',
    interface: ['timeout', 'timeout_of'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing base defaults as the relation to parallel; '
      + 'that feature is a helper whose result is merged into DEFAULTS at import time and read through '
      + 'an accessor, and the new feature occupies the same positions',
    structural_class: 'parallel-state-feature',
    source: g05src,
    operations: [
      { id: 'op1', intent: 'the helper supplying the new default',
        anchor: 'def _base():' + NL + '    return {' + Q + 'retries' + Q + ': 1}' + NL,
        code: L('', '', 'def _timeouts():', '    return {' + Q + 'timeout' + Q + ': 30}') },
      { id: 'op2', intent: 'merge the new default at import time',
        anchor: 'DEFAULTS = _base()' + NL,
        code: 'DEFAULTS.update(_timeouts())' + NL },
      { id: 'op3', intent: 'the accessor for the new default',
        anchor: 'def get(name):' + NL + '    return DEFAULTS.get(name)' + NL,
        code: L('', '', 'def timeout_of():', '    return DEFAULTS.get(' + Q + 'timeout' + Q + ')') },
    ],
    dependency_edges: [['op1', 'op2'], ['op2', 'op3']],
    preservation_probe: L(
      'import settings',
      'assert settings.DEFAULTS.get("retries") == 1, settings.DEFAULTS',
      'assert settings.get("retries") == 1',
      'assert settings.get("nope") is None',
      'print("OK")'),
    delta_probe: L(
      'import settings',
      'assert settings.DEFAULTS.get("timeout") == 30, settings.DEFAULTS',
      'assert settings.timeout_of() == 30, settings.timeout_of()',
      'assert settings.get("timeout") == 30',
      'assert settings.get("retries") == 1, "the existing default must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'g06',
    lead: 'report.py', language: 'py', run_with: 'python',
    goal: 'Add the missing suffix helper to the EXISTING report.py: _suffix(s) returns "long" when the '
      + 'stripped text is longer than five characters and "short" otherwise, so that describe works. '
      + 'Also add suffix_of(s) returning the same value, and blank(s) reporting whether the stripped '
      + 'text is empty. Keep title and plain working exactly as they do now. Run it with python.',
    analogy: 'the suffix helper works the same way as the existing title helper',
    interface: ['suffix_of', 'blank'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing title helper as the relation to parallel; that '
      + 'feature is a module-level function transforming the stripped text, and the new helpers occupy '
      + 'the same position',
    structural_class: 'parallel-state-feature',
    source: g06src,
    operations: [
      { id: 'op1', intent: 'the helper that describe already refers to',
        anchor: 'def title(s):' + NL + '    return str(s).strip().upper()' + NL,
        code: L('', '', 'def _suffix(s):',
          '    return ' + Q + 'long' + Q + ' if len(str(s).strip()) > 5 else ' + Q + 'short' + Q) },
      { id: 'op2', intent: 'a public accessor for the same value',
        anchor: 'def plain(s):' + NL + '    return str(s).strip()' + NL,
        code: L('', '', 'def suffix_of(s):', '    return _suffix(s)') },
      { id: 'op3', intent: 'an emptiness reader over the same stripped text',
        anchor: 'def describe(s):' + NL + '    return title(s) + ' + Q + ' | ' + Q + ' + _suffix(s)' + NL,
        code: L('', '', 'def blank(s):', '    return str(s).strip() == ' + Q + Q) },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L(
      'import report',
      'assert report.title("  ab ") == "AB", report.title("  ab ")',
      'assert report.plain("  ab ") == "ab"',
      'print("OK")'),
    delta_probe: L(
      'import report',
      'assert report.describe("abcdefg") == "ABCDEFG | long", report.describe("abcdefg")',
      'assert report.describe("ab") == "AB | short", report.describe("ab")',
      'assert report.suffix_of("abcdefg") == "long"',
      'assert report.blank("   ")',
      'assert not report.blank(" a ")',
      'assert report.plain(" a ") == "a", "the existing helpers must be unchanged"',
      'print("OK")'),
  },
];
