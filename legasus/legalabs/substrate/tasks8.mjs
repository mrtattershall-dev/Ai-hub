// SCOPE AND CONTINUATION FAMILY. Authored blind against the procedure frozen in GATE6_PROCEDURE.md,
// before any deriver changes. Running frozen revision 5 here is the prospective test of the two rules
// that currently have development standing only.
//
//   id   ops  case                                            must
//   j01   3   op inside a body using a PARAMETER of that unit  resolve as enclosing scope, narrow nothing
//   j02   3   op inside a body using a LOCAL of that unit      same, alongside a planned provider
//   j03   2   hand-written MULTI-LINE literal                  positions inside it removed
//   j04   3   module-level op using a name that is ALSO a      resolve as the MODULE binding and
//             parameter of some function                       ORDER against it - not enclosing scope
//   j05   3   brackets inside strings and comments             NOT treated as open continuations
//   j06   2   balanced literals and nested calls on one line   NOT treated as open continuations
//
// Operation counts are {2,3,3} on the must-fire half (j01 j02 j03) and {2,3,3} on the must-not half
// (j06 j04 j05), so which half a task is in is not confounded with transaction size.
//
// ONE FROZEN CASE PROVED UNCONSTRUCTIBLE and is recorded rather than forced. The procedure asked for a
// requirement "bound nowhere" that must stay UNRESOLVED. In a program that actually runs, an immediate
// requirement bound nowhere raises NameError, so the reference cannot pass its own delta probe. The
// only runnable forms of "no supported provider" are an import (already tested by i01/i02) and a
// builtin (removed before it becomes a requirement at all). That case therefore has SYNTHETIC coverage
// only - scope.test.mjs exercises it directly - and cannot have family coverage. Recorded as a limit
// of the case type, not as a gap in the rule.
//
// PATH SENSITIVITY for j03: the multi-line literal sits at MODULE level, so no body encloses those
// positions and ownership_boundary cannot reach them, and no terminator precedes them at module
// indent so control_flow_boundary cannot either. expression_continuation is the only mechanism that
// can remove them. The literal is written into the SOURCE BY HAND - not produced by an intra-line
// operation - so the family tests the program rather than the patch reconstruction.
const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL) + NL;
const Q = String.fromCharCode(34);

const j01src = L(
  'class Router:',
  '    def __init__(self):',
  '        self._routes = {}',
  '',
  '    def add(self, path, handler):',
  '        self._routes[path] = handler',
  '',
  '    def resolve(self, path):',
  '        if path in self._routes:',
  '            return self._routes[path]',
  '        return None',
);

const j02src = L(
  '# Aggregation.',
  '',
  '',
  'def summarize(items):',
  '    total = 0',
  '    for it in items:',
  '        total += int(it)',
  '    return total',
  '',
  '',
  'def count(items):',
  '    return len(items)',
);

const j03src = L(
  '# Palette.',
  '',
  'COLORS = [',
  '    ' + Q + 'red' + Q + ',',
  '    ' + Q + 'green' + Q + ',',
  ']',
  '',
  'DEFAULT = ' + Q + 'red' + Q,
  '',
  '',
  'def known(name):',
  '    return name in COLORS',
);

const j04src = L(
  '# Messaging.',
  '',
  'PREFIX = ' + Q + 'msg' + Q,
  '',
  '',
  'def send(channel, msg):',
  '    return str(channel) + ' + Q + ':' + Q + ' + str(msg)',
  '',
  '',
  'def label():',
  '    return PREFIX',
);

const j05src = L(
  '# Patterns with [brackets] in this comment.',
  '',
  'PATTERNS = [' + Q + 'a[b' + Q + ', ' + Q + 'c)d' + Q + ']',
  '',
  'LABEL = ' + Q + 'see ] here' + Q,
  '',
  '',
  'def size():',
  '    return len(PATTERNS)',
);

const j06src = L(
  '# Nested calls.',
  '',
  'BASE = max(1, min(4, 3))',
  '',
  'PAIR = (BASE, [1, 2])',
  '',
  '',
  'def base():',
  '    return BASE',
);

export const TASKS8 = [
  {
    id: 'j01',
    lead: 'router.py', language: 'py', run_with: 'python',
    goal: 'Add aliasing to the EXISTING Router in router.py: alias(frm, to) records that one path '
      + 'stands for another, and resolve must return the handler registered for the target when the '
      + 'requested path is an alias. Keep add and direct resolution working exactly as they do now. '
      + 'Run it with python.',
    analogy: 'the alias table works the same way as the existing routes table',
    interface: ['alias', 'frm', 'to'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing routes table as the relation to parallel; that '
      + 'feature has a declaration, a recorder and a reader, and the new feature occupies the same '
      + 'positions',
    structural_class: 'parallel-state-feature',
    source: j01src,
    operations: [
      { id: 'op1', intent: 'declare the parallel table',
        anchor: '        self._routes = {}' + NL,
        code: '        self._aliases = {}' + NL },
      { id: 'op2', intent: 'a branch inside resolve, using that unit PARAMETER',
        anchor: '        if path in self._routes:' + NL + '            return self._routes[path]' + NL,
        code: L('        if path in self._aliases:',
          '            return self._routes.get(self._aliases[path])') },
      { id: 'op3', intent: 'the recorder for the parallel table',
        anchor: '    def add(self, path, handler):' + NL + '        self._routes[path] = handler' + NL,
        code: L('', '    def alias(self, frm, to):', '        self._aliases[frm] = to') },
    ],
    dependency_edges: [['op1', 'op2'], ['op1', 'op3']],
    preservation_probe: L('import router',
      'r = router.Router()',
      'r.add("/a", "A")',
      'assert r.resolve("/a") == "A", r.resolve("/a")',
      'assert r.resolve("/zz") is None',
      'print("OK")'),
    delta_probe: L('import router',
      'r = router.Router()',
      'r.add("/a", "A")',
      'r.alias("/b", "/a")',
      'assert r.resolve("/b") == "A", r.resolve("/b")',
      'assert r.resolve("/a") == "A", "direct resolution must be unchanged"',
      'assert r.resolve("/zz") is None',
      'print("OK")'),
  },

  {
    id: 'j02',
    lead: 'aggregation.py', language: 'py', run_with: 'python',
    goal: 'Add scaling to the EXISTING aggregation.py: SCALE is 2, summarize multiplies its result by '
      + 'SCALE, and scaled_count(items) returns the item count multiplied by SCALE. Keep count working '
      + 'exactly as it does now. Run it with python.',
    analogy: 'the scaling works the same way as the existing summarize accumulation',
    interface: ['SCALE', 'scaled_count'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing accumulation as the relation to parallel; that '
      + 'feature computes over the shared items at module level, and the new behaviour occupies the '
      + 'same position',
    structural_class: 'parallel-state-feature',
    source: j02src,
    operations: [
      { id: 'op1', intent: 'the module constant',
        anchor: '# Aggregation.' + NL,
        code: L('', 'SCALE = 2') },
      { id: 'op2', intent: 'a statement inside summarize using its LOCAL and the planned constant',
        anchor: '    for it in items:' + NL + '        total += int(it)' + NL,
        code: '    total = total * SCALE' + NL },
      { id: 'op3', intent: 'a module-level function using the planned constant',
        anchor: 'def count(items):' + NL + '    return len(items)' + NL,
        code: L('', '', 'def scaled_count(items):', '    return count(items) * SCALE') },
    ],
    dependency_edges: [['op1', 'op2'], ['op1', 'op3']],
    preservation_probe: L('import aggregation',
      'assert aggregation.count([1, 2, 3]) == 3, aggregation.count([1, 2, 3])',
      'print("OK")'),
    delta_probe: L('import aggregation',
      'assert aggregation.SCALE == 2',
      'assert aggregation.summarize(["1", "2"]) == 6, aggregation.summarize(["1", "2"])',
      'assert aggregation.scaled_count([1, 2]) == 4, aggregation.scaled_count([1, 2])',
      'assert aggregation.count([1, 2]) == 2, "the existing helper must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'j03',
    lead: 'palette.py', language: 'py', run_with: 'python',
    goal: 'Add a fallback lookup to the EXISTING palette.py: pick(name) returns the name when it is a '
      + 'known colour and DEFAULT otherwise, and safe(name) reports whether pick would fall back. Keep '
      + 'COLORS, DEFAULT and known working exactly as they do now. Run it with python.',
    analogy: 'the fallback lookup works the same way as the existing known check',
    interface: ['pick', 'safe'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing known check as the relation to parallel; that '
      + 'feature is a module-level function reading the shared collection, and the new functions '
      + 'occupy the same position',
    structural_class: 'parallel-state-feature',
    source: j03src,
    operations: [
      { id: 'op1', intent: 'the fallback lookup',
        anchor: 'def known(name):' + NL + '    return name in COLORS' + NL,
        code: L('', '', 'def pick(name):', '    return name if known(name) else DEFAULT') },
      { id: 'op2', intent: 'the reader over it',
        anchor: 'DEFAULT = ' + Q + 'red' + Q + NL,
        code: L('', '', 'def safe(name):', '    return pick(name) == DEFAULT') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L('import palette',
      'assert palette.COLORS == ["red", "green"], palette.COLORS',
      'assert palette.DEFAULT == "red"',
      'assert palette.known("green")',
      'assert not palette.known("blue")',
      'print("OK")'),
    delta_probe: L('import palette',
      'assert palette.pick("green") == "green", palette.pick("green")',
      'assert palette.pick("blue") == "red", palette.pick("blue")',
      'assert palette.safe("blue")',
      'assert not palette.safe("green")',
      'assert palette.known("red"), "the existing helper must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'j04',
    lead: 'messaging.py', language: 'py', run_with: 'python',
    goal: 'Add a banner to the EXISTING messaging.py: BANNER holds the prefix followed by a dash when '
      + 'the module is imported, and banner() returns it. Keep PREFIX, send and label working exactly '
      + 'as they do now. Run it with python.',
    analogy: 'the banner is assembled the same way as the existing prefix label',
    interface: ['BANNER', 'banner'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing prefix label as the relation to parallel; that '
      + 'feature is a module constant read by a function, and the new value occupies the same position',
    structural_class: 'parallel-state-feature',
    source: j04src,
    operations: [
      { id: 'op1', intent: 'a module-level statement requiring a name that is ALSO a function parameter',
        anchor: 'def label():' + NL + '    return PREFIX' + NL,
        code: L('', '', 'BANNER = PREFIX + ' + Q + '-' + Q) },
      { id: 'op2', intent: 'the accessor',
        anchor: '# Messaging.' + NL,
        code: L('', 'def banner():', '    return BANNER') },
      { id: 'op3', intent: 'a second reader over the same value',
        anchor: 'def send(channel, msg):' + NL
          + '    return str(channel) + ' + Q + ':' + Q + ' + str(msg)' + NL,
        code: L('', '', 'def loud():', '    return banner().upper()') },
    ],
    dependency_edges: [['op1', 'op2'], ['op2', 'op3']],
    preservation_probe: L('import messaging',
      'assert messaging.PREFIX == "msg"',
      'assert messaging.send("a", "b") == "a:b", messaging.send("a", "b")',
      'assert messaging.label() == "msg"',
      'print("OK")'),
    delta_probe: L('import messaging',
      'assert messaging.BANNER == "msg-", messaging.BANNER',
      'assert messaging.banner() == "msg-", messaging.banner()',
      'assert messaging.loud() == "MSG-", messaging.loud()',
      'assert messaging.send("a", "b") == "a:b", "the existing helper must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'j05',
    lead: 'patterns.py', language: 'py', run_with: 'python',
    goal: 'Add pattern counting to the EXISTING patterns.py: TOTAL holds the number of patterns when '
      + 'the module is imported, first() returns the first pattern, and described() returns the label '
      + 'followed by the total. Keep PATTERNS, LABEL and size working exactly as they do now. Run it '
      + 'with python.',
    analogy: 'the total is assembled the same way as the existing size helper',
    interface: ['TOTAL', 'first', 'described'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing size helper as the relation to parallel; that '
      + 'feature reads the shared collection at module level, and the new values occupy the same '
      + 'position',
    structural_class: 'parallel-state-feature',
    source: j05src,
    operations: [
      { id: 'op1', intent: 'the total, bound at import time',
        anchor: 'PATTERNS = [' + Q + 'a[b' + Q + ', ' + Q + 'c)d' + Q + ']' + NL,
        code: L('', 'TOTAL = len(PATTERNS)') },
      { id: 'op2', intent: 'a reader over the collection',
        anchor: 'def size():' + NL + '    return len(PATTERNS)' + NL,
        code: L('', '', 'def first():', '    return PATTERNS[0]') },
      { id: 'op3', intent: 'a reader over the label and the total',
        anchor: 'LABEL = ' + Q + 'see ] here' + Q + NL,
        code: L('', '', 'def described():', '    return LABEL + str(TOTAL)') },
    ],
    dependency_edges: [['op1', 'op3']],
    preservation_probe: L('import patterns',
      'assert patterns.PATTERNS == ["a[b", "c)d"], patterns.PATTERNS',
      'assert patterns.LABEL == "see ] here", patterns.LABEL',
      'assert patterns.size() == 2, patterns.size()',
      'print("OK")'),
    delta_probe: L('import patterns',
      'assert patterns.TOTAL == 2, patterns.TOTAL',
      'assert patterns.first() == "a[b", patterns.first()',
      'assert patterns.described() == "see ] here2", patterns.described()',
      'assert patterns.size() == 2, "the existing helper must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'j06',
    lead: 'nested.py', language: 'py', run_with: 'python',
    goal: 'Add a doubled value to the EXISTING nested.py: DOUBLE holds twice BASE when the module is '
      + 'imported, and double() returns it. Keep BASE, PAIR and base working exactly as they do now. '
      + 'Run it with python.',
    analogy: 'the doubled value is assembled the same way as the existing base value',
    interface: ['DOUBLE', 'double'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing base value as the relation to parallel; that '
      + 'feature is a module constant read by a function, and the new value occupies the same position',
    structural_class: 'parallel-state-feature',
    source: j06src,
    operations: [
      { id: 'op1', intent: 'the doubled value',
        anchor: 'PAIR = (BASE, [1, 2])' + NL,
        code: L('', 'DOUBLE = BASE * 2') },
      { id: 'op2', intent: 'the accessor',
        anchor: 'def base():' + NL + '    return BASE' + NL,
        code: L('', '', 'def double():', '    return DOUBLE') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L('import nested',
      'assert nested.BASE == 3, nested.BASE',
      'assert nested.PAIR == (3, [1, 2]), nested.PAIR',
      'assert nested.base() == 3',
      'print("OK")'),
    delta_probe: L('import nested',
      'assert nested.DOUBLE == 6, nested.DOUBLE',
      'assert nested.double() == 6, nested.double()',
      'assert nested.base() == 3, "the existing helper must be unchanged"',
      'print("OK")'),
  },
];
