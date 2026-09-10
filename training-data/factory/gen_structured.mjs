/**
 * gen_structured.mjs - teach the model to answer in MARKDOWN when markdown is asked for.
 *
 *   node factory/gen_structured.mjs 1500 factory/dataset_structured.jsonl
 *
 * WHY THIS EXISTS
 * ---------------
 * Measured 2026-09-08 on run4: the Strategy tab scored 0/4. Asked for
 *   ## Overview / ## Key Components / ## Dependencies / ## Open Questions
 * the model returned a JavaScript class with those names as code comments.
 *
 * The cause is in the training mix, not the prompt. Every row in run4 - correctness,
 * phaser, and the 8,099 interpret rows (49% of the set) - ends in a fenced code block.
 * The interpret slice in particular teaches "lead with a comment, then emit code", and
 * run4 generalised that shape onto requests that explicitly ask for prose. run3, with
 * no interpret data, handled Strategy correctly.
 *
 * So the fix is a counterweight: rows whose correct answer is markdown with exact
 * headers and NO code block. Generated parametrically and verified structurally - a row
 * only counts if every required header is present, in order, with prose under each and
 * no fenced block anywhere.
 *
 * Free to run: no model, no GPU.
 */
import { writeFileSync } from 'fs';
import { createHash } from 'crypto';

const TARGET = parseInt(process.argv[2] || '1500', 10);
const OUT = process.argv[3] || 'dataset_structured.jsonl';

const SYSTEM = 'You produce structured planning documents. When the user asks for specific markdown '
  + 'section headers, you return exactly those headers, in that order, each followed by concise '
  + 'prose or bullets. You never return code blocks for a documentation request.';

let seed = 90820261;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const some = (a, n) => { const c = [...a], o = []; while (o.length < n && c.length) o.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return o; };

// The four canvases the Strategy tab actually parses (client/src/lib/constants.js).
const CANVASES = [
  { id: 'map',          sections: ['Overview', 'Key Components', 'Dependencies', 'Open Questions'] },
  { id: 'plan',         sections: ['Goal', 'Milestones', 'Tasks', 'Risks & Mitigations'] },
  { id: 'architecture', sections: ['Overview', 'Components', 'Data Flow', 'Tradeoffs'] },
  { id: 'review',       sections: ['Summary', 'Strengths', 'Weaknesses', 'Recommendations'] },
];

const SUBJECTS = [
  'a farming loop', 'an inventory system', 'a save system', 'a dialogue system',
  'a crafting tree', 'a day/night cycle', 'a quest log', 'a shop and economy',
  'an enemy AI layer', 'a level editor', 'a particle system', 'a multiplayer lobby',
  'a tutorial flow', 'an achievement system', 'a pathfinding layer', 'a weather system',
  'a skill tree', 'a loot table', 'a camera controller', 'a settings menu',
];
const NOUNS = {
  'a farming loop': ['crop growth stages', 'watering and soil state', 'harvest yield', 'seasonal timing'],
  'an inventory system': ['item stacks', 'slot limits', 'equip slots', 'weight or capacity'],
  'a save system': ['schema versioning', 'atomic writes', 'migration on load', 'corruption recovery'],
  'a dialogue system': ['node graph', 'conditions and flags', 'localisation keys', 'branching history'],
  'a crafting tree': ['recipe definitions', 'ingredient lookup', 'unlock gating', 'station types'],
  'a day/night cycle': ['tick clock', 'lighting curve', 'scheduled events', 'sleep and skip'],
  'a quest log': ['objective tracking', 'completion state', 'reward payout', 'quest chaining'],
  'a shop and economy': ['price drift', 'stock levels', 'supply events', 'currency sinks'],
  'an enemy AI layer': ['state machine', 'aggro range', 'pathing to target', 'spawn tables'],
  'a level editor': ['tile placement', 'undo history', 'serialisation format', 'validation rules'],
  'a particle system': ['emitter config', 'pooling', 'lifetime curves', 'blend modes'],
  'a multiplayer lobby': ['room creation', 'ready state', 'host migration', 'reconnect handling'],
  'a tutorial flow': ['step gating', 'skip and replay', 'contextual hints', 'completion flags'],
  'an achievement system': ['trigger conditions', 'progress counters', 'persistence', 'notification queue'],
  'a pathfinding layer': ['grid or navmesh', 'cost weighting', 'dynamic obstacles', 'path caching'],
  'a weather system': ['condition states', 'transition timing', 'gameplay effects', 'seeded variation'],
  'a skill tree': ['node prerequisites', 'point spending', 'respec handling', 'tier gating'],
  'a loot table': ['drop weights', 'rarity tiers', 'guaranteed drops', 'level scaling'],
  'a camera controller': ['follow smoothing', 'bounds clamping', 'zoom levels', 'screen shake'],
  'a settings menu': ['persisted preferences', 'apply and revert', 'input rebinding', 'accessibility toggles'],
};
const RISKS = [
  ['Scope creep', 'Ship the smallest version that works, then extend.'],
  ['Unclear ownership of state', 'Name one owner per piece of state up front.'],
  ['Performance under load', 'Measure with realistic data before optimising.'],
  ['Save compatibility', 'Version the schema and write a migration with the change.'],
  ['Silent failure', 'Make errors visible at the boundary rather than swallowed.'],
  ['Hidden coupling', 'Keep the interface narrow and documented.'],
];
const ASK = ['Respond using exactly these markdown section headers, in this order',
             'Use exactly these markdown headers, in order',
             'Structure your answer with exactly these section headers, in this order'];

function bullets(items) { return items.map(i => '- ' + i).join('\n'); }

function build() {
  const canvas = pick(CANVASES);
  const subject = pick(SUBJECTS);
  const parts = NOUNS[subject];
  const user = 'You are helping with the following request:\n\n' + pick(['build ', 'design ', 'plan ', 'sketch ']) + subject
    + '\n\n' + pick(ASK) + ', each followed by concise content (use bullet points where helpful):\n\n'
    + canvas.sections.map(s => '## ' + s).join('\n')
    + '\n\nDo not add any extra top-level headers or preamble text before the first header.';

  const body = {};
  for (const s of canvas.sections) {
    if (/Overview|Summary|Goal/.test(s)) {
      body[s] = bullets([
        `${subject.replace(/^an? /, '').replace(/^./, c => c.toUpperCase())} that covers ${parts[0]} and ${parts[1]}.`,
        `Keep it self-contained so it can be tested without the rest of the game.`,
        `Success means ${pick(parts)} behaves predictably under repeated use.`,
      ]);
    } else if (/Key Components|Components|Milestones|Tasks/.test(s)) {
      body[s] = bullets(some(parts, ri(3, 4)).map(p => `${p.replace(/^./, c => c.toUpperCase())} - defined in one place and read everywhere else.`));
    } else if (/Dependencies|Data Flow/.test(s)) {
      body[s] = bullets([
        `Reads from the existing game state; writes back through a single entry point.`,
        `${parts[0].replace(/^./, c => c.toUpperCase())} feeds ${parts[1]}, which the UI renders.`,
        `No external services required.`,
      ]);
    } else if (/Open Questions/.test(s)) {
      body[s] = bullets([`How should ${parts[2]} behave at the boundaries?`,
                         `Does ${parts[3]} need to persist across sessions?`,
                         `What is the smallest version worth shipping first?`]);
    } else if (/Risks & Mitigations|Tradeoffs|Weaknesses/.test(s)) {
      body[s] = some(RISKS, ri(2, 3)).map(([r, m]) => `- **${r}**: ${m}`).join('\n');
    } else if (/Strengths/.test(s)) {
      body[s] = bullets([`${parts[0].replace(/^./, c => c.toUpperCase())} is already well understood.`,
                         `The change is additive and easy to revert.`]);
    } else {
      body[s] = bullets([`Start with ${parts[0]}, then layer ${parts[1]}.`,
                         `Revisit once it is exercised by real play.`]);
    }
  }
  const answer = canvas.sections.map(s => '## ' + s + '\n' + body[s]).join('\n\n');
  return { canvas: canvas.id, sections: canvas.sections, user, answer };
}

// Structural verification: every header present, in order, prose under each, no code fence.
function verify(b) {
  if (/```/.test(b.answer)) return 'contains a code block';
  let cursor = -1;
  for (const s of b.sections) {
    const at = b.answer.indexOf('## ' + s);
    if (at === -1) return 'missing header ' + s;
    if (at < cursor) return 'headers out of order at ' + s;
    cursor = at;
  }
  const extra = (b.answer.match(/^## /gm) || []).length;
  if (extra !== b.sections.length) return `expected ${b.sections.length} headers, found ${extra}`;
  for (const s of b.sections) {
    const seg = b.answer.split('## ' + s)[1].split('\n## ')[0].trim();
    if (seg.length < 40) return 'thin content under ' + s;
  }
  return null;
}

const rows = [], seen = new Set();
let attempts = 0, dup = 0, bad = 0;
const tally = {};
while (rows.length < TARGET && attempts < TARGET * 12) {
  attempts++;
  const b = build();
  const why = verify(b);
  if (why) { bad++; continue; }
  const key = createHash('sha1').update(b.user + '|' + b.answer).digest('hex');
  if (seen.has(key)) { dup++; continue; }
  seen.add(key);
  tally[b.canvas] = (tally[b.canvas] || 0) + 1;
  rows.push({ messages: [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: b.user },
    { role: 'assistant', content: b.answer },
  ]});
}
writeFileSync(OUT, rows.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
console.log(`kept ${rows.length} structured rows -> ${OUT}`);
console.log(`attempts ${attempts} | rejected ${bad} | duplicates ${dup}`);
console.log('by canvas:', JSON.stringify(tally));
