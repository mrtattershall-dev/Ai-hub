// Node tests for the skin format helpers. Run: node tools/test-skin.cjs
const { validateSkin, frameToGrid, resolveSkin } = require('../desksprite.js');

// ── validateSkin ──────────────────────────────────────────────────────────────
const ok = {
  name: 't', palette: { '.': null, 'x': '#000' }, size: { w: 2, h: 2 },
  anchor: { x: 1, y: 2 }, frames: { idle: ['x.', '.x'], walk: [['x.', '.x']], held: ['xx', 'xx'] },
};
const bad = { name: 't', palette: { '.': null }, size: { w: 2, h: 2 }, frames: { idle: ['xxx'] } };
let a = validateSkin(ok), b = validateSkin(bad);
if (!a.ok) throw new Error('valid skin rejected: ' + a.errors.join(','));
if (b.ok) throw new Error('bad skin accepted');
console.log('Task 1 OK');

// ── frameToGrid ───────────────────────────────────────────────────────────────
const g = frameToGrid(['x.', '.x'], { '.': null, 'x': '#000' });
if (g[0][0] !== '#000' || g[0][1] !== null || g[1][1] !== '#000') throw new Error('frameToGrid wrong');
console.log('Task 2 OK');

// ── resolveSkin (Task 5) ─────────────────────────────────────────────────────
if (resolveSkin('blue-boy').name !== 'blue-boy') throw new Error('builtin lookup fail');
if (resolveSkin({ bad: 1 }).name !== 'blue-boy') throw new Error('bad skin should fall back');
// Falsy / no-arg paths must return blue-boy (headline backward-compat promise)
if (resolveSkin(undefined).name !== 'blue-boy') throw new Error('resolveSkin(undefined) must return blue-boy');
if (resolveSkin(null).name !== 'blue-boy') throw new Error('resolveSkin(null) must return blue-boy');
if (resolveSkin().name !== 'blue-boy') throw new Error('resolveSkin() must return blue-boy');
console.log('Task 5 OK');

// ── validateSkin anchor (Fix 1) ───────────────────────────────────────────────
// An otherwise-valid skin missing anchor must FAIL validateSkin.
const noAnchor = {
  name: 't', palette: { '.': null, 'x': '#000' }, size: { w: 2, h: 2 },
  frames: { idle: ['x.', '.x'], walk: [['x.', '.x']], held: ['xx', 'xx'] },
};
const anchorChk = validateSkin(noAnchor);
if (anchorChk.ok) throw new Error('skin without anchor should fail validateSkin');
if (!anchorChk.errors.some(e => e.includes('anchor'))) throw new Error('anchor error message not reported, got: ' + anchorChk.errors.join(','));
// The existing Task-1 ok fixture already has anchor — verify it still passes.
if (!validateSkin(ok).ok) throw new Error('Task-1 ok fixture rejected (should still pass with anchor)');
console.log('Fix 1 anchor OK');

// ── cat skin + _template + registry (Task 6) ─────────────────────────────────
const catSkin = require('../skins/cat.json');
if (!validateSkin(catSkin).ok) throw new Error('cat skin invalid');
console.log('Task 6 cat OK');
const tmpl = require('../skins/_template.json');
if (!validateSkin(tmpl).ok) throw new Error('_template skin invalid');
console.log('Task 6 _template OK');
if (resolveSkin('cat').name !== 'cat') throw new Error('cat not in SKINS registry');
console.log('Task 6 registry OK');

// ── Traits v1 ─────────────────────────────────────────────────────────────
const { traitNumber } = require('../desksprite.js');
if (traitNumber({ walkSpeed: 1.5 }, 'walkSpeed', 1) !== 1.5) throw new Error('traitNumber valid');
if (traitNumber(undefined, 'walkSpeed', 1) !== 1) throw new Error('traitNumber missing traits');
if (traitNumber({}, 'walkSpeed', 1) !== 1) throw new Error('traitNumber missing key');
if (traitNumber({ walkSpeed: 0 }, 'walkSpeed', 1) !== 1) throw new Error('traitNumber zero → fallback');
if (traitNumber({ walkSpeed: -2 }, 'walkSpeed', 1) !== 1) throw new Error('traitNumber negative → fallback');
if (traitNumber({ walkSpeed: 'fast' }, 'walkSpeed', 1) !== 1) throw new Error('traitNumber NaN → fallback');
if (traitNumber({ walkFrameTicks: 4 }, 'walkFrameTicks', 9) !== 4) throw new Error('traitNumber walkFrameTicks');
// validateSkin: traits must be an object when present
const okT = JSON.parse(JSON.stringify(require('../skins/blue-boy.json'))); okT.traits = { walkSpeed: 2 };
if (!validateSkin(okT).ok) throw new Error('valid traits rejected');
const badT = JSON.parse(JSON.stringify(require('../skins/blue-boy.json'))); badT.traits = 'zoom';
if (validateSkin(badT).ok) throw new Error('non-object traits accepted');
// cat ships traits and the inline CAT must stay byte-equal to the file
const catFile = require('../skins/cat.json');
if (!catFile.traits || typeof catFile.traits.walkSpeed !== 'number') throw new Error('cat should ship traits');
if (JSON.stringify(resolveSkin('cat')) !== JSON.stringify(catFile)) throw new Error('inline CAT drifted from skins/cat.json');
console.log('Traits OK');
