/**
 * promoteCanonical.mjs - fill canonical slots with the user's REAL art.
 *
 *   node server/promoteCanonical.mjs --dry     # show the mapping and what it would write
 *   node server/promoteCanonical.mjs           # apply
 *   node server/promoteCanonical.mjs --revert  # put generated placeholders back
 *
 * WHY
 * ---
 * The canonical vocabulary (canonicalAssets.mjs) guarantees that `assets/player.png` always
 * resolves, using a generated placeholder when nothing real exists. That is what lets a
 * model be trained on stable names. But a placeholder is a stand-in, and the library now
 * holds 13,000 real fantasy/RPG assets - so the slots that CAN be backed by real art
 * should be, under the same names, with no change to any game or training row.
 *
 * WHAT IS AND IS NOT MAPPED
 * -------------------------
 * Only high-confidence, single-subject sources are mapped. Arcade slots (ball, paddle,
 * brick, ship, alien, asteroid) stay as placeholders on purpose: this library is fantasy
 * top-down RPG art and there is nothing honest to put in them. They still resolve, so a
 * breakout game still verifies - it just draws stand-ins.
 *
 * FRAME LAYOUTS ARE MEASURED, NOT ASSUMED
 * ---------------------------------------
 * Frame size is not a per-pack constant - it scales with the creature, inside one pack
 * family: orc, skeleton, gnoll, ghost and slime are 64px; rat, golem and ent are 128px.
 * Two guesses were wrong before that was clear. 128px for the orc produced a 2x2 block of
 * four orcs; 64px for the golem produced a sliced-off corner of one. So `grid: 'auto'` runs
 * pngTool.detectFrame(), which finds the smallest frame size where the sprite is not
 * clipped against the frame edge, and the result was checked by eye against both.
 *
 * Franuka's character pack is 32x48 (non-square, sprites touch the frame edge) so
 * detection cannot see it and the size is given explicitly. Its icons are already single
 * images at 16/48.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import * as assets from './assets.js';
import { decode, encode, crop, coverage, detectFrame } from './pngTool.mjs';
import { ensureCanonical } from './canonicalAssets.mjs';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const REVERT = args.includes('--revert');

// slot <- source file, with how to cut one frame out of it.
// `grid: 64` means "square frames of 64px"; `grid: [32,48]` means explicit frame size.
const MAP = [
  // ---- characters (Franuka character pack: 32x48 frames, row 0 = facing camera) -------
  ['player.png', 'fantasy_rpg_2x_farmer_idle.png', [32, 48], 0, 'the player character'],
  ['player_sheet.png', 'fantasy_rpg_2x_farmer_walk.png', null, null, '4x4 walk spritesheet, 32x48 frames: rows are down/left/right/up'],
  ['npc.png', 'fantasy_rpg_2x_merchant_idle.png', [32, 48], 0, 'a friendly non-player character (merchant)'],
  ['merchant.png', 'fantasy_rpg_2x_merchant_idle.png', [32, 48], 0, 'a merchant NPC'],
  ['blacksmith.png', 'fantasy_rpg_2x_blacksmith_idle.png', [32, 48], 0, 'a blacksmith NPC'],
  ['alchemist.png', 'fantasy_rpg_2x_alchemist_idle.png', [32, 48], 0, 'an alchemist NPC'],
  ['fisherman.png', 'fantasy_rpg_2x_fisherman_idle.png', [32, 48], 0, 'a fisherman NPC'],
  ['barmaid.png', 'fantasy_rpg_2x_barmaid_idle.png', [32, 48], 0, 'a barmaid NPC'],

  // ---- enemies (CraftPix: 64x64 frames) ----------------------------------------------
  ['enemy.png', 'orc_orc1_idle_with_shadow.png', 'auto', 0, 'a basic enemy (orc)'],
  ['orc.png', 'orc_orc1_idle_with_shadow.png', 'auto', 0, 'an orc enemy'],
  ['orc_sheet.png', 'orc_orc1_walk_with_shadow.png', null, null, 'orc walk spritesheet, 64x64 frames'],
  ['skeleton.png', 'skeletons_skeleton1_idle_with_shadow.png', 'auto', 0, 'a skeleton enemy'],
  ['gnoll.png', 'gnolls_gnoll1_idle_with_shadow.png', 'auto', 0, 'a gnoll enemy'],
  ['ghost.png', 'ghost_ghost1_idle_with_shadow.png', 'auto', 0, 'a ghost enemy'],
  ['slime.png', 'slime_slime1_idle_with_shadow.png', 'auto', 0, 'a slime enemy'],
  ['rat.png', 'giantrat_rat1_idle_with_shadow.png', 'auto', 0, 'a giant rat enemy'],
  ['boss.png', 'golem_golem1_idle_with_shadow.png', 'auto', 0, 'a large boss enemy (golem)'],
  ['golem.png', 'golem_golem1_idle_with_shadow.png', 'auto', 0, 'a golem enemy'],
  ['ent.png', 'ent_ent1_idle_with_shadow.png', 'auto', 0, 'an ent / treant enemy'],

  // ---- items (Franuka base set, already single 48x48 images) --------------------------
  ['coin.png', { label: 'gold coins (medium)', size: 48 }, null, null, 'a collectible coin'],
  ['gem.png', { label: 'ruby', size: 48 }, null, null, 'a collectible gem'],
  ['heart.png', { label: 'heart (big)', size: 48 }, null, null, 'a heart / life'],
  ['key.png', { label: 'golden key', size: 48 }, null, null, 'a key'],
  ['potion.png', { label: 'healing potion', size: 48 }, null, null, 'a healing potion'],
  ['mana_potion.png', { label: 'mana potion', size: 48 }, null, null, 'a mana potion'],
  ['sword.png', { label: 'steel sword', size: 48 }, null, null, 'a sword'],
  ['shield.png', { label: 'steel shield', size: 48 }, null, null, 'a shield'],
  ['bow.png', { label: 'longbow', size: 48 }, null, null, 'a bow'],
  ['axe.png', { label: 'steel axe', size: 48 }, null, null, 'an axe'],
  ['staff.png', { label: 'wooden staff', size: 48 }, null, null, 'a magic staff'],
  ['armor.png', { label: 'steel armor', size: 48 }, null, null, 'body armour'],
  ['helmet.png', { label: 'steel helmet', size: 48 }, null, null, 'a helmet'],
  ['ring.png', { label: 'fire ring', size: 48 }, null, null, 'a magic ring'],
  ['book.png', { label: 'journal', size: 48 }, null, null, 'a book / journal'],
  ['map.png', { label: 'map', size: 48 }, null, null, 'a map'],
  ['chest.png', { label: 'chest (big)', size: 48 }, null, null, 'a treasure chest'],
  ['skull.png', { label: 'skull (big)', size: 48 }, null, null, 'a skull'],
  ['meat.png', { label: 'meat', size: 48 }, null, null, 'food / meat'],
  ['log.png', { label: 'wood log', size: 48 }, null, null, 'a wood log resource'],
  ['stone_item.png', { label: 'stone', size: 48 }, null, null, 'a stone resource'],

  // ---- world -------------------------------------------------------------------------
  ['tree.png', 'trees_assets_separately_trees_autumn_tree1.png', null, null, 'a tree'],
  ['tileset.png', 'medievalinterior_tileset_all_tileset_32x32.png', null, null,
    'a medieval interior tileset, 32x32 tiles, 35 columns x 21 rows'],
];

if (REVERT) {
  const r = ensureCanonical({ force: true, revertReal: true });
  console.log(`reverted to generated placeholders: ${JSON.stringify(r)}`);
  process.exit(0);
}

function findSource(spec) {
  if (typeof spec === 'string') {
    const it = assets.resolve('assets/' + spec);
    return it ? { item: it, why: spec } : null;
  }
  // { label, size } - the labelled icon at a given resolution
  const hit = assets.list().find((i) => i.label === spec.label && i.width === spec.size);
  if (!hit) return null;
  const full = assets.resolve('assets/' + hit.name);
  return full ? { item: full, why: `${spec.label} @${spec.size}` } : null;
}

let done = 0, skipped = 0, failed = 0;
const rows = [];
for (const [slot, spec, grid, frame, role] of MAP) {
  const src = findSource(spec);
  if (!src) { skipped++; rows.push([slot, 'SOURCE NOT FOUND', typeof spec === 'string' ? spec : spec.label]); continue; }
  try {
    let out;
    let note;
    if (grid == null) {
      out = readFileSync(src.item.full);                      // whole file, as-is
      const img = decode(out);
      note = `${img.w}x${img.h} whole`;
    } else {
      const img = decode(readFileSync(src.item.full));
      // 'auto' measures the sheet instead of trusting a guess. Frame size varies with the
      // creature: orc/skeleton/gnoll/ghost/slime are 64px, rat/golem/ent are 128px, all in
      // the same pack family.
      let fw, fh;
      if (grid === 'auto') {
        const d = detectFrame(img);
        if (!d) throw new Error('could not detect a frame size');
        fw = d.frame; fh = d.frame;
      } else { [fw, fh] = Array.isArray(grid) ? grid : [grid, grid]; }
      const cols = Math.max(1, Math.floor(img.w / fw));
      let best = { cov: -1, n: 0 };
      // Frame 0 is the resting pose and is what we want; only skip it if it is genuinely
      // blank. The threshold has to be low: a 32x26 rat inside a 128x128 frame is 3% ink
      // and perfectly valid, so anything higher walks past good frames looking for a
      // fuller one that does not exist.
      for (let n = frame; n < Math.min(cols, frame + 4); n++) {
        const c = crop(img, (n % cols) * fw, Math.floor(n / cols) * fh, fw, fh);
        const cov = coverage(c);
        if (cov > best.cov) best = { cov, n, img: c };
        if (cov > 0.005) break;
      }
      out = encode(best.img);
      note = `${img.w}x${img.h} -> frame ${best.n} ${fw}x${fh} (${(best.cov * 100).toFixed(0)}% ink)`;
    }
    rows.push([slot, note, src.why]);
    if (!DRY) {
      const r = assets.add({ name: slot, dataB64: out.toString('base64'), replace: true, role, defer: true });
      if (!r.ok) { failed++; rows[rows.length - 1][1] = 'FAILED: ' + r.error; continue; }
      assets.label(slot, role);
    }
    done++;
  } catch (e) {
    failed++;
    rows.push([slot, 'ERROR: ' + e.message, src.why]);
  }
}
if (!DRY) assets.flush();

console.log(`\n${DRY ? '[dry] ' : ''}canonical slots backed by real art\n`);
for (const [slot, note, why] of rows) console.log(`  ${slot.padEnd(20)} ${String(note).padEnd(42)} <- ${why}`);
console.log(`\n  ${done} mapped, ${skipped} source missing, ${failed} failed`);

const still = assets.list().filter((i) => i.placeholder).map((i) => i.name);
console.log(`  ${still.length} slot(s) still placeholder (no fantasy equivalent): ${still.slice(0, 14).join(' ')}${still.length > 14 ? ' …' : ''}`);
if (!DRY) console.log(`  library: ${JSON.stringify(assets.totals())}\n`);
