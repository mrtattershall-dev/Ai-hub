/**
 * verify_remote_assets.mjs - prove the Modal verifier serves the asset library the way the
 * hub does.
 *
 *   node factory/verify_remote_assets.mjs [verifier-url]
 *
 * Sends two Phaser games: one loading a sprite that IS in the library, one loading a name
 * that is not. The first must pass and list the asset as used; the second must FAIL and
 * name the missing file. Also compares the verifier's assetVersion with the hub's local
 * one. If any of that is off, the eval is not measuring the model.
 */
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const URL_ = (process.argv[2] || process.env.CHROMIUM_VERIFY || 'https://mr-tattershall--chromium-verify-verifier-web.modal.run').replace(/\/$/, '');

const assets = await import(pathToFileURL(join(__dirname, '..', '..', 'server', 'assets.js')).href);
const real = assets.search('orc idle image').items[0];
if (!real) { console.error('no orc idle sprite in the local library - import the packs first'); process.exit(1); }

const game = (sprite) => `
const config = { type: Phaser.AUTO, width: 800, height: 600, scene: { preload, create } };
function preload () { this.load.image('s', '${sprite}'); this.load.audio('step', 'assets/dirt_walk_1.wav'); }
function create () { this.add.image(400, 300, 's').setScale(3); }
new Phaser.Game(config);`;

async function verify(code) {
  const r = await fetch(`${URL_}/api/game/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ engine: 'phaser', code }), signal: AbortSignal.timeout(180_000),
  });
  return r.json();
}

let fails = 0;
const check = (label, ok, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`); if (!ok) fails++; };

console.log(`\nverifier: ${URL_}`);
const health = await fetch(`${URL_}/api/health`, { signal: AbortSignal.timeout(180_000) }).then((r) => r.json());
const local = assets.version();
check('verifier and hub report the same asset version', health.assetVersion === local, `${health.assetVersion} vs ${local}`);
check('verifier sees the whole library', health.assetCount === assets.totals().files, `${health.assetCount} vs ${assets.totals().files}`);

console.log(`\nreal sprite: ${real.path}`);
const good = await verify(game(real.path));
check('a game loading a REAL asset passes', good.ok === true, good.verdict);
check('the real asset is reported as used', (good.assetsUsed || []).includes(real.path));
check('the footstep audio is reported as used', (good.assetsUsed || []).includes('assets/dirt_walk_1.wav'));

const bad = await verify(game('assets/orc_orc1_idle_full.png'));
check('a game loading an INVENTED asset fails', bad.ok === false, bad.verdict);
check('the missing file is named', (bad.assetsMissing || []).includes('assets/orc_orc1_idle_full.png'));
check('the verdict points at list_assets', /list_assets/.test(bad.verdict || ''));

// The canonical vocabulary: a game written only with guaranteed names must pass on Modal
// too, or "trained on canonical names" does not survive contact with the eval.
const canon = `
const config = { type: Phaser.AUTO, width: 800, height: 600, scene: { preload, create } };
function preload () {
  this.load.image('bg', 'assets/background.png');
  this.load.spritesheet('player', 'assets/player_sheet.png', { frameWidth: 32, frameHeight: 32 });
  this.load.image('coin', 'assets/coin.png'); this.load.image('platform', 'assets/platform.png');
  this.load.audio('jump', 'assets/jump.wav'); this.load.audio('pickup', 'assets/pickup.wav');
}
function create () {
  this.add.image(400, 300, 'bg'); this.add.image(400, 500, 'platform');
  this.anims.create({ key: 'walk', frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
  this.add.sprite(400, 460, 'player').play('walk');
  for (let i = 0; i < 5; i++) this.add.image(200 + i * 100, 380, 'coin');
}
new Phaser.Game(config);`;
const cg = await verify(canon);
console.log('\ncanonical-only game');
check('a game using ONLY canonical names passes on Modal', cg.ok === true, cg.verdict);
check('all six canonical assets were served', (cg.assetsUsed || []).length === 6, `${(cg.assetsUsed || []).length} used, missing: ${JSON.stringify(cg.assetsMissing)}`);

console.log(fails ? `\n${fails} check(s) failed\n` : '\nModal verifier has full asset parity with the hub.\n');
process.exit(fails ? 1 : 0);
