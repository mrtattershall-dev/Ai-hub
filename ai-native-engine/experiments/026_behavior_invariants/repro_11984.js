'use strict';
// repro: fuzz seed 11984 registration-order divergence — hypothesis: two
// generated rules COLLIDED on name -> same actor string -> RD-003 tie-break
// falls through to tx index (registration position) -> order-dependence.
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine, TYPE } = CORE('engine.js');

const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

for (const seed of [11984, 16743]) {
  const rnd = mulberry32(1000 + seed);
  // replicate generation order exactly: world first, then rules
  const g = new Engine(1024);
  g.spawn(TYPE.ZONE, { name: 'z0' }); g.spawn(TYPE.ZONE, { name: 'z1' });
  const n = 5 + Math.floor(rnd() * 10);
  for (let i = 0; i < n; i++) {
    const t = rnd() < 0.6 ? TYPE.CROP : TYPE.ENEMY;
    if (t === TYPE.CROP) { rnd(); rnd(); rnd(); } else { rnd(); }
  }
  // rule generation: replicate name draws
  const names = [];
  const k = 2 + Math.floor(rnd() * 3);
  // NOTE: template picks + inner rnd() draws differ per template, so replicate
  // by re-running the real generator logic minimally: record template index +
  // the name-suffix draw in order.
  const draw = () => Math.floor(rnd() * 1e4);
  // We can't perfectly replay without the full template code; instead print the
  // sequence of (template, name) the real generator would produce:
  const templates = ['grow', 'wilt', 'reap', 'regen', 'flee', 'plant', 'score'];
  // faithful arg order per template (name draw happens FIRST in each template):
  const extraDraws = { grow: 2, wilt: 1, reap: 1, regen: 2, flee: 1, plant: 3, score: 1 };
  for (let i = 0; i < k; i++) {
    const ti = Math.floor(rnd() * templates.length);
    const t = templates[ti];
    const nm = t + draw();
    for (let d = 0; d < extraDraws[t]; d++) rnd();
    names.push(nm);
  }
  const dupes = names.filter((x, i) => names.indexOf(x) !== i);
  console.log(`seed ${seed}: k=${k} names=[${names.join(', ')}] ${dupes.length ? 'DUPLICATE: ' + dupes.join(',') : 'no duplicate'}`);
}
