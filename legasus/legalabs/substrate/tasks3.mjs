// HOLDOUT FAMILY. The first six tasks are spent: they were used as development data while the concern
// graph, the role witnesses and the site semantics were being built, so the selector has seen them and
// cannot be measured on them again.
//
// AUTHORED BLIND. These were written from the fifteen construction rules only. The frozen selector was
// not run against any of these sources while they were being authored, and no source was adjusted after
// seeing a selector output. That restraint is the entire value of a holdout - a family tuned until the
// selector does well on it measures nothing but the tuning.
//
// Rule 13 matching, so analogy class is not confounded with size:
//
//     ops   analogy_specified               no_supported_analogy
//      2    c01 parallel waitlist           d01 repeat counting
//      3    c02 parallel attempt tracking   d02 quoted spans across tokens
//      4    c03 parallel scroll event       d03 bounded link resolution
//
// Domains are disjoint from the spent family: no counter, stack, metrics, config, csv or scanner.
const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL) + NL;
const Q = String.fromCharCode(34);       // a literal double quote, kept out of the JS string soup
const DQ = "'" + Q + "'";                // the Python literal '"'

// ---------------------------------------------------------------------------------------------------
// c01 — ANALOGY. An active list with a joiner, a count and a membership test. The waitlist is asked for
// as the same three positions over a second list.
const c01src = L(
  'class Roster:',
  '    def __init__(self):',
  '        self._active = []',
  '',
  '    def join(self, name):',
  '        if name not in self._active:',
  '            self._active.append(name)',
  '',
  '    def active_count(self):',
  '        return len(self._active)',
  '',
  '    def is_active(self, name):',
  '        return name in self._active',
);

// ---------------------------------------------------------------------------------------------------
// d01 — NO ANALOGUE. Three pure functions of their argument. Nothing in this file remembers anything
// between calls, so counting repeats has no structural precedent here.
const d01src = L(
  '# Small text helpers.',
  '',
  '',
  'def normalize(s):',
  '    return ' + Q + ' ' + Q + '.join(str(s).split()).lower()',
  '',
  '',
  'def word_count(s):',
  '    return len(normalize(s).split())',
  '',
  '',
  'def initials(s):',
  '    return ' + Q + Q + '.join(w[0] for w in normalize(s).split() if w)',
);

// ---------------------------------------------------------------------------------------------------
// c02 — ANALOGY. A per-student score across a declaration, a recorder, a reader and an aggregate.
const c02src = L(
  'class Grades:',
  '    def __init__(self):',
  '        self._scores = {}',
  '',
  '    def record(self, student, score):',
  '        self._scores[student] = self._scores.get(student, 0) + score',
  '',
  '    def score_of(self, student):',
  '        return self._scores.get(student, 0)',
  '',
  '    def best(self):',
  '        if not self._scores:',
  '            return None',
  '        return max(sorted(self._scores), key=lambda s: self._scores[s])',
);

// ---------------------------------------------------------------------------------------------------
// d02 — NO ANALOGUE. Every piece is decided in isolation; the loop carries nothing from one iteration to
// the next, so a span that runs across several pieces has nothing to parallel.
const d02src = L(
  'def split_tokens(text):',
  '    out = []',
  '    for raw in str(text).split(' + Q + ' ' + Q + '):',
  '        piece = raw.strip()',
  '        if not piece:',
  '            continue',
  '        out.append(piece)',
  '    return out',
);

// ---------------------------------------------------------------------------------------------------
// c03 — ANALOGY. The key event type participates in four places: the valid-type list, the label map, its
// own renderer, and its branch of the dispatcher.
const c03src = L(
  'EVENT_TYPES = [' + Q + 'click' + Q + ', ' + Q + 'key' + Q + ']',
  '',
  'EVENT_LABELS = {' + Q + 'click' + Q + ': ' + Q + 'mouse click' + Q + ', ' + Q + 'key' + Q + ': ' + Q + 'key press' + Q + '}',
  '',
  '',
  'def _render_click(e):',
  '    return ' + Q + 'click at ' + Q + ' + str(e.get(' + Q + 'x' + Q + ', 0)) + ' + Q + ',' + Q + ' + str(e.get(' + Q + 'y' + Q + ', 0))',
  '',
  '',
  'def _render_key(e):',
  '    return ' + Q + 'key ' + Q + ' + str(e.get(' + Q + 'code' + Q + ', ' + Q + Q + '))',
  '',
  '',
  'def label(t):',
  '    return EVENT_LABELS.get(t, ' + Q + 'unknown' + Q + ')',
  '',
  '',
  'def valid_types(types):',
  '    return all(t in EVENT_TYPES for t in types)',
  '',
  '',
  'def render(e):',
  '    t = e.get(' + Q + 'type' + Q + ')',
  '    if t == ' + Q + 'click' + Q + ':',
  '        return _render_click(e)',
  '    if t == ' + Q + 'key' + Q + ':',
  '        return _render_key(e)',
  '    return ' + Q + 'unknown event' + Q,
);

// ---------------------------------------------------------------------------------------------------
// d03 — NO ANALOGUE. Every helper is a single-step transformation of its arguments. Nothing here repeats
// until a fixed point and nothing signals failure, so bounded resolution has no precedent to copy.
const d03src = L(
  '# Path helpers.',
  '',
  '',
  'def clean(p):',
  '    return str(p).strip().strip(' + Q + '/' + Q + ')',
  '',
  '',
  'def join_path(a, b):',
  '    left = clean(a)',
  '    right = clean(b)',
  '    if not left:',
  '        return right',
  '    if not right:',
  '        return left',
  '    return left + ' + Q + '/' + Q + ' + right',
  '',
  '',
  'def depth(p):',
  '    c = clean(p)',
  '    return len(c.split(' + Q + '/' + Q + ')) if c else 0',
);

export const TASKS3 = [
  {
    id: 'c01',
    lead: 'roster.py', language: 'py', run_with: 'python',
    goal: 'Add a waitlist to the EXISTING Roster in roster.py: wait(name) puts a name on the waitlist '
      + 'without repeating it, waiting_count() returns how many names are on it, and is_waiting(name) '
      + 'reports whether a name is on it. Keep join, active_count and is_active working exactly as they '
      + 'do now, and keep the two lists separate. Run it with python.',
    analogy: 'the waitlist works the same way as the existing active list',
    interface: ['wait', 'waiting_count', 'is_waiting'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing active list as the relation to parallel; that '
      + 'feature has a declaration, a joiner, a count and a membership test, and the new feature '
      + 'occupies the same positions',
    structural_class: 'parallel-state-feature',
    source: c01src,
    operations: [
      { id: 'op1', intent: 'declare the parallel list',
        anchor: '        self._active = []' + NL,
        code: '        self._waiting = []' + NL },
      { id: 'op2', intent: 'joiner, count and membership test for the parallel list',
        anchor: '    def is_active(self, name):' + NL + '        return name in self._active' + NL,
        code: L('',
          '    def wait(self, name):',
          '        if name not in self._waiting:',
          '            self._waiting.append(name)',
          '',
          '    def waiting_count(self):',
          '        return len(self._waiting)',
          '',
          '    def is_waiting(self, name):',
          '        return name in self._waiting') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L(
      'import roster',
      'r = roster.Roster()',
      'r.join("a"); r.join("a"); r.join("b")',
      'assert r.active_count() == 2, r.active_count()',
      'assert r.is_active("a")',
      'assert not r.is_active("z")',
      'print("OK")'),
    delta_probe: L(
      'import roster',
      'r = roster.Roster()',
      'r.wait("a"); r.wait("a"); r.wait("b")',
      'assert r.waiting_count() == 2, r.waiting_count()',
      'assert r.is_waiting("a")',
      'assert not r.is_waiting("z")',
      'r.join("c")',
      'assert r.active_count() == 1, r.active_count()',
      'assert r.waiting_count() == 2, "the two lists must stay separate"',
      'assert not r.is_waiting("c")',
      'print("OK")'),
  },

  {
    id: 'd01',
    lead: 'text.py', language: 'py', run_with: 'python',
    goal: 'Add repeat counting to the EXISTING text.py: counted(s) returns how many times a string '
      + 'equal to s after normalization has been passed to counted so far, counting the current call, '
      + 'so the first call returns 1. Keep normalize, word_count and initials working exactly as they '
      + 'do now. Run it with python.',
    interface: ['counted'],
    analogy_class: 'no_supported_analogy',
    analogy_justification: 'no existing function in this file retains anything between calls - '
      + 'normalize, word_count and initials are each a pure transformation of their argument - so there '
      + 'is no structural relation for the requested across-call memory to parallel',
    structural_class: 'novel-state-feature',
    source: d01src,
    operations: [
      { id: 'op1', intent: 'declare the across-call store the new behaviour needs',
        anchor: '# Small text helpers.' + NL,
        code: L('', '_SEEN = {}') },
      { id: 'op2', intent: 'the counting function, using that store',
        anchor: 'def initials(s):' + NL
          + '    return ' + Q + Q + '.join(w[0] for w in normalize(s).split() if w)' + NL,
        code: L('',
          '',
          'def counted(s):',
          '    key = normalize(s)',
          '    _SEEN[key] = _SEEN.get(key, 0) + 1',
          '    return _SEEN[key]') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L(
      'import text',
      'assert text.normalize("  A  b ") == "a b", text.normalize("  A  b ")',
      'assert text.word_count("a b c") == 3',
      'assert text.initials("alpha beta") == "ab", text.initials("alpha beta")',
      'print("OK")'),
    delta_probe: L(
      'import text',
      'assert text.counted("a b") == 1, text.counted("a b")',
      'assert text.counted("A   B") == 2, "normalized strings are the same key"',
      'assert text.counted("c") == 1',
      'assert text.counted("a b") == 3',
      'assert text.word_count("a b") == 2, "the existing helpers must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'c02',
    lead: 'grades.py', language: 'py', run_with: 'python',
    goal: 'Add attempt tracking to the EXISTING Grades in grades.py: record_attempt(student, n) adds n '
      + 'attempts for a student, attempts_of(student) returns the total recorded for that student and 0 '
      + 'when there is none, and most_attempts() returns the student with the most attempts, or None '
      + 'when nothing has been recorded. Keep record, score_of and best working exactly as they do now. '
      + 'Run it with python.',
    analogy: 'the attempt tracking works the same way as the existing score tracking',
    interface: ['record_attempt', 'attempts_of', 'most_attempts'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing score tracking as the relation to parallel; '
      + 'that feature has a declaration, a recorder, a per-key reader and an aggregate over all keys, '
      + 'and the new feature occupies the same four positions',
    structural_class: 'parallel-state-feature',
    source: c02src,
    operations: [
      { id: 'op1', intent: 'declare the parallel accumulator',
        anchor: '        self._scores = {}' + NL,
        code: '        self._attempts = {}' + NL },
      { id: 'op2', intent: 'recorder and per-key reader for the parallel accumulator',
        anchor: '    def score_of(self, student):' + NL + '        return self._scores.get(student, 0)' + NL,
        code: L('',
          '    def record_attempt(self, student, n):',
          '        self._attempts[student] = self._attempts.get(student, 0) + n',
          '',
          '    def attempts_of(self, student):',
          '        return self._attempts.get(student, 0)') },
      { id: 'op3', intent: 'aggregate over the parallel accumulator',
        anchor: '        return max(sorted(self._scores), key=lambda s: self._scores[s])' + NL,
        code: L('',
          '    def most_attempts(self):',
          '        if not self._attempts:',
          '            return None',
          '        return max(sorted(self._attempts), key=lambda s: self._attempts[s])') },
    ],
    dependency_edges: [['op1', 'op2'], ['op1', 'op3']],
    preservation_probe: L(
      'import grades',
      'g = grades.Grades()',
      'g.record("ann", 3); g.record("ann", 4); g.record("bo", 5)',
      'assert g.score_of("ann") == 7, g.score_of("ann")',
      'assert g.score_of("zed") == 0',
      'assert g.best() == "ann", g.best()',
      'assert grades.Grades().best() is None',
      'print("OK")'),
    delta_probe: L(
      'import grades',
      'g = grades.Grades()',
      'assert g.most_attempts() is None, "nothing recorded yet"',
      'g.record_attempt("ann", 2); g.record_attempt("ann", 1); g.record_attempt("bo", 5)',
      'assert g.attempts_of("ann") == 3, g.attempts_of("ann")',
      'assert g.attempts_of("zed") == 0',
      'assert g.most_attempts() == "bo", g.most_attempts()',
      'g.record("ann", 9)',
      'assert g.attempts_of("ann") == 3, "scores and attempts must stay separate"',
      'print("OK")'),
  },

  {
    id: 'd02',
    lead: 'tokens.py', language: 'py', run_with: 'python',
    goal: 'Add quoted spans to the EXISTING split_tokens in tokens.py: a piece that opens with a double '
      + 'quote starts a span that continues until a piece that closes with a double quote, and the whole '
      + 'span becomes one token with the surrounding quotes removed. A span that is never closed still '
      + 'becomes one token at the end of the input. Unquoted input must split exactly as it does now. '
      + 'Run it with python.',
    interface: [],
    analogy_class: 'no_supported_analogy',
    analogy_justification: 'every decision in this function is made about one piece in isolation and '
      + 'the loop carries nothing from one iteration to the next, so a token that spans several pieces '
      + 'has no structural relation here to parallel',
    structural_class: 'novel-control-feature',
    source: d02src,
    operations: [
      { id: 'op1', intent: 'declare the state carried between iterations',
        anchor: '    out = []' + NL,
        code: '    held = None' + NL },
      { id: 'op2', intent: 'open, continue and close a span, using that state',
        anchor: '        if not piece:' + NL + '            continue' + NL,
        code: L('        if held is not None:',
          '            held.append(piece)',
          '            if piece.endswith(' + DQ + '):',
          '                out.append(' + Q + ' ' + Q + '.join(held).strip(' + DQ + '))',
          '                held = None',
          '            continue',
          '        if piece.startswith(' + DQ + ') and not piece.endswith(' + DQ + '):',
          '            held = [piece]',
          '            continue') },
      { id: 'op3', intent: 'emit a span that the input never closed',
        anchor: '        out.append(piece)' + NL,
        code: L('    if held is not None:',
          '        out.append(' + Q + ' ' + Q + '.join(held).strip(' + DQ + '))') },
    ],
    dependency_edges: [['op1', 'op2'], ['op1', 'op3'], ['op2', 'op3']],
    preservation_probe: L(
      'import tokens',
      'assert tokens.split_tokens("a b  c") == ["a", "b", "c"], tokens.split_tokens("a b  c")',
      'assert tokens.split_tokens("") == []',
      'assert tokens.split_tokens("  solo  ") == ["solo"]',
      'print("OK")'),
    delta_probe: L(
      'import tokens',
      "r = tokens.split_tokens('a " + Q + "b c" + Q + " d')",
      'assert r == ["a", "b c", "d"], r',
      "u = tokens.split_tokens('a " + Q + "b c')",
      'assert u == ["a", "b c"], u',
      'assert tokens.split_tokens("x y") == ["x", "y"], "unquoted input is unchanged"',
      'print("OK")'),
  },

  {
    id: 'c03',
    lead: 'events.py', language: 'py', run_with: 'python',
    goal: 'Add a scroll event type to the EXISTING events.py: a scroll event carries a delta and renders '
      + 'as the word scroll, a space, and the delta, using 0 when the event does not carry one. The type '
      + 'must be accepted by valid_types, rendered by render, and labelled "scroll wheel" by label. The '
      + 'click and key event types must keep working exactly as they do now. Run it with python.',
    analogy: 'the scroll event type is written the same way as the existing key event type',
    interface: ['scroll', 'delta'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing key event type as the relation to parallel; '
      + 'that type participates in the valid-type list, the label map, its own renderer and a branch of '
      + 'the dispatcher, and the requested type occupies the same four positions',
    structural_class: 'parallel-variant-feature',
    source: c03src,
    operations: [
      { id: 'op1', intent: 'admit the new type in the valid-type list',
        anchor: 'EVENT_TYPES = [' + Q + 'click' + Q + ', ' + Q + 'key' + Q,
        code: ', ' + Q + 'scroll' + Q },
      { id: 'op2', intent: 'label the new type',
        anchor: Q + 'key' + Q + ': ' + Q + 'key press' + Q,
        code: ', ' + Q + 'scroll' + Q + ': ' + Q + 'scroll wheel' + Q },
      { id: 'op3', intent: 'the renderer for the new type',
        anchor: 'def label(t):' + NL + '    return EVENT_LABELS.get(t, ' + Q + 'unknown' + Q + ')' + NL,
        code: L('',
          '',
          'def _render_scroll(e):',
          '    return ' + Q + 'scroll ' + Q + ' + str(e.get(' + Q + 'delta' + Q + ', 0))') },
      { id: 'op4', intent: 'the branch that routes the new type to its renderer',
        anchor: '    if t == ' + Q + 'key' + Q + ':' + NL + '        return _render_key(e)' + NL,
        code: L('    if t == ' + Q + 'scroll' + Q + ':',
          '        return _render_scroll(e)') },
    ],
    dependency_edges: [['op3', 'op4'], ['op1', 'op4']],
    preservation_probe: L(
      'import events',
      'assert events.valid_types(["click", "key"])',
      'assert not events.valid_types(["nope"])',
      'assert events.label("click") == "mouse click", events.label("click")',
      'assert events.render({"type": "click", "x": 1, "y": 2}) == "click at 1,2", events.render({"type": "click", "x": 1, "y": 2})',
      'assert events.render({"type": "key", "code": "Esc"}) == "key Esc"',
      'assert events.render({"type": "nope"}) == "unknown event"',
      'print("OK")'),
    delta_probe: L(
      'import events',
      'assert events.valid_types(["scroll"]), "the new type must be admitted"',
      'assert events.label("scroll") == "scroll wheel", events.label("scroll")',
      'assert events.render({"type": "scroll", "delta": 3}) == "scroll 3", events.render({"type": "scroll", "delta": 3})',
      'assert events.render({"type": "scroll"}) == "scroll 0", events.render({"type": "scroll"})',
      'assert events.render({"type": "key", "code": "Esc"}) == "key Esc", "existing types unchanged"',
      'print("OK")'),
  },

  {
    id: 'd03',
    lead: 'paths.py', language: 'py', run_with: 'python',
    goal: 'Add link resolution to the EXISTING paths.py: resolve(links, start) follows a mapping of '
      + 'name to name from start until it reaches a name the mapping does not contain, and returns that '
      + 'name. If following the mapping revisits a name, or takes more than MAX_HOPS steps, raise '
      + 'PathCycle. Also add resolve_all(links, starts), which resolves each of several starting names '
      + 'and returns the results in order. Set MAX_HOPS to 16. Keep clean, join_path and depth working '
      + 'exactly as they do now. Run it with python.',
    // The parameter names are part of the signature the goal asks for, so they are declared rather
    // than hidden. The guard is right to insist: an undeclared name shared by goal and reference is
    // indistinguishable from a leak until someone states which it is.
    interface: ['resolve', 'resolve_all', 'PathCycle', 'MAX_HOPS', 'links', 'start', 'starts'],
    analogy_class: 'no_supported_analogy',
    analogy_justification: 'every helper in this file is a single-step transformation of its arguments '
      + 'and none of them repeats until a fixed point or signals failure, so bounded resolution with a '
      + 'raised error has no structural relation here to parallel',
    structural_class: 'novel-control-feature',
    source: d03src,
    operations: [
      { id: 'op1', intent: 'the bound the new behaviour is specified against',
        anchor: '# Path helpers.' + NL,
        code: L('', 'MAX_HOPS = 16') },
      { id: 'op2', intent: 'the failure signal the new behaviour raises',
        anchor: 'def clean(p):' + NL + '    return str(p).strip().strip(' + Q + '/' + Q + ')' + NL,
        code: L('',
          '',
          'class PathCycle(Exception):',
          '    pass') },
      { id: 'op3', intent: 'the resolution loop, using the bound and the failure signal',
        anchor: '    return left + ' + Q + '/' + Q + ' + right' + NL,
        code: L('',
          '',
          'def resolve(links, start):',
          '    seen = set()',
          '    cur = start',
          '    hops = 0',
          '    while cur in links:',
          '        if cur in seen or hops >= MAX_HOPS:',
          '            raise PathCycle(cur)',
          '        seen.add(cur)',
          '        cur = links[cur]',
          '        hops += 1',
          '    return cur') },
      { id: 'op4', intent: 'the batch form over the resolution loop',
        anchor: '    return len(c.split(' + Q + '/' + Q + ')) if c else 0' + NL,
        code: L('',
          '',
          'def resolve_all(links, starts):',
          '    return [resolve(links, s) for s in starts]') },
    ],
    dependency_edges: [['op1', 'op3'], ['op2', 'op3'], ['op3', 'op4']],
    preservation_probe: L(
      'import paths',
      'assert paths.clean("  /a/b/  ") == "a/b", paths.clean("  /a/b/  ")',
      'assert paths.join_path("/a/", "/b/") == "a/b", paths.join_path("/a/", "/b/")',
      'assert paths.join_path("", "b") == "b"',
      'assert paths.depth("a/b/c") == 3, paths.depth("a/b/c")',
      'assert paths.depth("") == 0',
      'print("OK")'),
    delta_probe: L(
      'import paths',
      'assert paths.MAX_HOPS == 16, paths.MAX_HOPS',
      'assert paths.resolve({"a": "b", "b": "c"}, "a") == "c", paths.resolve({"a": "b", "b": "c"}, "a")',
      'assert paths.resolve({}, "solo") == "solo"',
      'try:',
      '    paths.resolve({"a": "b", "b": "a"}, "a")',
      '    raise AssertionError("a cycle must raise PathCycle")',
      'except paths.PathCycle:',
      '    pass',
      'assert paths.resolve_all({"a": "b"}, ["a", "z"]) == ["b", "z"], paths.resolve_all({"a": "b"}, ["a", "z"])',
      'assert paths.depth("a/b") == 2, "the existing helpers must be unchanged"',
      'print("OK")'),
  },
];
