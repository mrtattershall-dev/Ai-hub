// LegaScreen v1 probes — each shown to FIRE and to be SILENT, in-memory, so the sensitivity claim is
// re-derivable without a historical checkout. Predictions in benchmarks/LEGASCREEN_V1_PREREG.md; the
// runs against the real trees are preserved in benchmarks/RESULT.legascreen-v1.md.
//
// A DETECTOR THAT HAS NEVER BEEN SHOWN TO FIRE HAS NEVER BEEN SHOWN TO WORK - and this project has
// paid for that lesson enough times that the screen itself must be screened.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { probeAlias, probeComposition, probeErasureOver } from './probes.mjs';

const NL = String.fromCharCode(10);

function tree(files) {
  const d = mkdtempSync(join(tmpdir(), 'ls1-'));
  mkdirSync(join(d, 'legasus', 'legaknow'), { recursive: true });
  for (const [name, src] of Object.entries(files)) writeFileSync(join(d, 'legasus/legaknow', name), src);
  return d;
}

test('P-ALIAS fires on a word owned twice, and is silent when it is owned once', () => {
  const two = tree({
    'a.mjs': ["export const STATE = { CONTESTED: 'CONTESTED', OK: 'OK' };"].join(NL),
    'b.mjs': ["export const CONTESTED = 'CONTESTED';"].join(NL),
  });
  const hit = probeAlias({ target: two }).positives;
  assert.deepEqual(hit.map((p) => p.subject), ['CONTESTED']);
  assert.deepEqual(hit[0].owners, ['a.mjs', 'b.mjs']);
  assert.match(hit[0].why, /SUSPICION ONLY/);
  rmSync(two, { recursive: true, force: true });

  const one = tree({ 'a.mjs': "export const STATE = { CONTESTED: 'CONTESTED' };" });
  assert.deepEqual(probeAlias({ target: one }).positives, []);
  rmSync(one, { recursive: true, force: true });
});

test('P-ALIAS reports a missing directory as UNSCREENED, never as clean', () => {
  const r = probeAlias({ target: tmpdir(), dir: 'no/such/dir' });
  assert.deepEqual(r.positives, []);
  assert.equal(r.unscreened.length, 1);
  assert.match(r.unscreened[0].why, /not present/);
});

// A two-line stand-in for a justification module: the LAUNDERING one treats a null-scoped premise as
// covering anything (the b11e51f behaviour), the SOUND one refuses it (HEAD). Neither is imported from
// the repository, so this test cannot pass by accident of the real module's state.
const MODULE = (launders) => [
  "export const ANY = Symbol('ANY');",
  'export const NODE = { OBSERVATION: 1, INTERPRETATION: 2, CLAIM: 3 };',
  'export const graph = () => ({ nodes: {} });',
  'export const scope = (p = {}) => ({ repository: p.repository === undefined ? null : p.repository });',
  'let n = 0;',
  'export const node = ({ proposition, scope: sc, supports = [] }) =>',
  "  ({ id: 'n' + (++n), proposition, scope: sc, supports });",
  'export const add = (g, x) => { g.nodes[x.id] = x; return x.id; };',
  'const covers = (p, c) => {',
  '  if (c === null) return true;',
  '  if (p === ANY) return true;',
  launders ? '  if (p === null) return true;' : '  if (p === null) return false;',
  '  if (c === ANY) return false;',
  '  return p === c;',
  '};',
  'export function entitled(g, id) {',
  '  const seen = new Set(); let cur = g.nodes[id];',
  '  while (cur && cur.supports.length) {',
  '    const parent = g.nodes[cur.supports[0]];',
  '    if (!parent || seen.has(parent.id)) break;',
  '    seen.add(parent.id);',
  '    if (!covers(parent.scope.repository, cur.scope.repository)) return { ok: false };',
  '    cur = parent;',
  '  }',
  '  return { ok: true };',
  '}',
].join(NL);

test('P-COMPOSITION fires on a laundering relay and is SILENT on a sound one, over the same 64 chains', async () => {
  const bad = tree({ 'justification.mjs': MODULE(true) });
  const r1 = await probeComposition({ target: bad });
  assert.equal(r1.examined, 64, 'the space is enumerated, not sampled');
  assert.ok(r1.positives.length > 0, 'the laundering relay must be surfaced');
  assert.ok(r1.positives.some((p) => /M=null/.test(p.subject)));
  assert.match(r1.positives[0].why, /authority appearing between the edges/);
  rmSync(bad, { recursive: true, force: true });

  const good = tree({ 'justification.mjs': MODULE(false) });
  const r2 = await probeComposition({ target: good });
  assert.equal(r2.examined, 64);
  assert.deepEqual(r2.positives, [], 'a sound relay must produce nothing over the same space');
  rmSync(good, { recursive: true, force: true });
});

test('P-COMPOSITION reports an unusable target as UNSCREENED', async () => {
  const r = await probeComposition({ target: join(tmpdir(), 'nothing-here-' + Date.now()) });
  assert.deepEqual(r.positives, []);
  assert.equal(r.unscreened.length, 1);
  assert.equal(r.examined, 0, 'and examined is ZERO, so silence cannot be read as a clean result');
});

test('P-ERASURE fires, stays silent on the repaired shape, and names what it never called', () => {
  const seeds = { v: () => ({ state: 'Q', establishes: 'a', doesNotEstablish: 'b' }) };
  const drops = probeErasureOver({ moduleName: 'm', seeds,
    exports: { f: () => ({ objectives: [] }), needsArgs: (a, b) => { throw new Error('no'); } } });
  assert.ok(drops.positives.some((p) => p.lost.includes('doesNotEstablish')));
  assert.deepEqual(drops.unscreened.map((u) => u.fn), ['m.needsArgs']);

  const keeps = probeErasureOver({ moduleName: 'm', seeds,
    exports: { f: (c) => ({ objectives: [], establishes: c.establishes, doesNotEstablish: c.doesNotEstablish, state: c.state }) } });
  assert.deepEqual(keeps.positives, []);
});
