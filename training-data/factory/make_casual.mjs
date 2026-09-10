/**
 * make_casual.mjs — the "casual request -> real code" set (interpretation reinforcement).
 *
 *   node factory/make_casual.mjs 4000
 *
 * Pairs LIGHT/CASUAL user instructions with our VALIDATED, git-derived code (human + Phaser
 * git examples, then exec+audit-clean modules). Keeps each row's original system prompt and
 * code; only rewrites the instruction into how a user actually types ("a binary search tree",
 * "make a bouncing thing in phaser"). Complements gen_interpret.mjs (which adds the explicit
 * "Interpreting: ..." comment) by teaching casual->code at scale on real code. Dedup by code.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

const TARGET = parseInt(process.argv[2] || '4000', 10);
// git-sourced human code first, then validated modules to fill volume
const SOURCES = ['factory/dataset_human.jsonl', 'factory/dataset_phaser.jsonl',
                 'factory/dataset_systems.jsonl', 'factory/dataset_vb.execpass.auditpass.jsonl'];

const LEAD = ['a ', 'make a ', 'just a ', 'a quick ', 'a simple ', 'i need a ', 'gimme a ',
              'can you do a ', 'a basic ', 'something like a ', 'lil ', 'quick '];
const rnd = (() => { let s = 99; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
const pick = (a) => a[Math.floor(rnd() * a.length)];

function casualize(userMsg) {
  let t = userMsg.trim();
  const phaser = /phaser/i.test(t);
  // Phaser examples: "Write a Phaser 3 example demonstrating CATEGORY: NAME."
  let m = t.match(/demonstrating\s+(.+?)\.?$/i);
  if (m) { const what = m[1].replace(/[:/]+/g, ' ').replace(/\s+/g, ' ').trim(); return (pick(LEAD) + 'phaser ' + what).toLowerCase().trim(); }
  // generic: strip the boilerplate, keep the essence
  t = t.replace(/^write a complete,?\s*(self-contained,?\s*)?(runnable,?\s*)?(vanilla\s*)?javascript\s+\w+(\s+game-systems)?\s+(module|class|function)?\s*/i, '')
       .replace(/that does the following:\s*/i, '')
       .replace(/[`*]/g, '')
       .replace(/\s*\(([^)]+)\)\s*$/, ' $1')
       .replace(/[—\-–]\s*separate classes.*$/i, '')
       .replace(/,?\s*ending in a (small )?self-checking demo.*$/i, '')
       .replace(/\.$/, '').replace(/\s+/g, ' ').trim();
  if (t.length > 90) t = t.slice(0, 90).replace(/\s\S*$/, '');   // keep it terse
  if (!t) t = 'a small module';
  return (pick(LEAD) + (phaser ? 'phaser ' : '') + t).toLowerCase().replace(/^(a |make a |just a )+/, m2 => m2.split(' ')[0] + ' ').trim();
}

const seen = new Set();
const rows = [];
for (const src of SOURCES) {
  if (rows.length >= TARGET) break;
  if (!existsSync(src)) continue;
  for (const line of readFileSync(src, 'utf8').trim().split('\n')) {
    if (rows.length >= TARGET) break;
    if (!line) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    const code = r.messages[2].content;
    const h = createHash('sha1').update(code).digest('hex');
    if (seen.has(h)) continue;
    seen.add(h);
    rows.push({ messages: [
      r.messages[0],                                   // keep original system (Phaser stays Phaser)
      { role: 'user', content: casualize(r.messages[1].content) },
      r.messages[2],                                   // keep the real, validated code
    ] });
  }
}

writeFileSync('factory/dataset_casual.jsonl', rows.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
console.log(`casual set: ${rows.length} rows -> factory/dataset_casual.jsonl`);
const samples = [rows[0], rows[450], rows[2600]].filter(Boolean);
for (const s of samples) console.log(`  e.g. "${s.messages[1].content}"`);
