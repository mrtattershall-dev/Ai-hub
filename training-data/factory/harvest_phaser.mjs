/**
 * harvest_phaser.mjs — turn Phaser's official examples into training rows (trusted, known-good).
 *
 *   node factory/harvest_phaser.mjs            (reads factory/_phaser_ex/public/src)
 *
 * Phaser's example repo is real, working Phaser 3 code organized by API. We DON'T run the
 * free-var gate here — `Phaser` is a script-tag global by design, and the gate (built for
 * vanilla) would wrongly reject every example as a fragment. Instead: parse-check (syntax),
 * size-bound, dedup, and tag with a Phaser-specific system prompt so the model learns the
 * engine as its own "mode". Validation (the headless engine validator) is for GENERATED
 * Phaser, where hallucination is the risk — these official examples are trusted as-is.
 *
 * -> factory/dataset_phaser.jsonl
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename, relative } from 'path';
import { createHash } from 'crypto';
import * as acorn from 'acorn';
import { dependsOnExternalResources } from './gate.mjs';

const SRC = 'factory/_phaser_ex/public/src';
if (!existsSync(SRC)) { console.error('clone phaserjs/examples to factory/_phaser_ex first'); process.exit(1); }

const SYSTEM = ('You are an expert Phaser 3 game developer. You write complete, runnable Phaser 3 '
  + 'programs using only real Phaser 3 APIs (Phaser.Game, scenes, this.add, this.physics, '
  + 'this.tweens, this.input, this.load, etc.). Return code that runs as given against Phaser 3.');
const MIN = 120, MAX = 14000;
const SKIP = new Set(['bugs', 'wip', '_wip']);

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (e.endsWith('.js')) out.push(p);
  }
  return out;
}
function instructionFor(relPath) {
  const parts = relPath.replace(/\.js$/, '').split(/[\\/]/);
  const name = parts.pop().replace(/[-_]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().trim();
  const category = parts.join(' / ');
  return `Write a Phaser 3 example demonstrating ${category ? category + ': ' : ''}${name}.`;
}

const files = walk(SRC);
const seen = new Set();
const byCat = {};
let nonportable = 0;
let parseFail = 0, sized = 0, dup = 0, kept = 0;
const rows = [];
for (const f of files) {
  const code = readFileSync(f, 'utf8');
  if (code.length < MIN || code.length > MAX) { sized++; continue; }

  // PORTABILITY GATE (added after measurement, 2026-09-08).
  // This harvester used to trust the official examples as-is. They ARE correct -
  // on a site that serves assets/sprites/*.png. Lifted anywhere else they boot,
  // create a canvas, and render nothing. 71% of the harvested slice carried that
  // dependency and the fine-tuned model reproduced it faithfully: 0/12 on a
  // Chromium-verified eval, 11 failures from a missing asset. Portability was
  // true by convention, never enforced. This enforces it.
  const port = dependsOnExternalResources(code);
  if (!port.portable) { nonportable++; continue; }
  try { acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' }); }
  catch { try { acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script' }); } catch { parseFail++; continue; } }
  const h = createHash('sha1').update(code.replace(/\s+/g, ' ').trim()).digest('hex');
  if (seen.has(h)) { dup++; continue; }
  seen.add(h);
  const rel = relative(SRC, f);
  const cat = rel.split(/[\\/]/)[0];
  byCat[cat] = (byCat[cat] || 0) + 1;
  rows.push({ messages: [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: instructionFor(rel) },
    { role: 'assistant', content: '```javascript\n' + code.trim() + '\n```' },
  ] });
  kept++;
}

writeFileSync('factory/dataset_phaser.jsonl', rows.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
console.log(`\n=== Phaser harvest: ${files.length} example files ===`);
console.log(`  KEPT:          ${kept}`);
console.log(`  too big/small: ${sized}`);
console.log(`  parse-fail:    ${parseFail}`);
console.log(`  duplicate:     ${dup}`);
const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 14);
console.log(`\n  by category (top):`);
for (const [c, n] of top) console.log(`    ${String(n).padStart(4)}  ${c}`);
console.log(`\n  -> factory/dataset_phaser.jsonl  (${rows.length} rows)`);
