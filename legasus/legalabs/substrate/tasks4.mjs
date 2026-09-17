// PROVENANCE FAMILY. Authored BEFORE any v5 code exists, per rule 5 of LEGASUS_V5.md: a family
// written after the implementation measures the implementation's shape.
//
// Eight tasks carrying the six controls. The expected outcome column is the POINT - a family of
// c03-shaped tasks would confirm any change that prefers the relation clause, which is the failure
// this family exists to make impossible.
//
//   id   ops  control                                   expected
//   e01   4   provenance settles a genuine tie          APPLY, citing the relation clause
//   e02   3   preservation distractor OUTSCORES target  APPLY on the relation-named concern
//   e03   2   preservation distractor OUTSCORES target  APPLY on the relation-named concern
//   e04   3   clean analogy, no rival at all            APPLY  (baseline positive)
//   e05   3   STRICT SUBSET, state: 5 participants      APPLY on 3; 2 excluded with reasons
//   e06   4   STRICT SUBSET, variant: 5 positions       APPLY on 4; 1 excluded with a reason
//   f01   3   BOTH rivals named in the relation         ABSTAIN - provenance cannot settle it
//   f02   2   FALSE relation + unrelated goal hit       ABSTAIN - must not manufacture applicability
//   f03   4   no relation clause                        ABSTAIN_NO_RELATION
//   f04   3   no relation clause                        ABSTAIN_NO_RELATION
//   f05   3   no relation clause                        ABSTAIN_NO_RELATION
//   f06   4   no relation clause                        ABSTAIN_NO_RELATION
//
// e05 and e06 are the INFLATION controls and they are the point of this family. Provenance work
// cannot touch candidate inflation: that comes from treating PARTICIPATION as REQUIREMENT. A concern
// holding OWNER, MUTATOR-a, MUTATOR-b, CONSUMER-a, CONSUMER-b when the delta needs only OWNER,
// MUTATOR-a and CONSUMER-b means two nominated sites are wrong, and the selector must say WHY they
// are not required - an exclusion without a witness is a guess that happens to be conservative.
//
// Neither task states its exclusions. The goal names the behaviours it wants; anything that infers
// the exclusions from a negative sentence in the prompt would be reading an answer, not deriving one.
//
// Rule 13 matching: operation counts are the same multiset {2,3,3,3,4,4} on both sides, so expected
// outcome is not confounded with transaction size.
//
// Six expected APPLY and six expected ABSTAIN. A selector that abstains on everything scores 6/12 and
// one that applies to everything also scores 6/12; neither can look good by degenerating.
const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL) + NL;
const Q = String.fromCharCode(34);

// ---------------------------------------------------------------------------------------------------
// e01 — the c03 shape in a fresh domain. Two rival variant concerns; the relation names exactly one,
// the preservation clause names both.
const e01src = L(
  'SHAPE_KINDS = [' + Q + 'circle' + Q + ', ' + Q + 'square' + Q + ']',
  '',
  'SHAPE_LABELS = {' + Q + 'circle' + Q + ': ' + Q + 'round shape' + Q + ', ' + Q + 'square' + Q + ': ' + Q + 'four equal sides' + Q + '}',
  '',
  '',
  'def _area_circle(s):',
  '    return 3.14159 * s.get(' + Q + 'r' + Q + ', 0) * s.get(' + Q + 'r' + Q + ', 0)',
  '',
  '',
  'def _area_square(s):',
  '    return s.get(' + Q + 'side' + Q + ', 0) * s.get(' + Q + 'side' + Q + ', 0)',
  '',
  '',
  'def describe(k):',
  '    return SHAPE_LABELS.get(k, ' + Q + 'unknown' + Q + ')',
  '',
  '',
  'def valid_kinds(kinds):',
  '    return all(k in SHAPE_KINDS for k in kinds)',
  '',
  '',
  'def area(s):',
  '    k = s.get(' + Q + 'kind' + Q + ')',
  '    if k == ' + Q + 'circle' + Q + ':',
  '        return _area_circle(s)',
  '    if k == ' + Q + 'square' + Q + ':',
  '        return _area_square(s)',
  '    return 0',
);

// ---------------------------------------------------------------------------------------------------
// e02 — the distractor OUTSCORES the target on surface hits. The hit feature has four namable parts
// and is mentioned only in the preservation clause; the names list has fewer and is what the relation
// actually points at. Under a bag of words the wrong concern wins outright - not a tie, a wrong answer.
const e02src = L(
  'class Session:',
  '    def __init__(self):',
  '        self._hits = {}',
  '        self._names = []',
  '',
  '    def record_hit(self, page):',
  '        self._hits[page] = self._hits.get(page, 0) + 1',
  '',
  '    def hit_count(self, page):',
  '        return self._hits.get(page, 0)',
  '',
  '    def total_hits(self):',
  '        return sum(self._hits.values())',
  '',
  '    def add_name(self, name):',
  '        self._names.append(name)',
  '',
  '    def name_count(self):',
  '        return len(self._names)',
);

// ---------------------------------------------------------------------------------------------------
// e03 — the same inversion at two operations.
const e03src = L(
  'class Cart:',
  '    def __init__(self):',
  '        self._items = []',
  '        self._coupons = []',
  '',
  '    def add_item(self, sku):',
  '        self._items.append(sku)',
  '',
  '    def item_count(self):',
  '        return len(self._items)',
  '',
  '    def add_coupon(self, code):',
  '        self._coupons.append(code)',
  '',
  '    def coupon_count(self):',
  '        return len(self._coupons)',
);

// ---------------------------------------------------------------------------------------------------
// e04 — BASELINE POSITIVE. One state concern, no rival, relation names it. If this stops applying,
// the provenance work has broken ordinary resolution rather than sharpened it.
const e04src = L(
  'class Library:',
  '    def __init__(self):',
  '        self._borrowed = {}',
  '',
  '    def borrow(self, title, n):',
  '        self._borrowed[title] = self._borrowed.get(title, 0) + n',
  '',
  '    def borrowed_count(self, title):',
  '        return self._borrowed.get(title, 0)',
  '',
  '    def total_borrowed(self):',
  '        return sum(self._borrowed.values())',
);

// ---------------------------------------------------------------------------------------------------
// f01 — BOTH rivals named in the relation clause. Provenance is doing its job and still cannot settle
// this; the correct answer is abstention. This is what stops "the relation always wins".
const f01src = L(
  'CHANNELS = [' + Q + 'email' + Q + ', ' + Q + 'sms' + Q + ']',
  '',
  '',
  'def _send_email(msg):',
  '    return ' + Q + 'email: ' + Q + ' + str(msg)',
  '',
  '',
  'def _send_sms(msg):',
  '    return ' + Q + 'sms: ' + Q + ' + str(msg)',
  '',
  '',
  'def valid_channels(cs):',
  '    return all(c in CHANNELS for c in cs)',
  '',
  '',
  'def send(channel, msg):',
  '    if channel == ' + Q + 'email' + Q + ':',
  '        return _send_email(msg)',
  '    if channel == ' + Q + 'sms' + Q + ':',
  '        return _send_sms(msg)',
  '    return ' + Q + 'dropped' + Q,
);

// ---------------------------------------------------------------------------------------------------
// f02 — FALSE RELATION. The relation names `mean`, a pure function that is no precedent for
// accumulation across calls. Meanwhile the preservation clause mentions `scaled`, which DOES
// participate in a real concern (state:SCALE). A bag of words can therefore resolve this task to a
// concern that has nothing to do with it, on evidence drawn entirely from a preservation clause.
const f02src = L(
  'SCALE = 100',
  '',
  '',
  'def mean(xs):',
  '    return sum(xs) / len(xs) if xs else 0',
  '',
  '',
  'def scaled(xs):',
  '    return [x * SCALE for x in xs]',
  '',
  '',
  'def spread(xs):',
  '    return max(xs) - min(xs) if xs else 0',
);

// ---------------------------------------------------------------------------------------------------
// f03 — no relation clause. The 3/3 non-overreach result must not regress.
const f03src = L(
  '# Small matrix helpers.',
  '',
  '',
  'def shape(m):',
  '    return (len(m), len(m[0]) if m else 0)',
  '',
  '',
  'def row(m, i):',
  '    return list(m[i])',
  '',
  '',
  'def col(m, j):',
  '    return [r[j] for r in m]',
);

// ---------------------------------------------------------------------------------------------------
// f04 — no relation clause.
const f04src = L(
  '# Temperature helpers.',
  '',
  '',
  'def to_f(c):',
  '    return c * 9.0 / 5.0 + 32.0',
  '',
  '',
  'def to_c(f):',
  '    return (f - 32.0) * 5.0 / 9.0',
  '',
  '',
  'def floor_c(c):',
  '    return max(-273.15, c)',
);

export const TASKS4 = [
  {
    id: 'e01',
    lead: 'shapes.py', language: 'py', run_with: 'python',
    goal: 'Add a rect kind to the EXISTING shapes.py: a rect carries w and h, and its area is w times '
      + 'h, using 0 when either is missing. The kind must be accepted by valid_kinds, computed by area, '
      + 'and described as "four right angles" by describe. The circle and square kinds must keep '
      + 'working exactly as they do now. Run it with python.',
    analogy: 'the rect kind is written the same way as the existing square kind',
    interface: ['rect'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing square kind as the relation to parallel; that '
      + 'kind participates in the valid-kind list, the label map, its own area function and a branch '
      + 'of the dispatcher, and the requested kind occupies the same four positions',
    structural_class: 'parallel-variant-feature',
    source: e01src,
    operations: [
      { id: 'op1', intent: 'admit the new kind in the valid-kind list',
        anchor: 'SHAPE_KINDS = [' + Q + 'circle' + Q + ', ' + Q + 'square' + Q,
        code: ', ' + Q + 'rect' + Q },
      { id: 'op2', intent: 'describe the new kind',
        anchor: Q + 'square' + Q + ': ' + Q + 'four equal sides' + Q,
        code: ', ' + Q + 'rect' + Q + ': ' + Q + 'four right angles' + Q },
      { id: 'op3', intent: 'the area function for the new kind',
        anchor: 'def describe(k):' + NL + '    return SHAPE_LABELS.get(k, ' + Q + 'unknown' + Q + ')' + NL,
        code: L('',
          '',
          'def _area_rect(s):',
          '    return s.get(' + Q + 'w' + Q + ', 0) * s.get(' + Q + 'h' + Q + ', 0)') },
      { id: 'op4', intent: 'the branch that routes the new kind to its area function',
        anchor: '    if k == ' + Q + 'square' + Q + ':' + NL + '        return _area_square(s)' + NL,
        code: L('    if k == ' + Q + 'rect' + Q + ':',
          '        return _area_rect(s)') },
    ],
    dependency_edges: [['op3', 'op4'], ['op1', 'op4']],
    preservation_probe: L(
      'import shapes',
      'assert shapes.valid_kinds(["circle", "square"])',
      'assert not shapes.valid_kinds(["blob"])',
      'assert shapes.describe("circle") == "round shape", shapes.describe("circle")',
      'assert shapes.area({"kind": "square", "side": 3}) == 9, shapes.area({"kind": "square", "side": 3})',
      'assert abs(shapes.area({"kind": "circle", "r": 1}) - 3.14159) < 1e-9',
      'assert shapes.area({"kind": "blob"}) == 0',
      'print("OK")'),
    delta_probe: L(
      'import shapes',
      'assert shapes.valid_kinds(["rect"]), "the new kind must be admitted"',
      'assert shapes.describe("rect") == "four right angles", shapes.describe("rect")',
      'assert shapes.area({"kind": "rect", "w": 2, "h": 3}) == 6, shapes.area({"kind": "rect", "w": 2, "h": 3})',
      'assert shapes.area({"kind": "rect"}) == 0',
      'assert shapes.area({"kind": "square", "side": 3}) == 9, "existing kinds unchanged"',
      'print("OK")'),
  },

  {
    id: 'e02',
    lead: 'session.py', language: 'py', run_with: 'python',
    goal: 'Add a role list to the EXISTING Session in session.py: add_role(role) appends a role, '
      + 'role_count() returns how many have been added, and has_role(role) reports whether one is '
      + 'present. Keep record_hit, hit_count and total_hits working exactly as they do now, and keep '
      + 'add_name and name_count working exactly as they do now. Run it with python.',
    analogy: 'the role list works the same way as the existing names list',
    // `role` is the parameter name the goal asks for, declared rather than hidden - same call as
    // d03's links/start/starts. An undeclared name shared by goal and reference is indistinguishable
    // from a leak until someone states which it is.
    interface: ['add_role', 'role_count', 'has_role', 'role'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing names list as the relation to parallel; that '
      + 'feature has a declaration, an appender and a count, and the new feature occupies the same '
      + 'positions with a membership test added',
    structural_class: 'parallel-state-feature',
    source: e02src,
    operations: [
      { id: 'op1', intent: 'declare the parallel list',
        anchor: '        self._names = []' + NL,
        code: '        self._roles = []' + NL },
      { id: 'op2', intent: 'appender and count for the parallel list',
        anchor: '    def name_count(self):' + NL + '        return len(self._names)' + NL,
        code: L('',
          '    def add_role(self, role):',
          '        self._roles.append(role)',
          '',
          '    def role_count(self):',
          '        return len(self._roles)') },
      { id: 'op3', intent: 'membership test for the parallel list',
        anchor: '    def add_name(self, name):' + NL + '        self._names.append(name)' + NL,
        code: L('',
          '    def has_role(self, role):',
          '        return role in self._roles') },
    ],
    dependency_edges: [['op1', 'op2'], ['op1', 'op3']],
    preservation_probe: L(
      'import session',
      's = session.Session()',
      's.record_hit("a"); s.record_hit("a"); s.record_hit("b")',
      'assert s.hit_count("a") == 2, s.hit_count("a")',
      'assert s.hit_count("z") == 0',
      'assert s.total_hits() == 3, s.total_hits()',
      's.add_name("ann")',
      'assert s.name_count() == 1, s.name_count()',
      'print("OK")'),
    delta_probe: L(
      'import session',
      's = session.Session()',
      'assert s.role_count() == 0, s.role_count()',
      's.add_role("admin"); s.add_role("editor")',
      'assert s.role_count() == 2, s.role_count()',
      'assert s.has_role("admin")',
      'assert not s.has_role("guest")',
      's.add_name("ann")',
      'assert s.role_count() == 2, "the two lists must stay separate"',
      'assert not s.has_role("ann")',
      'print("OK")'),
  },

  {
    id: 'e03',
    lead: 'cart.py', language: 'py', run_with: 'python',
    goal: 'Add a gift list to the EXISTING Cart in cart.py: add_gift(sku) appends a gift and '
      + 'gift_count() returns how many have been added. Keep add_item and item_count working exactly '
      + 'as they do now. Run it with python.',
    analogy: 'the gift list works the same way as the existing coupons list',
    interface: ['add_gift', 'gift_count'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing coupons list as the relation to parallel; that '
      + 'feature has a declaration, an appender and a count, and the new feature occupies the same '
      + 'three positions',
    structural_class: 'parallel-state-feature',
    source: e03src,
    operations: [
      { id: 'op1', intent: 'declare the parallel list',
        anchor: '        self._coupons = []' + NL,
        code: '        self._gifts = []' + NL },
      { id: 'op2', intent: 'appender and count for the parallel list',
        anchor: '    def coupon_count(self):' + NL + '        return len(self._coupons)' + NL,
        code: L('',
          '    def add_gift(self, sku):',
          '        self._gifts.append(sku)',
          '',
          '    def gift_count(self):',
          '        return len(self._gifts)') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L(
      'import cart',
      'c = cart.Cart()',
      'c.add_item("x"); c.add_item("y")',
      'assert c.item_count() == 2, c.item_count()',
      'c.add_coupon("SAVE")',
      'assert c.coupon_count() == 1, c.coupon_count()',
      'print("OK")'),
    delta_probe: L(
      'import cart',
      'c = cart.Cart()',
      'assert c.gift_count() == 0, c.gift_count()',
      'c.add_gift("mug"); c.add_gift("pen")',
      'assert c.gift_count() == 2, c.gift_count()',
      'c.add_item("x"); c.add_coupon("SAVE")',
      'assert c.gift_count() == 2, "the lists must stay separate"',
      'assert c.item_count() == 1 and c.coupon_count() == 1',
      'print("OK")'),
  },

  {
    id: 'e04',
    lead: 'library.py', language: 'py', run_with: 'python',
    goal: 'Add reservations to the EXISTING Library in library.py: reserve(title, n) records n '
      + 'reservations for a title, reserved_count(title) returns the number recorded for that title '
      + 'and 0 when there is none, and total_reserved() returns the sum over all titles. Keep the '
      + 'borrowing working exactly as it does now. Run it with python.',
    analogy: 'the reservations work the same way as the existing borrowing',
    interface: ['reserve', 'reserved_count', 'total_reserved'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing borrowing as the relation to parallel; that '
      + 'feature has a declaration, a recorder, a per-key reader and an aggregate, and the new feature '
      + 'occupies the same four positions',
    structural_class: 'parallel-state-feature',
    source: e04src,
    operations: [
      { id: 'op1', intent: 'declare the parallel accumulator',
        anchor: '        self._borrowed = {}' + NL,
        code: '        self._reserved = {}' + NL },
      { id: 'op2', intent: 'recorder and per-key reader for the parallel accumulator',
        anchor: '    def borrowed_count(self, title):' + NL + '        return self._borrowed.get(title, 0)' + NL,
        code: L('',
          '    def reserve(self, title, n):',
          '        self._reserved[title] = self._reserved.get(title, 0) + n',
          '',
          '    def reserved_count(self, title):',
          '        return self._reserved.get(title, 0)') },
      { id: 'op3', intent: 'aggregate over the parallel accumulator',
        anchor: '    def total_borrowed(self):' + NL + '        return sum(self._borrowed.values())' + NL,
        code: L('',
          '    def total_reserved(self):',
          '        return sum(self._reserved.values())') },
    ],
    dependency_edges: [['op1', 'op2'], ['op1', 'op3']],
    preservation_probe: L(
      'import library',
      'b = library.Library()',
      'b.borrow("dune", 2); b.borrow("dune", 1); b.borrow("emma", 4)',
      'assert b.borrowed_count("dune") == 3, b.borrowed_count("dune")',
      'assert b.borrowed_count("zzz") == 0',
      'assert b.total_borrowed() == 7, b.total_borrowed()',
      'print("OK")'),
    delta_probe: L(
      'import library',
      'b = library.Library()',
      'assert b.total_reserved() == 0, b.total_reserved()',
      'b.reserve("dune", 2); b.reserve("dune", 3); b.reserve("emma", 1)',
      'assert b.reserved_count("dune") == 5, b.reserved_count("dune")',
      'assert b.reserved_count("zzz") == 0',
      'assert b.total_reserved() == 6, b.total_reserved()',
      'b.borrow("dune", 1)',
      'assert b.reserved_count("dune") == 5, "borrowing and reserving must stay separate"',
      'print("OK")'),
  },

  {
    id: 'f01',
    lead: 'notify.py', language: 'py', run_with: 'python',
    goal: 'Add a push channel to the EXISTING notify.py: sending on it returns the word push, a colon, '
      + 'a space, and the message. The channel must be accepted by valid_channels and routed by send. '
      + 'The email and sms channels must keep working exactly as they do now. Run it with python.',
    // BOTH existing variants are named in the relation clause itself. Provenance separation cannot
    // break this tie, and must not pretend to: the correct outcome is abstention.
    analogy: 'the push channel is written the same way as the existing email and sms channels',
    interface: ['push'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names two existing channels as the relation to parallel, and both '
      + 'are equally good structural precedents; the relation therefore identifies a shape but not a '
      + 'unique concern, and no clause in the task distinguishes them',
    structural_class: 'parallel-variant-feature',
    source: f01src,
    operations: [
      { id: 'op1', intent: 'admit the new channel in the valid-channel list',
        anchor: 'CHANNELS = [' + Q + 'email' + Q + ', ' + Q + 'sms' + Q,
        code: ', ' + Q + 'push' + Q },
      { id: 'op2', intent: 'the sender for the new channel',
        anchor: 'def valid_channels(cs):' + NL + '    return all(c in CHANNELS for c in cs)' + NL,
        code: L('',
          '',
          'def _send_push(msg):',
          '    return ' + Q + 'push: ' + Q + ' + str(msg)') },
      { id: 'op3', intent: 'the branch that routes the new channel to its sender',
        anchor: '    if channel == ' + Q + 'sms' + Q + ':' + NL + '        return _send_sms(msg)' + NL,
        code: L('    if channel == ' + Q + 'push' + Q + ':',
          '        return _send_push(msg)') },
    ],
    dependency_edges: [['op2', 'op3'], ['op1', 'op3']],
    preservation_probe: L(
      'import notify',
      'assert notify.valid_channels(["email", "sms"])',
      'assert not notify.valid_channels(["carrier"])',
      'assert notify.send("email", "hi") == "email: hi", notify.send("email", "hi")',
      'assert notify.send("sms", "hi") == "sms: hi"',
      'assert notify.send("carrier", "hi") == "dropped"',
      'print("OK")'),
    delta_probe: L(
      'import notify',
      'assert notify.valid_channels(["push"]), "the new channel must be admitted"',
      'assert notify.send("push", "hi") == "push: hi", notify.send("push", "hi")',
      'assert notify.send("email", "hi") == "email: hi", "existing channels unchanged"',
      'print("OK")'),
  },

  {
    id: 'f02',
    lead: 'stats.py', language: 'py', run_with: 'python',
    goal: 'Add a running mean to the EXISTING stats.py: running_mean(x) returns the mean of every '
      + 'value passed to running_mean so far, including the current one. Keep mean, scaled and spread '
      + 'working exactly as they do now. Run it with python.',
    // A FALSE RELATION: `mean` is a pure function of its argument and is no precedent whatever for
    // accumulation across calls. The preservation clause meanwhile names `scaled`, which DOES
    // participate in a real concern (state:SCALE) - so a bag of words can resolve this task to a
    // concern that has nothing to do with it, on evidence drawn entirely from a preservation clause.
    analogy: 'the running mean is written the same way as the existing mean helper',
    interface: ['running_mean'],
    analogy_class: 'no_supported_analogy',
    analogy_justification: 'the task names `mean` as the relation to parallel, but `mean` is a pure '
      + 'function of its argument and retains nothing between calls, so it is not a structural '
      + 'precedent for accumulation; naming a relation does not make one exist',
    structural_class: 'novel-state-feature',
    source: f02src,
    operations: [
      { id: 'op1', intent: 'declare the across-call accumulator the new behaviour needs',
        anchor: 'SCALE = 100' + NL,
        code: L('', '_RUNNING = [0.0, 0]') },
      { id: 'op2', intent: 'the running mean, using that accumulator',
        anchor: 'def spread(xs):' + NL + '    return max(xs) - min(xs) if xs else 0' + NL,
        code: L('',
          '',
          'def running_mean(x):',
          '    _RUNNING[0] += x',
          '    _RUNNING[1] += 1',
          '    return _RUNNING[0] / _RUNNING[1]') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L(
      'import stats',
      'assert stats.mean([1, 2, 3]) == 2, stats.mean([1, 2, 3])',
      'assert stats.mean([]) == 0',
      'assert stats.scaled([1, 2]) == [100, 200], stats.scaled([1, 2])',
      'assert stats.spread([1, 5]) == 4, stats.spread([1, 5])',
      'print("OK")'),
    delta_probe: L(
      'import stats',
      'assert stats.running_mean(2) == 2.0, stats.running_mean(2)',
      'assert stats.running_mean(4) == 3.0, "mean of 2 and 4"',
      'assert stats.running_mean(6) == 4.0, "mean of 2, 4 and 6"',
      'assert stats.mean([1, 2, 3]) == 2, "the existing helpers must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'f03',
    lead: 'matrix.py', language: 'py', run_with: 'python',
    goal: 'Add shape checking to the EXISTING matrix.py: checked(m) returns m when every row has the '
      + 'same length and neither dimension exceeds MAX_DIM, and raises ShapeError otherwise. Also add '
      + 'checked_all(ms), which checks several matrices and returns them in order. Set MAX_DIM to 64. '
      + 'Keep shape, row and col working exactly as they do now. Run it with python.',
    interface: ['checked', 'checked_all', 'ShapeError', 'MAX_DIM'],
    analogy_class: 'no_supported_analogy',
    analogy_justification: 'every helper in this file reads a matrix and returns a value, and none of '
      + 'them validates anything or signals failure, so a checking operation that raises has no '
      + 'structural relation here to parallel',
    structural_class: 'novel-control-feature',
    source: f03src,
    operations: [
      { id: 'op1', intent: 'the bound the new behaviour is specified against',
        anchor: '# Small matrix helpers.' + NL,
        code: L('', 'MAX_DIM = 64') },
      { id: 'op2', intent: 'the failure signal the new behaviour raises',
        anchor: 'def shape(m):' + NL + '    return (len(m), len(m[0]) if m else 0)' + NL,
        code: L('',
          '',
          'class ShapeError(Exception):',
          '    pass') },
      { id: 'op3', intent: 'the checking operation, using the bound and the failure signal',
        anchor: 'def row(m, i):' + NL + '    return list(m[i])' + NL,
        code: L('',
          '',
          'def checked(m):',
          '    widths = set(len(r) for r in m)',
          '    if len(widths) > 1:',
          '        raise ShapeError(' + Q + 'ragged' + Q + ')',
          '    if len(m) > MAX_DIM or (widths and max(widths) > MAX_DIM):',
          '        raise ShapeError(' + Q + 'too big' + Q + ')',
          '    return m') },
      { id: 'op4', intent: 'the batch form over the checking operation',
        anchor: 'def col(m, j):' + NL + '    return [r[j] for r in m]' + NL,
        code: L('',
          '',
          'def checked_all(ms):',
          '    return [checked(m) for m in ms]') },
    ],
    dependency_edges: [['op1', 'op3'], ['op2', 'op3'], ['op3', 'op4']],
    preservation_probe: L(
      'import matrix',
      'm = [[1, 2], [3, 4]]',
      'assert matrix.shape(m) == (2, 2), matrix.shape(m)',
      'assert matrix.shape([]) == (0, 0)',
      'assert matrix.row(m, 0) == [1, 2], matrix.row(m, 0)',
      'assert matrix.col(m, 1) == [2, 4], matrix.col(m, 1)',
      'print("OK")'),
    delta_probe: L(
      'import matrix',
      'assert matrix.MAX_DIM == 64, matrix.MAX_DIM',
      'ok = [[1, 2], [3, 4]]',
      'assert matrix.checked(ok) == ok',
      'try:',
      '    matrix.checked([[1, 2], [3]])',
      '    raise AssertionError("a ragged matrix must raise ShapeError")',
      'except matrix.ShapeError:',
      '    pass',
      'try:',
      '    matrix.checked([[0] * 65])',
      '    raise AssertionError("exceeding MAX_DIM must raise ShapeError")',
      'except matrix.ShapeError:',
      '    pass',
      'assert matrix.checked_all([ok, ok]) == [ok, ok], matrix.checked_all([ok, ok])',
      'assert matrix.col(ok, 1) == [2, 4], "the existing helpers must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'f04',
    lead: 'temps.py', language: 'py', run_with: 'python',
    goal: 'Add extremes tracking to the EXISTING temps.py: record_c(c) records a celsius reading and '
      + 'returns it, and extremes() returns a (lowest, highest) pair over everything recorded so far, '
      + 'or None when nothing has been recorded. Keep to_f, to_c and floor_c working exactly as they '
      + 'do now. Run it with python.',
    interface: ['record_c', 'extremes'],
    analogy_class: 'no_supported_analogy',
    analogy_justification: 'every function in this file converts or bounds a single value and retains '
      + 'nothing between calls, so tracking readings across calls has no structural relation here to '
      + 'parallel',
    structural_class: 'novel-state-feature',
    source: f04src,
    operations: [
      { id: 'op1', intent: 'declare the across-call store the new behaviour needs',
        anchor: '# Temperature helpers.' + NL,
        code: L('', '_READINGS = []') },
      { id: 'op2', intent: 'the recorder, using that store',
        anchor: 'def to_c(f):' + NL + '    return (f - 32.0) * 5.0 / 9.0' + NL,
        code: L('',
          '',
          'def record_c(c):',
          '    _READINGS.append(c)',
          '    return c') },
      { id: 'op3', intent: 'the aggregate over that store',
        anchor: 'def floor_c(c):' + NL + '    return max(-273.15, c)' + NL,
        code: L('',
          '',
          'def extremes():',
          '    if not _READINGS:',
          '        return None',
          '    return (min(_READINGS), max(_READINGS))') },
    ],
    dependency_edges: [['op1', 'op2'], ['op1', 'op3']],
    preservation_probe: L(
      'import temps',
      'assert temps.to_f(100) == 212.0, temps.to_f(100)',
      'assert temps.to_c(32) == 0.0, temps.to_c(32)',
      'assert temps.floor_c(-500) == -273.15, temps.floor_c(-500)',
      'assert temps.floor_c(20) == 20',
      'print("OK")'),
    delta_probe: L(
      'import temps',
      'assert temps.extremes() is None, "nothing recorded yet"',
      'assert temps.record_c(5) == 5, temps.record_c(5)',
      'temps.record_c(-2); temps.record_c(9)',
      'assert temps.extremes() == (-2, 9), temps.extremes()',
      'assert temps.to_f(0) == 32.0, "the existing helpers must be unchanged"',
      'print("OK")'),
  },
];
