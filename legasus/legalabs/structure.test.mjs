// WITNESSES for the structural-preservation channel, exactly as preregistered in NARROWABILITY_V2.md.
//
// The two ADMIT cases and the non-vacuity check are what stop this becoming a checker that rejects
// everything — which would pass both REJECT cases and be worthless, the failure mode this project has
// hit repeatedly.
import { structurePreserved } from './structure.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

// A class whose method has several statements after the point an insertion could split it.
const CLS = L(
  'class Router:',
  '    def resolve(self, path):',
  '        if path in self._aliases:',
  '            return self._routes.get(path)',
  '        if path in self._routes:',
  '            return self._routes[path]',
  '        return None',
  '',
  '    def size(self):',
  '        return len(self._routes)',
);

// A module-level function with an early return.
const FN = L(
  'def classify(n):',
  '    if n < 0:',
  '        return "negative"',
  '    return "positive"',
);

const cases = [
  {
    name: 'REJECT  insertion ends a method early and re-parents the remaining statements',
    before: CLS,
    after: L(
      'class Router:',
      '    def resolve(self, path):',
      '        if path in self._aliases:',
      '            return self._routes.get(path)',
      '',
      '    def alias(self, frm, to):',
      '        self._aliases[frm] = to',
      '        if path in self._routes:',
      '            return self._routes[path]',
      '        return None',
      '',
      '    def size(self):',
      '        return len(self._routes)',
    ),
    insertion: { pos: 3, count: 3 },
    preserved: false,
  },
  {
    name: 'REJECT  insertion moves existing code behind a terminator',
    before: FN,
    after: L(
      'def classify(n):',
      '    if n < 0:',
      '        return "negative"',
      '    return "small"',
      '    return "positive"',
    ),
    insertion: { pos: 2, count: 1 },
    preserved: false,
  },
  {
    name: 'ADMIT   sibling insertion shifts line numbers but preserves parents and reachability',
    before: CLS,
    after: L(
      'class Router:',
      '    def alias(self, frm, to):',
      '        self._aliases[frm] = to',
      '',
      '    def resolve(self, path):',
      '        if path in self._aliases:',
      '            return self._routes.get(path)',
      '        if path in self._routes:',
      '            return self._routes[path]',
      '        return None',
      '',
      '    def size(self):',
      '        return len(self._routes)',
    ),
    insertion: { pos: 0, count: 3 },
    preserved: true,
  },
  {
    name: 'ADMIT   new NESTED code added, pre-existing statements structurally identical',
    before: FN,
    after: L(
      'def classify(n):',
      '    if n < 10:',
      '        pass',
      '    if n < 0:',
      '        return "negative"',
      '    return "positive"',
    ),
    insertion: { pos: 0, count: 2 },
    preserved: true,
  },
  {
    name: 'NON-VACUITY  an unmodified program preserves itself',
    before: CLS, after: CLS, preserved: true,
  },
];

let fail = 0;
for (const c of cases) {
  const r = structurePreserved(c.before, c.after, c.insertion);
  const ok = r.preserved === c.preserved;
  if (!ok) fail++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + c.name);
  if (r.violations.length) {
    for (const v of r.violations.slice(0, 3)) {
      console.log('        ' + v.kind + ': ' + JSON.stringify(v.statement).slice(0, 52)
        + (v.was ? '   was under ' + JSON.stringify(v.was) + ' now ' + JSON.stringify(v.now) : ''));
    }
  }
}

const admits = cases.filter((c) => c.preserved).length;
console.log('');
console.log('  ' + (fail ? fail + ' WITNESS FAILURE(S)' : 'all ' + cases.length + ' witnesses pass'));
console.log('  Non-vacuity: ' + admits + ' cases must be ADMITTED. A checker that rejected everything');
console.log('  would pass both REJECT cases and be worthless - the failure this project keeps meeting.');
if (fail) process.exitCode = 1;
