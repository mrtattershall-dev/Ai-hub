// PROVENANCE FAMILY, part 2 — the INFLATION controls and the remaining no-relation matches.
//
// Kept in its own file rather than spliced into tasks4.mjs, because in-place insertion into a large
// literal is how two earlier files acquired silent damage.
//
// e05 and e06 are the reason this family exists. Provenance work cannot touch candidate inflation:
// that comes from treating PARTICIPATION as REQUIREMENT. Each of these concerns holds more
// participants than the requested delta needs, and the correct output nominates the required subset
// and says WHY each remaining participant is not required.
//
// NEITHER GOAL STATES ITS EXCLUSIONS. They name the behaviours wanted and stop. A selector that
// learned the exclusions from a negative sentence in the prompt would be reading an answer rather
// than deriving one, and the goal text is the one place an oracle can hide in plain sight.
const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL) + NL;
const Q = String.fromCharCode(34);

// ---------------------------------------------------------------------------------------------------
// e05 — STRICT SUBSET, state. The pin feature holds FIVE participants:
//     __init__      OWNER        pin        MUTATOR      unpin       MUTATOR
//     pin_count     CONSUMER     pin_report CONSUMER
// The requested draft feature needs an owner, ONE mutator and ONE consumer. Two analogous positions
// are not required, and saying so is the deliverable.
const e05src = L(
  'class Board:',
  '    def __init__(self):',
  '        self._pins = []',
  '',
  '    def pin(self, item):',
  '        self._pins.append(item)',
  '',
  '    def unpin(self, item):',
  '        if item in self._pins:',
  '            self._pins.remove(item)',
  '',
  '    def pin_count(self):',
  '        return len(self._pins)',
  '',
  '    def pin_report(self):',
  '        return ' + Q + ', ' + Q + '.join(str(p) for p in self._pins)',
);

// ---------------------------------------------------------------------------------------------------
// e06 — STRICT SUBSET, variant. The csv format occupies FIVE positions: the format list, the label
// map, the ALIAS map, its own dumper, and its dispatch branch. The requested tsv format needs four of
// them; no alias is requested, so the alias map is a participant that does not require an edit.
const e06src = L(
  'FORMATS = [' + Q + 'json' + Q + ', ' + Q + 'csv' + Q + ']',
  '',
  'FORMAT_LABELS = {' + Q + 'json' + Q + ': ' + Q + 'JSON' + Q + ', ' + Q + 'csv' + Q + ': ' + Q + 'comma separated' + Q + '}',
  '',
  'ALIASES = {' + Q + 'js' + Q + ': ' + Q + 'json' + Q + ', ' + Q + 'comma' + Q + ': ' + Q + 'csv' + Q + '}',
  '',
  '',
  'def _dump_json(rows):',
  '    return ' + Q + '[' + Q + ' + ' + Q + ', ' + Q + '.join(str(r) for r in rows) + ' + Q + ']' + Q,
  '',
  '',
  'def _dump_csv(rows):',
  '    return ' + Q + '\\n' + Q + '.join(' + Q + ',' + Q + '.join(str(c) for c in r) for r in rows)',
  '',
  '',
  'def label(f):',
  '    return FORMAT_LABELS.get(f, ' + Q + 'unknown' + Q + ')',
  '',
  '',
  'def resolve_alias(a):',
  '    return ALIASES.get(a, a)',
  '',
  '',
  'def valid_formats(fs):',
  '    return all(f in FORMATS for f in fs)',
  '',
  '',
  'def dump(fmt, rows):',
  '    if fmt == ' + Q + 'json' + Q + ':',
  '        return _dump_json(rows)',
  '    if fmt == ' + Q + 'csv' + Q + ':',
  '        return _dump_csv(rows)',
  '    return ' + Q + Q,
);

// ---------------------------------------------------------------------------------------------------
// f05 — no relation clause. Pure colour arithmetic; a named-colour registry retains state across calls
// and nothing here does.
const f05src = L(
  '# Colour helpers.',
  '',
  '',
  'def to_rgb(h):',
  '    v = str(h).lstrip(' + Q + '#' + Q + ')',
  '    return (int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16))',
  '',
  '',
  'def luminance(rgb):',
  '    return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000.0',
  '',
  '',
  'def is_dark(h):',
  '    return luminance(to_rgb(h)) < 128',
);

// ---------------------------------------------------------------------------------------------------
// f06 — no relation clause. Pure formatters; a bounded append-only log retains state and trims.
const f06src = L(
  '# Audit helpers.',
  '',
  '',
  'def fmt_event(e):',
  '    return str(e.get(' + Q + 'kind' + Q + ', ' + Q + '?' + Q + ')) + ' + Q + ':' + Q + ' + str(e.get(' + Q + 'who' + Q + ', ' + Q + '?' + Q + '))',
  '',
  '',
  'def is_error(e):',
  '    return str(e.get(' + Q + 'kind' + Q + ', ' + Q + Q + ')) == ' + Q + 'error' + Q,
  '',
  '',
  'def summary(events):',
  '    return ' + Q + ', ' + Q + '.join(fmt_event(e) for e in events)',
);

export const TASKS4B = [
  {
    id: 'e05',
    lead: 'board.py', language: 'py', run_with: 'python',
    goal: 'Add a draft list to the EXISTING Board in board.py: add_draft(item) appends a draft and '
      + 'draft_count() returns how many drafts have been added. Keep pin, unpin, pin_count and '
      + 'pin_report working exactly as they do now. Run it with python.',
    analogy: 'the draft list works the same way as the existing pins list',
    interface: ['add_draft', 'draft_count'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing pins list as the relation to parallel; that '
      + 'feature declares state and has two mutators and two readers, while the requested delta names '
      + 'only an appender and a count, so it occupies a strict subset of those positions',
    structural_class: 'parallel-state-feature',
    source: e05src,
    operations: [
      { id: 'op1', intent: 'declare the parallel list',
        anchor: '        self._pins = []' + NL,
        code: '        self._drafts = []' + NL },
      { id: 'op2', intent: 'appender for the parallel list',
        anchor: '    def pin(self, item):' + NL + '        self._pins.append(item)' + NL,
        code: L('',
          '    def add_draft(self, item):',
          '        self._drafts.append(item)') },
      { id: 'op3', intent: 'count for the parallel list',
        anchor: '    def pin_count(self):' + NL + '        return len(self._pins)' + NL,
        code: L('',
          '    def draft_count(self):',
          '        return len(self._drafts)') },
    ],
    dependency_edges: [['op1', 'op2'], ['op1', 'op3']],
    preservation_probe: L(
      'import board',
      'b = board.Board()',
      'b.pin("a"); b.pin("b")',
      'assert b.pin_count() == 2, b.pin_count()',
      'b.unpin("a")',
      'assert b.pin_count() == 1, b.pin_count()',
      'assert b.pin_report() == "b", b.pin_report()',
      'print("OK")'),
    delta_probe: L(
      'import board',
      'b = board.Board()',
      'assert b.draft_count() == 0, b.draft_count()',
      'b.add_draft("x"); b.add_draft("y")',
      'assert b.draft_count() == 2, b.draft_count()',
      'b.pin("a")',
      'assert b.draft_count() == 2, "the two lists must stay separate"',
      'assert b.pin_count() == 1 and b.pin_report() == "a"',
      'print("OK")'),
  },

  {
    id: 'e06',
    lead: 'report.py', language: 'py', run_with: 'python',
    goal: 'Add a tsv format to the EXISTING report.py: dumping tsv joins the cells of each row with a '
      + 'tab and the rows with a newline. The format must be accepted by valid_formats, labelled '
      + '"tab separated" by label, and produced by dump. The json and csv formats must keep working '
      + 'exactly as they do now. Run it with python.',
    analogy: 'the tsv format is written the same way as the existing csv format',
    interface: ['tsv'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing csv format as the relation to parallel; that '
      + 'format occupies the format list, the label map, the alias map, its own dumper and a branch of '
      + 'the dispatcher, while the requested delta names acceptance, a label and production only, so '
      + 'it occupies a strict subset of those positions',
    structural_class: 'parallel-variant-feature',
    source: e06src,
    operations: [
      { id: 'op1', intent: 'admit the new format in the format list',
        anchor: 'FORMATS = [' + Q + 'json' + Q + ', ' + Q + 'csv' + Q,
        code: ', ' + Q + 'tsv' + Q },
      { id: 'op2', intent: 'label the new format',
        anchor: Q + 'csv' + Q + ': ' + Q + 'comma separated' + Q,
        code: ', ' + Q + 'tsv' + Q + ': ' + Q + 'tab separated' + Q },
      { id: 'op3', intent: 'the dumper for the new format',
        anchor: 'def label(f):' + NL + '    return FORMAT_LABELS.get(f, ' + Q + 'unknown' + Q + ')' + NL,
        code: L('',
          '',
          'def _dump_tsv(rows):',
          '    return ' + Q + '\\n' + Q + '.join(' + Q + '\\t' + Q + '.join(str(c) for c in r) for r in rows)') },
      { id: 'op4', intent: 'the branch that routes the new format to its dumper',
        anchor: '    if fmt == ' + Q + 'csv' + Q + ':' + NL + '        return _dump_csv(rows)' + NL,
        code: L('    if fmt == ' + Q + 'tsv' + Q + ':',
          '        return _dump_tsv(rows)') },
    ],
    dependency_edges: [['op3', 'op4'], ['op1', 'op4']],
    preservation_probe: L(
      'import report',
      'assert report.valid_formats(["json", "csv"])',
      'assert not report.valid_formats(["xml"])',
      'assert report.label("csv") == "comma separated", report.label("csv")',
      'assert report.resolve_alias("comma") == "csv", report.resolve_alias("comma")',
      'assert report.dump("csv", [["a", "b"], ["c", "d"]]) == "a,b" + chr(10) + "c,d", report.dump("csv", [["a", "b"], ["c", "d"]])',
      'assert report.dump("xml", []) == ""',
      'print("OK")'),
    delta_probe: L(
      'import report',
      'assert report.valid_formats(["tsv"]), "the new format must be admitted"',
      'assert report.label("tsv") == "tab separated", report.label("tsv")',
      'want = "a" + chr(9) + "b" + chr(10) + "c" + chr(9) + "d"',
      'assert report.dump("tsv", [["a", "b"], ["c", "d"]]) == want, report.dump("tsv", [["a", "b"], ["c", "d"]])',
      'assert report.dump("csv", [["a", "b"]]) == "a,b", "existing formats unchanged"',
      'print("OK")'),
  },

  {
    id: 'f05',
    lead: 'colors.py', language: 'py', run_with: 'python',
    goal: 'Add a named colour registry to the EXISTING colors.py: name_color(name, h) records a hex '
      + 'colour under a name, and lookup(name) returns the hex recorded for that name, or None when '
      + 'nothing was recorded under it. Keep to_rgb, luminance and is_dark working exactly as they do '
      + 'now. Run it with python.',
    interface: ['name_color', 'lookup', 'name'],
    analogy_class: 'no_supported_analogy',
    analogy_justification: 'every function in this file computes from its argument and retains nothing '
      + 'between calls, so a registry that remembers what previous calls recorded has no structural '
      + 'relation here to parallel',
    structural_class: 'novel-state-feature',
    source: f05src,
    operations: [
      { id: 'op1', intent: 'declare the across-call registry the new behaviour needs',
        anchor: '# Colour helpers.' + NL,
        code: L('', '_NAMED = {}') },
      { id: 'op2', intent: 'the recorder, using that registry',
        anchor: 'def luminance(rgb):' + NL
          + '    return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000.0' + NL,
        code: L('',
          '',
          'def name_color(name, h):',
          '    _NAMED[name] = h',
          '    return h') },
      { id: 'op3', intent: 'the reader over that registry',
        anchor: 'def is_dark(h):' + NL + '    return luminance(to_rgb(h)) < 128' + NL,
        code: L('',
          '',
          'def lookup(name):',
          '    return _NAMED.get(name)') },
    ],
    dependency_edges: [['op1', 'op2'], ['op1', 'op3']],
    preservation_probe: L(
      'import colors',
      'assert colors.to_rgb("#ff0000") == (255, 0, 0), colors.to_rgb("#ff0000")',
      'assert colors.luminance((255, 255, 255)) == 255.0, colors.luminance((255, 255, 255))',
      'assert colors.is_dark("#000000")',
      'assert not colors.is_dark("#ffffff")',
      'print("OK")'),
    delta_probe: L(
      'import colors',
      'assert colors.lookup("brand") is None, "nothing recorded yet"',
      'assert colors.name_color("brand", "#123456") == "#123456"',
      'colors.name_color("accent", "#abcdef")',
      'assert colors.lookup("brand") == "#123456", colors.lookup("brand")',
      'assert colors.lookup("accent") == "#abcdef"',
      'assert colors.lookup("missing") is None',
      'assert colors.is_dark("#000000"), "the existing helpers must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'f06',
    lead: 'audit.py', language: 'py', run_with: 'python',
    goal: 'Add a bounded log to the EXISTING audit.py: record(e) appends an event and returns it, '
      + 'keeping only the most recent MAX_LOG events, and history() returns the events kept so far as '
      + 'a new list that callers may modify without affecting the log. Set MAX_LOG to 50. Keep '
      + 'fmt_event, is_error and summary working exactly as they do now. Run it with python.',
    interface: ['record', 'history', 'MAX_LOG'],
    analogy_class: 'no_supported_analogy',
    analogy_justification: 'every function in this file formats or inspects the arguments it is given '
      + 'and retains nothing between calls, so an append-only log with a retention bound has no '
      + 'structural relation here to parallel',
    structural_class: 'novel-state-feature',
    source: f06src,
    operations: [
      { id: 'op1', intent: 'declare the across-call store the new behaviour needs',
        anchor: '# Audit helpers.' + NL,
        code: L('', '_LOG = []') },
      { id: 'op2', intent: 'the retention bound the new behaviour is specified against',
        anchor: 'def fmt_event(e):' + NL
          + '    return str(e.get(' + Q + 'kind' + Q + ', ' + Q + '?' + Q + ')) + ' + Q + ':' + Q
          + ' + str(e.get(' + Q + 'who' + Q + ', ' + Q + '?' + Q + '))' + NL,
        code: L('', '', 'MAX_LOG = 50') },
      { id: 'op3', intent: 'the recorder, using the store and the bound',
        anchor: 'def is_error(e):' + NL
          + '    return str(e.get(' + Q + 'kind' + Q + ', ' + Q + Q + ')) == ' + Q + 'error' + Q + NL,
        code: L('',
          '',
          'def record(e):',
          '    _LOG.append(e)',
          '    while len(_LOG) > MAX_LOG:',
          '        _LOG.pop(0)',
          '    return e') },
      { id: 'op4', intent: 'the reader over the store',
        anchor: 'def summary(events):' + NL
          + '    return ' + Q + ', ' + Q + '.join(fmt_event(e) for e in events)' + NL,
        code: L('',
          '',
          'def history():',
          '    return list(_LOG)') },
    ],
    dependency_edges: [['op1', 'op3'], ['op2', 'op3'], ['op1', 'op4']],
    preservation_probe: L(
      'import audit',
      'assert audit.fmt_event({"kind": "login", "who": "ann"}) == "login:ann", audit.fmt_event({"kind": "login", "who": "ann"})',
      'assert audit.fmt_event({}) == "?:?"',
      'assert audit.is_error({"kind": "error"})',
      'assert not audit.is_error({"kind": "login"})',
      'assert audit.summary([{"kind": "a", "who": "b"}]) == "a:b"',
      'print("OK")'),
    delta_probe: L(
      'import audit',
      'assert audit.MAX_LOG == 50, audit.MAX_LOG',
      'assert audit.history() == [], audit.history()',
      'assert audit.record({"kind": "k0", "who": "w"}) == {"kind": "k0", "who": "w"}',
      'for i in range(1, 60):',
      '    audit.record({"kind": "k" + str(i), "who": "w"})',
      'h = audit.history()',
      'assert len(h) == 50, len(h)',
      'assert h[0]["kind"] == "k10", h[0]["kind"]',
      'assert h[-1]["kind"] == "k59", h[-1]["kind"]',
      'h.append("junk")',
      'assert len(audit.history()) == 50, "history must return a copy"',
      'assert audit.is_error({"kind": "error"}), "the existing helpers must be unchanged"',
      'print("OK")'),
  },
];
