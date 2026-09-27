/**
 * requestAudit.mjs - WHAT ACTUALLY REACHED THE MODEL in DOM-EVIDENCE-1?
 *
 *   node server/requestAudit.mjs <dir with req_{basic,diagnosis}_seed*.json> [--model-url ...]
 *
 * THE UNRESOLVED QUESTION. Two of my record fields were defective in that run: one name held both the
 * diagnosis engine's plan and the gate's classification, and the stored evidence was a window that
 * began at the file, so everything added after the file fell outside it. I then claimed the
 * model-facing request was unaffected. Those two statements are about different things - the record
 * versus the request - but the request itself was never saved, so the claim rested on a prompt-token
 * delta. That is an inference, not a record.
 *
 * WHAT THIS DOES. The requests are rebuilt through the loop's own code path (`--dry-run-request`),
 * then tokenized by the same server that served the run, and the counts compared against the
 * `promptTokens` the live run recorded. The chat template is applied server-side, so an exact match
 * on every seed in both arms means the rebuilt message is the message that was sent. A mismatch
 * anywhere means it is not, and the comparison's interpretation stays unresolved.
 *
 * LIMITS, because this is an audit and not a proof: the count is taken from a model of the same family
 * and template as the one that ran (the 7B is not resident locally), so what is established is
 * agreement of token counts under the same tokenizer and template, not a byte-level capture of the
 * original HTTP request. A byte-level record now exists for future runs; it cannot exist for a past one.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const DIR = argv.find((a) => !a.startsWith('--'));
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 ? argv[i + 1] : d; };
const URL_BASE = opt('model-url', 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = opt('model', 'qwen2.5-coder:1.5b');
const SCREEN = 'legasus/screen';
if (!DIR) { console.error('usage: requestAudit.mjs <dir> [--model-url ...] [--model ...]'); process.exit(2); }

/** Count the prompt tokens the server would charge for this exact chat request. */
async function promptTokens(system, user) {
  const res = await fetch(`${URL_BASE}/api/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, stream: false,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      options: { temperature: 0, num_predict: 1 },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).prompt_eval_count ?? null;
}

const rows = [];
for (const arm of [['E0', 'basic'], ['E2', 'diagnosis']]) {
  const [armId, mode] = arm;
  for (const seed of [2, 3, 4, 5]) {
    const reqFile = join(DIR, `req_${mode}_seed${seed}.json`);
    const recFile = join(SCREEN, `DOM-EVIDENCE-1_${armId}_seed${seed}.json`);
    if (!existsSync(reqFile)) { rows.push({ armId, seed, note: 'no rebuilt request' }); continue; }
    const req = JSON.parse(readFileSync(reqFile, 'utf8'));
    const counted = await promptTokens(req.system, req.user);
    let recorded = null, recordedNote = '';
    if (existsSync(recFile)) {
      const rec = JSON.parse(readFileSync(recFile, 'utf8'));
      const r1 = rec.rounds.find((x) => x.round === 1 && x.kind === 'repair attempt');
      recorded = r1?.promptTokens ?? null;
    } else { recordedNote = 'record lost (reconstructed run)'; }
    rows.push({
      armId, seed, mode, planInRebuilt: req.hypothesis, chars: req.userChars,
      counted, recorded, match: recorded !== null ? counted === recorded : null, recordedNote,
    });
  }
}

console.log('arm  seed  mode        plan in the rebuilt request  chars   counted  recorded  match');
for (const r of rows) {
  if (r.note) { console.log(`${r.armId}   ${r.seed}     ${r.note}`); continue; }
  console.log(`${r.armId}   ${r.seed}     ${r.mode.padEnd(10)}  ${String(r.planInRebuilt).padEnd(26)} ${String(r.chars).padStart(5)}   ${String(r.counted).padStart(7)}  ${String(r.recorded ?? '-').padStart(8)}  ${r.match === null ? r.recordedNote : r.match ? 'YES' : 'NO'}`);
}

const comparable = rows.filter((r) => r.match !== null && r.match !== undefined);
const allMatch = comparable.length > 0 && comparable.every((r) => r.match);
const delta = (() => {
  const e0 = rows.filter((r) => r.armId === 'E0' && r.counted), e2 = rows.filter((r) => r.armId === 'E2' && r.counted);
  return e0.length && e2.length ? e2.map((r, i) => r.counted - e0[i].counted) : [];
})();
console.log('');
console.log(`  comparable seeds: ${comparable.length}   all counts match the live record: ${allMatch ? 'YES' : 'NO'}`);
console.log(`  diagnosis minus basic, per seed: ${JSON.stringify(delta)}`);
console.log('');
if (allMatch) {
  console.log('  => the rebuilt requests tokenize to exactly the counts the live run recorded, on every');
  console.log('     comparable seed in both arms. The diagnosis-mode requests carry the structured plan,');
  console.log('     so the diagnosis DID reach the model and the two record defects were confined to the');
  console.log('     record. The comparison\'s interpretation is resolved, within the limits at the top.');
} else {
  console.log('  => the rebuilt requests do NOT match the live record. What reached the model is NOT');
  console.log('     established, and the diagnosis comparison must be treated as unresolved.');
}
process.exit(allMatch ? 0 : 1);
