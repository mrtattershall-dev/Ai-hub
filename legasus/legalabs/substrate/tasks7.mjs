// UNRESOLVED-PROVIDER PAIR. Two tasks, authored after revision 3 was frozen.
//
// THE DESIGN CONSTRAINT THAT h07 VIOLATED. h07 was meant to test the unresolved path and could not,
// because a second, resolvable requirement in the same operation produced the same region on its own.
// The path-sensitivity rule now demands the opposite be proven in advance:
//
//     the unresolved requirement must be the ONLY mechanism capable of producing the expected
//     narrowing.
//
// So `import math` is placed DEEP IN THE FILE, after two module-level constants. The boundaries above
// it are ordinary module-level positions:
//
//     - no body encloses them, so `ownership_boundary` cannot remove them
//     - no terminator precedes them at module indent, so `control_flow_boundary` cannot
//     - the operation has exactly ONE immediate requirement, so no other symbol constraint can
//
// The only reason a position above the import is illegal is that `math` does not exist there yet. If
// the deriver cannot resolve `math`, those positions MUST survive - and the miss is then attributable
// to the unresolved path and to nothing else.
//
//   i01   2 ops   provider arrives through `import math`        UNRESOLVED - expected to miss
//   i02   2 ops   provider is the module constant `PI`          RESOLVED control - expected to recover
//
// The two files are identical apart from that one line, so a difference between them isolates exactly
// one variable.
const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL) + NL;

const i01src = L(
  '# Geometry constants.',
  '',
  'WIDTH = 4',
  '',
  'HEIGHT = 3',
  '',
  'import math',
  '',
  'RADIUS = 2',
  '',
  '',
  'def area():',
  '    return math.pi * RADIUS * RADIUS',
  '',
  '',
  'def box():',
  '    return WIDTH * HEIGHT',
);

const i02src = L(
  '# Geometry constants.',
  '',
  'WIDTH = 4',
  '',
  'HEIGHT = 3',
  '',
  'PI = 3.14159',
  '',
  'RADIUS = 2',
  '',
  '',
  'def area():',
  '    return PI * RADIUS * RADIUS',
  '',
  '',
  'def box():',
  '    return WIDTH * HEIGHT',
);

export const TASKS7 = [
  {
    id: 'i01',
    lead: 'geoconst.py', language: 'py', run_with: 'python',
    goal: 'Add a tau constant to the EXISTING geoconst.py: TAU must hold two times pi when the module '
      + 'is imported, and tau() returns it. Keep WIDTH, HEIGHT, RADIUS, area and box working exactly '
      + 'as they do now. Run it with python.',
    analogy: 'the tau constant is assembled the same way as the existing area computation',
    interface: ['TAU', 'tau'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing area computation as the relation to parallel; '
      + 'that feature reads the shared constants at module level, and the new constant occupies the '
      + 'same position',
    structural_class: 'parallel-state-feature',
    source: i01src,
    operations: [
      { id: 'op1', intent: 'bind the constant, requiring only the imported module',
        anchor: 'RADIUS = 2' + NL,
        code: L('', 'TAU = math.pi * 2') },
      { id: 'op2', intent: 'the accessor',
        anchor: 'def box():' + NL + '    return WIDTH * HEIGHT' + NL,
        code: L('', '', 'def tau():', '    return TAU') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L('import geoconst',
      'assert geoconst.WIDTH == 4 and geoconst.HEIGHT == 3 and geoconst.RADIUS == 2',
      'assert abs(geoconst.area() - 12.566) < 0.01, geoconst.area()',
      'assert geoconst.box() == 12, geoconst.box()',
      'print("OK")'),
    delta_probe: L('import geoconst',
      'assert abs(geoconst.TAU - 6.2832) < 0.001, geoconst.TAU',
      'assert abs(geoconst.tau() - 6.2832) < 0.001, geoconst.tau()',
      'assert geoconst.box() == 12, "the existing helpers must be unchanged"',
      'print("OK")'),
  },

  {
    id: 'i02',
    lead: 'geolocalconst.py', language: 'py', run_with: 'python',
    goal: 'Add a tau constant to the EXISTING geolocalconst.py: TAU must hold two times PI when the '
      + 'module is imported, and tau() returns it. Keep WIDTH, HEIGHT, RADIUS, area and box working '
      + 'exactly as they do now. Run it with python.',
    analogy: 'the tau constant is assembled the same way as the existing area computation',
    interface: ['TAU', 'tau'],
    analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the existing area computation as the relation to parallel; '
      + 'that feature reads the shared constants at module level, and the new constant occupies the '
      + 'same position',
    structural_class: 'parallel-state-feature',
    source: i02src,
    operations: [
      { id: 'op1', intent: 'bind the constant, requiring only the module constant',
        anchor: 'RADIUS = 2' + NL,
        code: L('', 'TAU = PI * 2') },
      { id: 'op2', intent: 'the accessor',
        anchor: 'def box():' + NL + '    return WIDTH * HEIGHT' + NL,
        code: L('', '', 'def tau():', '    return TAU') },
    ],
    dependency_edges: [['op1', 'op2']],
    preservation_probe: L('import geolocalconst',
      'assert geolocalconst.WIDTH == 4 and geolocalconst.HEIGHT == 3 and geolocalconst.RADIUS == 2',
      'assert abs(geolocalconst.area() - 12.566) < 0.01, geolocalconst.area()',
      'assert geolocalconst.box() == 12, geolocalconst.box()',
      'print("OK")'),
    delta_probe: L('import geolocalconst',
      'assert abs(geolocalconst.TAU - 6.2832) < 0.001, geolocalconst.TAU',
      'assert abs(geolocalconst.tau() - 6.2832) < 0.001, geolocalconst.tau()',
      'assert geolocalconst.box() == 12, "the existing helpers must be unchanged"',
      'print("OK")'),
  },
];
