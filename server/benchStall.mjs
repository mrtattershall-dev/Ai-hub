/**
 * benchStall.mjs - confirm the outline-loop mechanism across every NO_EDIT case.
 *
 *   node server/benchStall.mjs <bench1-root>
 *
 * For each task that never edited its target: did it ever read_file? was it stopped by the
 * repeat guard? did the guard's warning appear? were consecutive model replies byte-identical?
 * All from the run records and transcripts already on disk. No model calls.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2];
const NOEDIT = ['bucketsort', 'is_valid_parenthesization', 'kheapsort', 'lcs_length', 'lis',
  'longest_common_subsequence', 'max_sublist_sum', 'mergesort', 'next_palindrome', 'pascal'];

const recs = readdirSync(join(ROOT, 'runs')).filter((f) => f.endsWith('.json'))
  .map((f) => ({ f, j: JSON.parse(readFileSync(join(ROOT, 'runs', f), 'utf8')) }));

let everRead = 0, guardWarned = 0, stoppedByRepeat = 0, identical = 0;
console.log('task                          read_file?  guard warned?  repeat-stop?  identical replies?');
for (const n of NOEDIT) {
  const x = recs.find((r) => String(r.j.goal || '').includes(`${n}.py`));
  const st = x?.j.steps || [];
  const tools = st.filter((s) => s.tool).map((s) => s.tool);
  const read = tools.includes('read_file'); if (read) everRead++;
  const warned = st.some((s) => /already ran this exact/.test(String(s.result || ''))); if (warned) guardWarned++;
  const rep = st.some((s) => s.type === 'error' && /same response|identical answer/.test(String(s.text || ''))); if (rep) stoppedByRepeat++;
  let ident = false;
  const t = join(ROOT, 'runs', x.f.replace('.json', '.transcript.jsonl'));
  if (existsSync(t)) {
    const replies = readFileSync(t, 'utf8').split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((l) => l && typeof l.reply === 'string').map((l) => l.reply);
    for (let i = 1; i < replies.length; i++) if (replies[i] && replies[i] === replies[i - 1]) { ident = true; break; }
  }
  if (ident) identical++;
  console.log(n.padEnd(30) + (read ? 'yes' : 'NO ').padEnd(12) + (warned ? 'yes' : 'no ').padEnd(15) + (rep ? 'yes' : 'no ').padEnd(14) + (ident ? 'yes' : 'no'));
}
console.log(`\n${NOEDIT.length} NO_EDIT cases: read_file ${everRead}/10 | guard warned ${guardWarned}/10 | stopped by repeat guard ${stoppedByRepeat}/10 | byte-identical consecutive replies ${identical}/10`);
