/**
 * tochat.mjs - turn PASSING hub runs (from rungoals.mjs) into multi-turn training conversations.
 *
 *   node factory/tochat.mjs <tracesDir> [<tracesDir> ...] [--out factory/raw/train_rows.jsonl]
 *        [--max-tool-errors 2]
 *
 * One passing run -> one conversation, exactly as the model saw it: the hub's system prompt, the
 * goal and file list, then every reply the model gave and every tool result the hub sent back.
 * Trained replies-only (train_on_responses_only), every assistant turn is a supervised example -
 * so the useful count is ASSISTANT TURNS, reported alongside conversations.
 *
 * WHY THIS SHAPE: run5 looped in the hub because all 13,762 of its rows were single-turn; it had
 * never seen a tool result followed by a next move. These rows are nothing but that.
 *
 * WHAT IS LEFT OUT, AND WHY
 *   - runs the black-box checker did not pass           (the work was not done)
 *   - runs where the hub's finish gate said "not yet"   (finishBlocks > 0: a run that only ended
 *     because the gate's cap let a repeated finish through would teach pushing past the gate -
 *     the first mock dry run on snake.io was exactly that)
 *   - runs with more than --max-tool-errors ERROR tool results (too much thrashing to imitate)
 * Machine-specific strings are normalised so rows do not teach one laptop's paths: temp workspace
 * paths -> <workspace>, localhost ports -> localhost:PORT, the "screenshot saved for the human" line
 * is dropped. Every row carries repo, licence and commit, so provenance survives into training.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i > -1 && args[i + 1] ? args[i + 1] : d; };
const OUT = resolve(flag('out', join(HERE, 'raw', 'train_rows.jsonl')));
const MAX_ERRS = Number(flag('max-tool-errors', 2));
const dirs = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));

const clean = (text) => String(text || '')
  .replace(/[A-Za-z]:[\\/][^\s'"`)]*?rungoal-[A-Za-z0-9]+[\\/]workspace/g, '<workspace>')
  .replace(/\/tmp\/rungoal-[A-Za-z0-9]+\/workspace/g, '<workspace>')
  .replace(/localhost:\d+/g, 'localhost:PORT')
  .replace(/127\.0\.0\.1:\d+/g, '127.0.0.1:PORT')
  .split('\n').filter((l) => !/^\(Screenshot saved for the human:.*\)\s*$/.test(l.trim())).join('\n');

const isToolError = (m) => m.role === 'user' && /^TOOL RESULT \([^)]*\):\s*\n?ERROR/.test(String(m.content || ''));

const rows = [];
const skipped = {};
const skip = (why) => { skipped[why] = (skipped[why] || 0) + 1; };
let turns = 0;
for (const d of dirs) {
  const results = join(d, 'results.jsonl');
  if (!existsSync(results)) { console.error('no results.jsonl in ' + d); continue; }
  for (const line of readFileSync(results, 'utf8').split('\n').filter(Boolean)) {
    const rec = JSON.parse(line);
    if (!rec.pass) { skip('checker did not pass'); continue; }
    if (!rec.runFile || !existsSync(join(d, rec.runFile))) { skip('no run file'); continue; }
    const run = JSON.parse(readFileSync(join(d, rec.runFile), 'utf8'));
    const hist = run.history || [];
    // Gate blocks from EVERY source: the result record, the hub's own run file, and the gate's
    // "Do NOT finish yet" messages in the history. A record written before rungoals recorded
    // finishBlocks said nothing, and the first version of this check waved a 3-block forced
    // finish straight through as if it were clean.
    const blocks = Math.max(rec.finishBlocks || 0, run.finishBlocks || 0,
      hist.filter((m) => m.role === 'user' && String(m.content || '').startsWith('Do NOT finish yet')).length);
    if (blocks > 0 || rec.forcedFinish) { skip('finish gate blocked ' + blocks + 'x'); continue; }
    const errs = hist.filter(isToolError).length;
    if (errs > MAX_ERRS) { skip('more than ' + MAX_ERRS + ' tool errors'); continue; }
    const messages = hist.map((m) => ({ role: m.role, content: clean(m.content) }));
    while (messages.length && messages[messages.length - 1].role !== 'assistant') messages.pop();
    const assistant = messages.filter((m) => m.role === 'assistant').length;
    if (!assistant || messages[0].role !== 'system') { skip('malformed history'); continue; }
    turns += assistant;
    rows.push({ messages, meta: { repo: rec.repo, license: rec.license, sha: rec.sha, goal: rec.goal, label: rec.label, model: rec.model, assistantTurns: assistant, toolErrors: errs } });
  }
}
writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
console.log(`${rows.length} conversation(s), ${turns} assistant turn(s) -> ${OUT}`);
console.log('left out:', JSON.stringify(skipped));
