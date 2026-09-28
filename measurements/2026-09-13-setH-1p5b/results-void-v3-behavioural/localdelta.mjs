// CAN THE HELD-OUT BEHAVIOUR BE EXPRESSED AS A LOCALIZED DELTA THAT LEAVES to_html MOSTLY INTACT?
//
// The earlier confinement proof established only FUNCTION-level confinement: a correct
// implementation of goals 64 and 74 exists entirely inside to_html. That is what justified
// whole-function replacement. It does NOT establish the stronger and more useful property:
//
//     the new behaviour can be added by INSERTING lines, leaving every existing line byte-identical.
//
// If that holds, whole-function replacement is strictly the wrong operation: it deletes 954 bytes of
// working implementation that the model then has to reconstruct, and the regression suite exists to
// protect information the generator was never given.
//
// NO MODEL IS INVOLVED HERE. These are hand-written reference patches expressed as ANCHORED PURE
// INSERTIONS - each site names an anchor that must occur EXACTLY ONCE in the source, and inserts text
// after it. Nothing is deleted and nothing is modified, by construction. The script then proves:
//
//   1. every anchor is unique                   (the patch is unambiguous)
//   2. the edit is insertion-only               (every original line survives, in order)
//   3. how much of to_html stays byte-identical (the size of the responsibility actually delegated)
//   4. the OLD regression suite still passes    (nothing was broken)
//   5. the NEW delta probe passes               (the goal is actually achieved this way)
//
// 4 and 5 together are the three-witness requirement: the reference patch PASSES, and it passes while
// the old behaviour survives - which is exactly what whole-function replacement failed 12/12 times.
import { regressionFor } from './regression.mjs';
import { probe60For } from './probes60.mjs';
import { checkContract } from './contractCheck.mjs';
import { deriveContract } from './contract.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const FENCE = String.fromCharCode(96, 96, 96);

const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}
const names = [...world.keys()].sort();
const freshWs = () => {
  const ws = mkdtempSync(join(tmpdir(), 'ldelta-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of names) writeFileSync(join(ws, f), world.get(f));
  return ws;
};

// ---------------------------------------------------------------------------------------------
// GOAL 64 - ordered lists, written exactly like the existing unordered lists.
// Seven insertion sites. Zero existing lines touched.
const PATCH64 = [
  { why: 'accumulator, beside the existing items[]',
    after: '    items = []\n',
    text: '    ol_items = []\n' },
  { why: 'flush_ol, mirroring flush_list',
    after: '    def flush_list():\n        if items:\n            blocks.append("<ul>" + "".join("<li>" + _inline(i) + "</li>" for i in items) + "</ul>")\n            del items[:]\n',
    text: '\n    def flush_ol():\n        if ol_items:\n            blocks.append("<ol>" + "".join("<li>" + _inline(i) + "</li>" for i in ol_items) + "</ol>")\n            del ol_items[:]\n' },
  { why: 'a blank line closes an ordered list too',
    after: '            flush_list()\n            continue\n',
    text: '            flush_ol()\n' },
  { why: 'a "- " line closes an open ordered list',
    after: '        if line.startswith("- "):\n            flush_para()\n',
    text: '            flush_ol()\n' },
  { why: 'the new branch itself',
    after: '            items.append(line[2:].strip())\n            continue\n',
    text: '        m_ol = re.match(r"^\\d+\\. (.*)$", line)\n        if m_ol:\n            flush_para()\n            flush_list()\n            ol_items.append(m_ol.group(1).strip())\n            continue\n' },
  { why: 'any other line closes an open ordered list',
    after: '        flush_list()\n        h = _is_heading(line)\n',
    text: '        flush_ol()\n' },
  { why: 'end of input flushes an open ordered list',
    after: '    flush_para()\n    flush_list()\n',
    text: '    flush_ol()\n' },
];

// ---------------------------------------------------------------------------------------------
// GOAL 74 - fenced code blocks. Three insertion sites. Zero existing lines touched.
// The fence check goes FIRST in the loop so a blank line inside a fence is kept verbatim rather than
// being treated as a block separator.
const EMIT = 'blocks.append("<pre><code>" + _escape("\\n".join(fence)) + "</code></pre>")';
const PATCH74 = [
  { why: 'fence state, beside the existing items[]',
    after: '    items = []\n',
    text: '    fence = None\n' },
  { why: 'fence handling ahead of every other line rule',
    after: '    for line in str(text).split("\\n"):\n',
    text: '        if fence is not None:\n'
        + '            if line.strip() == "' + FENCE + '":\n'
        + '                ' + EMIT + '\n'
        + '                fence = None\n'
        + '            else:\n'
        + '                fence.append(line)\n'
        + '            continue\n'
        + '        if line.strip() == "' + FENCE + '":\n'
        + '            flush_para()\n'
        + '            flush_list()\n'
        + '            fence = []\n'
        + '            continue\n' },
  { why: 'an unclosed fence runs to the end of the text',
    after: '    flush_para()\n    flush_list()\n',
    text: '    if fence is not None:\n        ' + EMIT + '\n' },
];

function applyPatch(src, patch) {
  let out = src;
  const sites = [];
  for (const site of patch) {
    const n = out.split(site.after).length - 1;
    if (n !== 1) return { ok: false, why: 'anchor occurs ' + n + ' times (must be exactly 1): ' + site.why };
    const at = out.indexOf(site.after);
    out = out.slice(0, at + site.after.length) + site.text + out.slice(at + site.after.length);
    sites.push({ why: site.why, lines: site.text.replace(/\n$/, '').split('\n').length, bytes: site.text.length });
  }
  return { ok: true, src: out, sites };
}

// Insertion-only in the strict sense: the original file is a SUBSEQUENCE of the new one, line for
// line, in order. Anything deleted or modified breaks this.
function insertionOnlyLines(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  let i = 0;
  const lost = [];
  for (const line of a) {
    let found = -1;
    for (let j = i; j < b.length; j++) if (b[j] === line) { found = j; break; }
    if (found === -1) lost.push(line);
    else i = found + 1;
  }
  return { ok: lost.length === 0, lost, added: b.length - a.length };
}

function bodyOf(src) {
  const at = src.indexOf('def to_html(');
  const rest = src.slice(at).split('\n');
  let end = rest.length;
  for (let k = 1; k < rest.length; k++) {
    if (rest[k].trim() === '') continue;
    if (!/^[ \t]/.test(rest[k])) { end = k; break; }
  }
  return rest.slice(0, end).join('\n');
}

console.log('  LOCALIZED-DELTA EXPRESSIBILITY - reference patches, no model\n');
let allOk = true;
for (const { goal, patch } of [{ goal: 64, patch: PATCH64 }, { goal: 74, patch: PATCH74 }]) {
  const c = deriveContract(GOALS[goal - 1]);
  const ws = freshWs();
  const path = join(ws, c.lead);
  const src0 = readFileSync(path, 'utf8');

  console.log('===== GOAL ' + goal + ' =====');
  const r = applyPatch(src0, patch);
  if (!r.ok) { console.log('  PATCH REFUSED: ' + r.why + '\n'); allOk = false; continue; }

  const ins = insertionOnlyLines(src0, r.src);
  const b0 = bodyOf(src0);
  const b1 = bodyOf(r.src);
  const keptLines = b0.split('\n').filter((l) => b1.split('\n').includes(l)).length;

  console.log('  insertion sites:            ' + r.sites.length);
  for (const s of r.sites) console.log('    +' + String(s.lines).padStart(2) + ' lines  ' + s.why);
  console.log('  existing lines DELETED or MODIFIED: ' + ins.lost.length + (ins.lost.length ? '  <-- NOT insertion-only' : '  (insertion-only PROVEN)'));
  console.log('  lines added:                ' + ins.added);
  console.log('  to_html before / after:     ' + b0.split('\n').length + ' -> ' + b1.split('\n').length + ' lines, '
    + b0.length + ' -> ' + b1.length + ' bytes');
  console.log('  of the original to_html:    ' + keptLines + '/' + b0.split('\n').length + ' lines survive byte-identical');
  console.log('  model responsibility:       ' + ins.added + ' new lines instead of reconstructing ' + b0.split('\n').length);

  writeFileSync(path, r.src, 'utf8');
  const loadOnly = checkContract(ws, c.lead, { ...c, moduleExports: [], members: [] });
  const suite = regressionFor(c.lead);
  const reg = loadOnly.loads ? suite(ws) : { pass: false, why: 'does not load' };
  const probe = probe60For(goal);
  const delta = loadOnly.loads ? probe.run(ws) : { pass: false, why: 'does not load' };
  console.log('  loads:                      ' + loadOnly.loads + (loadOnly.loads ? '' : '  ' + String(loadOnly.msg).slice(0, 80)));
  console.log('  OLD regression suite:       ' + (reg.pass ? 'PASS' : 'FAIL  ' + reg.why));
  console.log('  NEW delta probe:            ' + (delta.pass ? 'PASS' : 'FAIL  ' + delta.why));
  const verdict = loadOnly.loads && reg.pass && delta.pass;
  console.log('  VERDICT: ' + (verdict
    ? 'the held-out behaviour IS expressible as a pure insertion with old behaviour intact'
    : 'NOT achievable by this patch') + '\n');
  if (!verdict || ins.lost.length) allOk = false;
}
console.log(allOk
  ? '  BOTH goals are pure-insertion expressible. Whole-function replacement was the wrong operation.'
  : '  At least one goal is not cleanly insertion-expressible - see above.');
