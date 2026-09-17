// Task family, part 2: the 3- and 4-operation matched pairs.
//
// Same construction procedure. Sources freshly authored. Rule 13 matching:
//
//     ops   analogy_specified        no_supported_analogy
//      3    a02 hourly buckets       b02 continuation lines
//      4    a03 date column          b03 nested comments
const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL) + NL;
const Q = String.fromCharCode(34);       // a literal double quote, kept out of the JS string soup

// ---------------------------------------------------------------------------------------------------
// a02 — ANALOGY. A per-day metric exists across a declaration, a recorder and two readers. The hourly
// feature is asked for as the same thing at a different granularity.
const a02src = L(
  'class Metrics:',
  '    def __init__(self):',
  '        self._daily = {}',
  '',
  '    def record_day(self, day, n):',
  '        self._daily[day] = self._daily.get(day, 0) + n',
  '',
  '    def day_total(self, day):',
  '        return self._daily.get(day, 0)',
  '',
  '    def busiest_day(self):',
  '        if not self._daily:',
  '            return None',
  '        return max(sorted(self._daily), key=lambda d: self._daily[d])',
);

// ---------------------------------------------------------------------------------------------------
// b02 — NO ANALOGUE. Every rule in this parser decides about one line in isolation; nothing carries
// state between iterations, so a continuation has no structural precedent here.
const b02src = L(
  'def parse_config(text):',
  '    result = {}',
  '    for raw in str(text).split(' + Q + '\\n' + Q + '):',
  '        line = raw.strip()',
  '        if not line or line.startswith(' + Q + '#' + Q + '):',
  '            continue',
  '        if ' + Q + '=' + Q + ' in line:',
  '            key, value = line.split(' + Q + '=' + Q + ', 1)',
  '            result[key.strip()] = value.strip()',
  '    return result',
);

// ---------------------------------------------------------------------------------------------------
// a03 — ANALOGY. The quoted column type participates in four places: the valid-type list, its formatter,
// its branch in the row formatter, and the label map.
const a03src = L(
  'COLUMN_TYPES = [' + Q + 'plain' + Q + ', ' + Q + 'quoted' + Q + ']',
  '',
  'TYPE_LABELS = {' + Q + 'plain' + Q + ': ' + Q + 'text' + Q + ', ' + Q + 'quoted' + Q + ': ' + Q + 'quoted text' + Q + '}',
  '',
  '',
  'def _fmt_quoted(v):',
  '    return ' + Q + '\\' + Q + Q + ' + str(v).replace(' + Q + '\\' + Q + Q + ', ' + Q + '\\' + Q + '\\' + Q + Q + ') + ' + Q + '\\' + Q + Q,
  '',
  '',
  'def label(t):',
  '    return TYPE_LABELS.get(t, ' + Q + 'unknown' + Q + ')',
  '',
  '',
  'def valid_types(types):',
  '    return all(t in COLUMN_TYPES for t in types)',
  '',
  '',
  'def format_row(values, types):',
  '    out = []',
  '    for v, t in zip(values, types):',
  '        if t == ' + Q + 'quoted' + Q + ':',
  '            out.append(_fmt_quoted(v))',
  '            continue',
  '        out.append(str(v))',
  '    return ' + Q + ',' + Q + '.join(out)',
);

// ---------------------------------------------------------------------------------------------------
// b03 — NO ANALOGUE. The scanner advances one character at a time and holds no state across iterations;
// nesting requires a depth counter and two-character lookahead, neither of which appears in the file.
const b03src = L(
  'def tokens(text):',
  '    out = []',
  '    s = str(text)',
  '    i = 0',
  '    while i < len(s):',
  '        c = s[i]',
  '        if c.isspace():',
  '            i += 1',
  '            continue',
  '        if c.isdigit():',
  '            j = i',
  '            while j < len(s) and s[j].isdigit():',
  '                j += 1',
  '            out.append((' + Q + 'num' + Q + ', s[i:j]))',
  '            i = j',
  '            continue',
  '        out.append((' + Q + 'sym' + Q + ', c))',
  '        i += 1',
  '    return out',
);

export const TASKS2 = [
  {
    id: 'a02',
    lead: 'metrics.py', language: 'py', run_with: 'python',
    goal: 'Add hourly tracking to the EXISTING Metrics in metrics.py: record_hour(hour, n) accumulates '
      + 'a count for an hour, hour_total(hour) returns the count for an hour and 0 when there is none, '
      + 'and busiest_hour() returns the hour with the highest count, or None when nothing has been '
      + 'recorded. Keep the daily tracking working exactly as it does now. Run it with python.',
    analogy: 'the hourly tracking works the same way as the existing daily tracking',
    interface: ['record_hour', 'hour_total', 'busiest_hour', 'hour'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing daily-tracking feature as the relation to '
      + 'parallel; that feature occupies a declaration, a recorder and two readers, and the requested '
      + 'feature occupies the same positions at a different granularity',
    structural_class: 'parallel-state-feature',
    source: a02src,
    operations: [
      { id: 'op1', intent: 'declare the parallel accumulator',
        anchor: '        self._daily = {}' + NL,
        code: '        self._hourly = {}' + NL },
      { id: 'op2', intent: 'the parallel recorder',
        anchor: '    def record_day(self, day, n):' + NL + '        self._daily[day] = self._daily.get(day, 0) + n' + NL,
        code: L('',
          '    def record_hour(self, hour, n):',
          '        self._hourly[hour] = self._hourly.get(hour, 0) + n') },
      { id: 'op3', intent: 'the parallel readers',
        anchor: '        return max(sorted(self._daily), key=lambda d: self._daily[d])' + NL,
        code: L('',
          '    def hour_total(self, hour):',
          '        return self._hourly.get(hour, 0)',
          '',
          '    def busiest_hour(self):',
          '        if not self._hourly:',
          '            return None',
          '        return max(sorted(self._hourly), key=lambda h: self._hourly[h])') },
    ],
    dependency_edges: [['op1', 'op2'], ['op1', 'op3']],
    preservation_probe: L(
      'import metrics',
      'm = metrics.Metrics()',
      'm.record_day("mon", 2); m.record_day("mon", 3); m.record_day("tue", 1)',
      'assert m.day_total("mon") == 5, m.day_total("mon")',
      'assert m.day_total("sun") == 0',
      'assert m.busiest_day() == "mon", m.busiest_day()',
      'assert metrics.Metrics().busiest_day() is None',
      'print("OK")'),
    delta_probe: L(
      'import metrics',
      'm = metrics.Metrics()',
      'assert m.busiest_hour() is None',
      'm.record_hour(9, 4); m.record_hour(9, 1); m.record_hour(17, 2)',
      'assert m.hour_total(9) == 5, m.hour_total(9)',
      'assert m.hour_total(3) == 0',
      'assert m.busiest_hour() == 9, m.busiest_hour()',
      'm.record_day("mon", 7)',
      'assert m.day_total("mon") == 7 and m.hour_total(9) == 5, "daily and hourly must stay separate"',
      'print("OK")'),
  },

  {
    id: 'b02',
    lead: 'config.py', language: 'py', run_with: 'python',
    goal: 'Add line continuation to parse_config in the EXISTING config.py: a line whose stripped text '
      + 'ends with three dots continues onto the next line, with the dots removed and the two joined '
      + 'before the line is interpreted. Blank lines, comment lines and ordinary key/value lines must '
      + 'keep working exactly as they do now. Run it with python.',
    interface: [],
    analogy_class: 'no_supported_analogy',
    analogy_justification: 'every existing rule in this parser decides about one line in isolation and '
      + 'nothing carries state between iterations, so there is no structural relation for a multi-line '
      + 'continuation to parallel',
    structural_class: 'novel-state-feature',
    source: b02src,
    operations: [
      { id: 'op1', intent: 'declare the buffer that carries text between iterations',
        anchor: '    result = {}' + NL,
        code: '    pending = ' + Q + Q + NL },
      { id: 'op2', intent: 'join any carried text onto the current line before it is interpreted',
        anchor: '        line = raw.strip()' + NL,
        code: L('        if pending:',
          '            line = pending + line',
          '            pending = ' + Q + Q) },
      { id: 'op3', intent: 'detect the continuation marker and carry the line forward instead of interpreting it',
        anchor: '        if not line or line.startswith(' + Q + '#' + Q + '):' + NL + '            continue' + NL,
        code: L('        if line.endswith(' + Q + '...' + Q + '):',
          '            pending = line[:-3]',
          '            continue') },
    ],
    dependency_edges: [['op1', 'op2'], ['op1', 'op3'], ['op3', 'op2']],
    preservation_probe: L(
      'import config',
      'r = config.parse_config("a = 1\\n\\n# note\\nb = two")',
      'assert r == {"a": "1", "b": "two"}, r',
      'assert config.parse_config("") == {}',
      'assert config.parse_config("# only a comment") == {}',
      'print("OK")'),
    delta_probe: L(
      'import config',
      'r = config.parse_config("a = one...\\ntwo")',
      'assert r == {"a": "onetwo"}, r',
      'r2 = config.parse_config("x = 1\\nb = left...\\nright\\ny = 2")',
      'assert r2 == {"x": "1", "b": "leftright", "y": "2"}, r2',
      'assert config.parse_config("k = plain") == {"k": "plain"}',
      'print("OK")'),
  },

  {
    id: 'a03',
    lead: 'csvfmt.py', language: 'py', run_with: 'python',
    goal: 'Add a date column type to the EXISTING csvfmt.py: a date value is a (year, month, day) tuple '
      + 'and formats as YYYY-MM-DD with month and day zero-padded to two digits. The type must be '
      + 'accepted by valid_types, formatted by format_row, and labelled as "date" by label. The plain '
      + 'and quoted column types must keep working exactly as they do now. Run it with python.',
    analogy: 'the date column type is written the same way as the existing quoted column type',
    interface: ['date'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing quoted column type as the relation to parallel; '
      + 'that type participates in the valid-type list, its own formatter, a branch of the row '
      + 'formatter and the label map, and the requested type occupies the same four positions',
    structural_class: 'parallel-variant-feature',
    source: a03src,
    operations: [
      { id: 'op1', intent: 'admit the new type in the valid-type list',
        anchor: 'COLUMN_TYPES = [' + Q + 'plain' + Q + ', ' + Q + 'quoted' + Q,
        code: ', ' + Q + 'date' + Q },
      { id: 'op2', intent: 'label the new type',
        anchor: Q + 'quoted' + Q + ': ' + Q + 'quoted text' + Q,
        code: ', ' + Q + 'date' + Q + ': ' + Q + 'date' + Q },
      { id: 'op3', intent: 'the formatter for the new type',
        anchor: 'def label(t):' + NL + '    return TYPE_LABELS.get(t, ' + Q + 'unknown' + Q + ')' + NL,
        code: L('',
          '',
          'def _fmt_date(v):',
          '    y, m, d = v',
          '    return ' + Q + '%04d-%02d-%02d' + Q + ' % (y, m, d)') },
      { id: 'op4', intent: 'the branch that routes the new type to its formatter',
        anchor: '        if t == ' + Q + 'quoted' + Q + ':' + NL + '            out.append(_fmt_quoted(v))' + NL + '            continue' + NL,
        code: L('        if t == ' + Q + 'date' + Q + ':',
          '            out.append(_fmt_date(v))',
          '            continue') },
    ],
    dependency_edges: [['op3', 'op4'], ['op1', 'op4']],
    preservation_probe: L(
      'import csvfmt',
      'assert csvfmt.valid_types(["plain", "quoted"])',
      'assert not csvfmt.valid_types(["nope"])',
      'assert csvfmt.label("plain") == "text"',
      'assert csvfmt.label("nope") == "unknown"',
      'row = csvfmt.format_row(["a", "b,c"], ["plain", "quoted"])',
      'assert row == \'a,"b,c"\', row',
      'print("OK")'),
    delta_probe: L(
      'import csvfmt',
      'assert csvfmt.valid_types(["date"]), "date must be a valid type"',
      'assert csvfmt.label("date") == "date", csvfmt.label("date")',
      'row = csvfmt.format_row([(2026, 9, 5)], ["date"])',
      'assert row == "2026-09-05", row',
      'mixed = csvfmt.format_row(["x", (2026, 12, 31)], ["plain", "date"])',
      'assert mixed == "x,2026-12-31", mixed',
      'print("OK")'),
  },

  {
    id: 'b03',
    lead: 'scan.py', language: 'py', run_with: 'python',
    goal: 'Add nested block comments to tokens in the EXISTING scan.py: text between an opening paren-'
      + 'star and a closing star-paren is skipped entirely and produces no tokens, and these comments '
      + 'nest, so an inner comment does not end the outer one. A comment that is never closed is an '
      + 'error and must raise ValueError. Whitespace, numbers and symbols must '
      + 'keep tokenising exactly as they do now. Run it with python.',
    interface: ['ValueError'],
    analogy_class: 'no_supported_analogy',
    analogy_justification: 'the scanner advances one character at a time and holds no state across '
      + 'iterations; nesting requires a depth counter and two-character lookahead, neither of which '
      + 'appears anywhere in the file, so there is no structural relation to parallel',
    structural_class: 'novel-state-feature',
    source: b03src,
    operations: [
      { id: 'op1', intent: 'a helper that recognises a two-character marker at a position',
        anchor: 'def tokens(text):' + NL,
        code: '' },   // placeholder replaced below
    ],
    dependency_edges: [],
    preservation_probe: '',
    delta_probe: '',
  },
];

// b03 is assembled separately: its first operation is a module-level helper that must precede the
// function, which reads more clearly written out than inlined above.
const b03 = TASKS2[TASKS2.length - 1];
b03.operations = [
  { id: 'op1', intent: 'a helper that recognises a two-character marker at a position',
    anchor: 'def tokens(text):' + NL,
    code: '' },
];
TASKS2[TASKS2.length - 1] = {
  ...b03,
  source: L('def _marker(s, i, a, b):',
    '    return i + 1 < len(s) and s[i] == a and s[i + 1] == b',
    '',
    '') + b03src,
  operations: [
    { id: 'op1', intent: 'declare the nesting depth the new behaviour needs',
      anchor: '    i = 0' + NL,
      code: '    depth = 0' + NL },
    { id: 'op2', intent: 'while inside a comment, track nesting and consume without emitting',
      anchor: '        c = s[i]' + NL,
      code: L('        if depth > 0:',
        '            if _marker(s, i, ' + Q + '(' + Q + ', ' + Q + '*' + Q + '):',
        '                depth += 1',
        '                i += 2',
        '            elif _marker(s, i, ' + Q + '*' + Q + ', ' + Q + ')' + Q + '):',
        '                depth -= 1',
        '                i += 2',
        '            else:',
        '                i += 1',
        '            continue') },
    { id: 'op3', intent: 'enter a comment when the opening marker appears outside one',
      anchor: '        if c.isspace():' + NL + '            i += 1' + NL + '            continue' + NL,
      code: L('        if _marker(s, i, ' + Q + '(' + Q + ', ' + Q + '*' + Q + '):',
        '            depth += 1',
        '            i += 2',
        '            continue') },
    // The first op4 here was `if depth > 0: break` inside the loop, and the authoring tool REFUSED the
    // task: omitting it still passed the delta, because op2 already consumes an unterminated comment to
    // end of input. It was dead code - the goal-64 defect class, caught at authoring time. Replaced with
    // a genuine specification decision (an unclosed comment is an error), which requires real code after
    // the loop and is exercised by the probe. Not padding: the operation is load-bearing or the tool
    // refuses the task again.
    { id: 'op4', intent: 'reject input that ends while still inside a comment',
      anchor: '        out.append((' + Q + 'sym' + Q + ', c))' + NL + '        i += 1' + NL,
      code: L('    if depth > 0:',
        '        raise ValueError(' + Q + 'unterminated comment' + Q + ')') },
  ],
  dependency_edges: [['op1', 'op2'], ['op1', 'op3'], ['op3', 'op2'], ['op1', 'op4']],
  preservation_probe: L(
    'import scan',
    'assert scan.tokens("12 + 7") == [("num", "12"), ("sym", "+"), ("num", "7")], scan.tokens("12 + 7")',
    'assert scan.tokens("") == []',
    'assert scan.tokens("   ") == []',
    'print("OK")'),
  delta_probe: L(
    'import scan',
    'assert scan.tokens("1 (* c *) 2") == [("num", "1"), ("num", "2")], scan.tokens("1 (* c *) 2")',
    'assert scan.tokens("1 (* a (* b *) c *) 2") == [("num", "1"), ("num", "2")], scan.tokens("1 (* a (* b *) c *) 2")',
    'assert scan.tokens("(* only *)") == []',
    'assert scan.tokens("5") == [("num", "5")]',
    'try:',
    '    scan.tokens("1 (* never closed")',
    '    raise AssertionError("an unclosed comment must raise")',
    'except ValueError:',
    '    pass',
    'print("OK")'),
};
