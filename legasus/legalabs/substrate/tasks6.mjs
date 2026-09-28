// REQUIREMENT-RESOLUTION FAMILY. Authored blind from the case types Amendment C froze, before any
// deriver changes. Revision 2 is frozen; running it against this family is the prospective test of
// whether its requirement model generalizes.
//
//   id   ops  case                                        must
//   h01   2   provider -> IMMEDIATE consumer              order them
//   h02   2   provider -> DEFERRED body consumer          NOT order them
//   h03   3   default argument, definition-time           order them
//   h04   3   same shape, body reference instead          NOT order them
//   h05   3   bare statement requiring TWO providers      order after both
//   h06   3   EXISTING provider and PLANNED provider      distinguish the two sources
//   h07   3   UNRESOLVED requirement (import-provided)    expose it, never invent ordering
//   h08   3   the same shape, fully resolvable            the unresolved path must NOT fire
//
// h03/h04 and h07/h08 are MUST DISTINGUISH pairs: nearly identical programs where one bit of Python
// semantics changes the answer. h03 evaluates its helper in a default argument, which runs when the
// `def` executes; h04 calls it inside the body, which runs only when the function is called. h07's
// provider arrives through `import`, which the current rule cannot resolve; h08's is a module constant
// it can.
//
// CASE 6 IS THE NEW GROUND. In h07 the requirement is real and the constraint is real - execution
// genuinely demands the statement follow the import - but the rule cannot find the provider. Deriving
// nothing there is not the same answer as "there is no dependency", and the family exists partly to
// make that difference measurable.
//
// Rule 13: operation counts are {2,3,3,3} on both the must-order and must-not-order halves.
const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL) + NL;
const Q = String.fromCharCode(34);

const h01src = L(
  '# Counter bootstrap.',
  '',
  'BASE = 10',
  '',
  '',
  'def total(extra):',
  '    return BASE + extra',
);

const h02src = L(
  '# Text tools.',
  '',
  '',
  'def shout(s):',
  '    return _emph(s).upper()',
  '',
  '',
  'def plain(s):',
  '    return str(s).strip()',
);

const h03src = L(
  '# Formatting defaults.',
  '',
  'WIDTH = 8',
  '',
  '',
  'def pad(s):',
  '    return str(s).ljust(WIDTH)',
  '',
  '',
  'def trim(s):',
  '    return str(s).strip()',
);

const h04src = L(
  '# Border drawing.',
  '',
  'THICK = 3',
  '',
  '',
  'def line(n):',
  '    return ' + Q + '-' + Q + ' * n',
);

const h05src = L(
  '# Config assembly.',
  '',
  'CONFIG = {' + Q + 'a' + Q + ': 1}',
  '',
  '',
  'def get(k):',
  '    return CONFIG.get(k)',
  '',
  '',
  'def names():',
  '    return sorted(CONFIG)',
);

const h06src = L(
  '# Rates.',
  '',
  'BASE = 100',
  '',
  '',
  'def apply_rate(x):',
  '    return x * BASE',
);

const h07src = L(
  '# Geometry.',
  '',
  'import math',
  '',
  'RADIUS = 2',
  '',
  '',
  'def area():',
  '    return math.pi * RADIUS * RADIUS',
);

const h08src = L(
  '# Geometry with a local constant.',
  '',
  'PI = 3.14159',
  '',
  'RADIUS = 2',
  '',
  '',
  'def area():',
  '    return PI * RADIUS * RADIUS',
);

export const TASKS6 = [
  {
    id: 'h01',
    lead: 'bootstrap.py', language: 'py', run_with: 'python',
    goal: 'Add a bonus value to the EXISTING bootstrap.py: a helper supplies the bonus 5, and BONUS '
      + 'must hold that value when the module is imported. Keep BASE and total working exactly as they '
      + 'do now. Run it with python.',
    analogy: 'the bonus value is assembled the same way as the existing base value',
    interface: ['BONUS'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing base value as the relation to parallel; that '
      + 'feature is a module constant read by a function, and the new feature occupies the same position',
    structural_class: 'parallel-state-feature',
    source: h01src,
    operations: [
      { id: 'op1', intent: 'the helper supplying the value',
        anchor: 'BASE = 10' + NL,
        code: L('', '', 'def _bonus():', '    return 5') },
      { id: 'op2', intent: 'bind the value at import time from that helper',
        anchor: 'def total(extra):' + NL + '    return BASE + extra' + NL,
        code: L('', '', 'BONUS = _bonus()') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L('import bootstrap',
      'assert bootstrap.BASE == 10, bootstrap.BASE',
      'assert bootstrap.total(1) == 11, bootstrap.total(1)',
      'print("OK")'),
    delta_probe: L('import bootstrap',
      'assert bootstrap.BONUS == 5, bootstrap.BONUS',
      'assert bootstrap.total(2) == 12, "the existing helper must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'h02',
    lead: 'texttools.py', language: 'py', run_with: 'python',
    goal: 'Add the missing emphasis helper to the EXISTING texttools.py: _emph(s) appends an '
      + 'exclamation mark to the text so that shout works. Also add shout_twice(s), which returns the '
      + 'shouted text repeated twice. Keep plain working exactly as it does now. Run it with python.',
    analogy: 'the emphasis helper works the same way as the existing plain helper',
    interface: ['shout_twice'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing plain helper as the relation to parallel; that '
      + 'feature is a module-level function transforming the text, and the new helpers occupy the same '
      + 'position',
    structural_class: 'parallel-state-feature',
    source: h02src,
    operations: [
      { id: 'op1', intent: 'the helper that shout already refers to',
        anchor: 'def plain(s):' + NL + '    return str(s).strip()' + NL,
        code: L('', '', 'def _emph(s):', '    return str(s) + ' + Q + '!' + Q) },
      { id: 'op2', intent: 'a function built on the existing shout',
        anchor: 'def shout(s):' + NL + '    return _emph(s).upper()' + NL,
        code: L('', '', 'def shout_twice(s):', '    return shout(s) + shout(s)') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L('import texttools',
      'assert texttools.plain("  a ") == "a", texttools.plain("  a ")',
      'print("OK")'),
    delta_probe: L('import texttools',
      'assert texttools.shout("ab") == "AB!", texttools.shout("ab")',
      'assert texttools.shout_twice("a") == "A!A!", texttools.shout_twice("a")',
      'assert texttools.plain(" b ") == "b", "the existing helper must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'h03',
    lead: 'formatting.py', language: 'py', run_with: 'python',
    goal: 'Add rule drawing to the EXISTING formatting.py: a helper supplies the dash character, '
      + 'rule(n) draws a rule n characters wide using it as the default character, and rule_width() '
      + 'draws one WIDTH characters wide. The default character must be taken when each function is '
      + 'defined. Keep WIDTH and pad working exactly as they do now. Run it with python.',
    analogy: 'the rule drawing works the same way as the existing padding',
    interface: ['rule', 'rule_width'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing padding as the relation to parallel; that '
      + 'feature is a module-level function reading the shared WIDTH, and the new functions occupy the '
      + 'same position',
    structural_class: 'parallel-state-feature',
    source: h03src,
    operations: [
      { id: 'op1', intent: 'the helper supplying the character',
        anchor: 'WIDTH = 8' + NL,
        code: L('', '', 'def _dash():', '    return ' + Q + '-' + Q) },
      { id: 'op2', intent: 'a function whose DEFAULT argument calls that helper at definition time',
        anchor: 'def pad(s):' + NL + '    return str(s).ljust(WIDTH)' + NL,
        code: L('', '', 'def rule(n, ch=_dash()):', '    return ch * n') },
      { id: 'op3', intent: 'a second function taking the same definition-time default',
        anchor: 'def trim(s):' + NL + '    return str(s).strip()' + NL,
        code: L('', '', 'def rule_width(ch=_dash()):', '    return ch * WIDTH') },
    ],
    dependency_edges: [['op1', 'op2'], ['op1', 'op3']],
    preservation_probe: L('import formatting',
      'assert formatting.WIDTH == 8',
      'assert formatting.pad("ab") == "ab      ", repr(formatting.pad("ab"))',
      'assert formatting.trim("  a ") == "a", formatting.trim("  a ")',
      'print("OK")'),
    delta_probe: L('import formatting',
      'assert formatting.rule(3) == "---", formatting.rule(3)',
      'assert formatting.rule(2, "=") == "==", formatting.rule(2, "=")',
      'assert formatting.rule_width() == "--------", formatting.rule_width()',
      'assert formatting.pad("a") == "a       ", "the existing helper must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'h04',
    lead: 'border.py', language: 'py', run_with: 'python',
    goal: 'Add star drawing to the EXISTING border.py: a helper supplies the star character, star(n) '
      + 'draws n stars by calling that helper, and star_thick() draws THICK of them. Keep THICK and '
      + 'line working exactly as they do now. Run it with python.',
    analogy: 'the star drawing works the same way as the existing line drawing',
    interface: ['star', 'star_thick'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing line drawing as the relation to parallel; that '
      + 'feature is a module-level function building a repeated character, and the new functions '
      + 'occupy the same position',
    structural_class: 'parallel-state-feature',
    source: h04src,
    operations: [
      { id: 'op1', intent: 'the helper supplying the character',
        anchor: 'THICK = 3' + NL,
        code: L('', '', 'def _mark():', '    return ' + Q + '*' + Q) },
      { id: 'op2', intent: 'a function calling that helper INSIDE its body',
        anchor: 'def line(n):' + NL + '    return ' + Q + '-' + Q + ' * n' + NL,
        code: L('', '', 'def star(n):', '    return _mark() * n') },
      { id: 'op3', intent: 'a second function calling the first inside its body',
        anchor: '# Border drawing.' + NL,
        code: L('', 'def star_thick():', '    return star(THICK)') },
    ],
    dependency_edges: [['op1', 'op2'], ['op2', 'op3']],
    preservation_probe: L('import border',
      'assert border.THICK == 3',
      'assert border.line(2) == "--", border.line(2)',
      'print("OK")'),
    delta_probe: L('import border',
      'assert border.star(2) == "**", border.star(2)',
      'assert border.star_thick() == "***", border.star_thick()',
      'assert border.line(1) == "-", "the existing helper must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'h05',
    lead: 'config.py', language: 'py', run_with: 'python',
    goal: 'Add two extra settings groups to the EXISTING config.py: one helper supplies b as 2, '
      + 'another supplies c as 3, and both must be merged into CONFIG when the module is imported. '
      + 'Keep the a setting and get working exactly as they do now. Run it with python.',
    analogy: 'the extra settings are merged the same way as the existing settings are declared',
    interface: ['b', 'c'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing settings declaration as the relation to '
      + 'parallel; that feature is a module-level mapping read by an accessor, and the new groups '
      + 'occupy the same position over the same mapping',
    structural_class: 'parallel-state-feature',
    source: h05src,
    operations: [
      { id: 'op1', intent: 'the first supplying helper',
        anchor: 'CONFIG = {' + Q + 'a' + Q + ': 1}' + NL,
        code: L('', '', 'def _extra():', '    return {' + Q + 'b' + Q + ': 2}') },
      { id: 'op2', intent: 'the second supplying helper',
        anchor: 'def get(k):' + NL + '    return CONFIG.get(k)' + NL,
        code: L('', '', 'def _more():', '    return {' + Q + 'c' + Q + ': 3}') },
      { id: 'op3', intent: 'a bare statement merging BOTH, providing nothing itself',
        anchor: 'def names():' + NL + '    return sorted(CONFIG)' + NL,
        code: L('', '', 'CONFIG.update(_extra())', 'CONFIG.update(_more())') },
    ],
    dependency_edges: [['op1', 'op3'], ['op2', 'op3']],
    preservation_probe: L('import config',
      'assert config.get("a") == 1, config.get("a")',
      'assert config.get("zz") is None',
      'assert "a" in config.names(), config.names()',
      'print("OK")'),
    delta_probe: L('import config',
      'assert config.get("b") == 2, config.get("b")',
      'assert config.get("c") == 3, config.get("c")',
      'assert config.get("a") == 1, "the existing setting must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'h06',
    lead: 'rates.py', language: 'py', run_with: 'python',
    goal: 'Add a scaled rate to the EXISTING rates.py: a helper supplies the factor 2, SCALED must '
      + 'hold the base rate multiplied by that factor when the module is imported, and scaled() '
      + 'returns it. Keep BASE and apply_rate working exactly as they do now. Run it with python.',
    analogy: 'the scaled rate is assembled the same way as the existing base rate',
    interface: ['SCALED', 'scaled'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing base rate as the relation to parallel; that '
      + 'feature is a module constant read by a function, and the new feature occupies the same position',
    structural_class: 'parallel-state-feature',
    source: h06src,
    operations: [
      { id: 'op1', intent: 'the helper supplying the factor',
        anchor: 'BASE = 100' + NL,
        code: L('', '', 'def _factor():', '    return 2') },
      { id: 'op2', intent: 'a statement requiring an EXISTING provider and a PLANNED one',
        anchor: 'def apply_rate(x):' + NL + '    return x * BASE' + NL,
        code: L('', '', 'SCALED = BASE * _factor()') },
      { id: 'op3', intent: 'the accessor',
        anchor: '# Rates.' + NL,
        code: L('', 'def scaled():', '    return SCALED') },
    ],
    dependency_edges: [['op1', 'op2'], ['op2', 'op3']],
    preservation_probe: L('import rates',
      'assert rates.BASE == 100',
      'assert rates.apply_rate(2) == 200, rates.apply_rate(2)',
      'print("OK")'),
    delta_probe: L('import rates',
      'assert rates.SCALED == 200, rates.SCALED',
      'assert rates.scaled() == 200, rates.scaled()',
      'assert rates.apply_rate(1) == 100, "the existing helper must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'h07',
    lead: 'geometry.py', language: 'py', run_with: 'python',
    goal: 'Add a rounded tau to the EXISTING geometry.py: a helper rounds a value to two decimal '
      + 'places, TAU must hold two pi rounded that way when the module is imported, and tau() returns '
      + 'it. Keep RADIUS and area working exactly as they do now. Run it with python.',
    analogy: 'the tau value is assembled the same way as the existing area computation',
    interface: ['TAU', 'tau'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing area computation as the relation to parallel; '
      + 'that feature reads the shared constants at module level, and the new value occupies the same '
      + 'position',
    structural_class: 'parallel-state-feature',
    source: h07src,
    operations: [
      { id: 'op1', intent: 'the rounding helper',
        anchor: 'RADIUS = 2' + NL,
        code: L('', '', 'def _round2(v):', '    return round(v, 2)') },
      { id: 'op2', intent: 'a statement requiring a PLANNED provider and an IMPORT-provided one',
        anchor: 'def area():' + NL + '    return math.pi * RADIUS * RADIUS' + NL,
        code: L('', '', 'TAU = _round2(2 * math.pi)') },
      { id: 'op3', intent: 'the accessor',
        anchor: '# Geometry.' + NL,
        code: L('', 'def tau():', '    return TAU') },
    ],
    dependency_edges: [['op1', 'op2'], ['op2', 'op3']],
    preservation_probe: L('import geometry',
      'assert geometry.RADIUS == 2',
      'assert abs(geometry.area() - 12.566) < 0.01, geometry.area()',
      'print("OK")'),
    delta_probe: L('import geometry',
      'assert geometry.TAU == 6.28, geometry.TAU',
      'assert geometry.tau() == 6.28, geometry.tau()',
      'assert abs(geometry.area() - 12.566) < 0.01, "the existing helper must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'h08',
    lead: 'geolocal.py', language: 'py', run_with: 'python',
    goal: 'Add a rounded tau to the EXISTING geolocal.py: a helper rounds a value to two decimal '
      + 'places, TAU must hold two times PI rounded that way when the module is imported, and tau() '
      + 'returns it. Keep RADIUS and area working exactly as they do now. Run it with python.',
    analogy: 'the tau value is assembled the same way as the existing area computation',
    interface: ['TAU', 'tau'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing area computation as the relation to parallel; '
      + 'that feature reads the shared constants at module level, and the new value occupies the same '
      + 'position',
    structural_class: 'parallel-state-feature',
    source: h08src,
    operations: [
      { id: 'op1', intent: 'the rounding helper',
        anchor: 'RADIUS = 2' + NL,
        code: L('', '', 'def _round2(v):', '    return round(v, 2)') },
      { id: 'op2', intent: 'a statement whose requirements are ALL resolvable in the program',
        anchor: 'def area():' + NL + '    return PI * RADIUS * RADIUS' + NL,
        code: L('', '', 'TAU = _round2(2 * PI)') },
      { id: 'op3', intent: 'the accessor',
        anchor: '# Geometry with a local constant.' + NL,
        code: L('', 'def tau():', '    return TAU') },
    ],
    dependency_edges: [['op1', 'op2'], ['op2', 'op3']],
    preservation_probe: L('import geolocal',
      'assert geolocal.RADIUS == 2',
      'assert abs(geolocal.area() - 12.566) < 0.01, geolocal.area()',
      'print("OK")'),
    delta_probe: L('import geolocal',
      'assert geolocal.TAU == 6.28, geolocal.TAU',
      'assert geolocal.tau() == 6.28, geolocal.tau()',
      'assert abs(geolocal.area() - 12.566) < 0.01, "the existing helper must be unchanged"',
      'print("OK")'),
  },
];
