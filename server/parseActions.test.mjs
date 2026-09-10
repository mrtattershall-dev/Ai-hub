/**
 * parseActions.test.mjs - recovering the actions the loop has been throwing away.
 *
 *   node server/parseActions.test.mjs
 *
 * `parseAction` matches ACTION: WITHOUT /g. It returns the first action and everything after
 * it is discarded in silence. Measured across 1,759 recorded real responses: 102 carry more
 * than one action, and 49 contain a `finish` that is not first - all thrown away, with the
 * model told nothing. It then re-sends the identical reply until the repetition guard kills
 * the run, which is reported as "the model made no progress".
 *
 * `parseActions` returns all of them. This checks it against the REAL multi-action responses
 * rather than invented ones, because the shapes that matter here (a fenced write followed by
 * a run_command, three task_done in a row then finish) are shapes a person would not think
 * to write.
 *
 * NOTE ON SCOPE: parsing them is not the same as executing them. Executing a batch blind is
 * unsafe - the model writes a file, runs it, AND finishes in one reply, having seen none of
 * the results. That decision belongs to the run loop, not here.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAction, parseActions } from './agentParse.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, 'testdata', 'model-corpus.jsonl');

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};
const fence = (lang, body) => '```' + lang + '\n' + body + '\n```';

console.log('\nparseActions\n');

test('a single-action reply behaves exactly as before', () => {
  const text = `THOUGHT: writing it.\nACTION: write_file\nPATH: a.js\n${fence('javascript', 'const a=1;')}`;
  const many = parseActions(text, null);
  const one = parseAction(text, null);
  assert.equal(many.length, 1, 'a single action should yield exactly one');
  assert.deepEqual(many[0], one, 'the single-action path must not change behaviour');
});

test('an unparseable reply yields an empty list, not a null entry', () => {
  assert.deepEqual(parseActions('just some prose about the plan', null), []);
  assert.deepEqual(parseActions('', null), []);
});

test('each action keeps its OWN path and fenced content', () => {
  const text = [
    'THOUGHT: first.', 'ACTION: write_file', 'PATH: one.js', fence('javascript', 'const one=1;'),
    'THOUGHT: second.', 'ACTION: write_file', 'PATH: two.js', fence('javascript', 'const two=2;'),
  ].join('\n');
  const acts = parseActions(text, null);
  assert.equal(acts.length, 2, `expected 2 actions, got ${acts.length}`);
  assert.equal(acts[0].args.path, 'one.js');
  assert.equal(acts[1].args.path, 'two.js', 'the second action inherited the first path');
  assert.match(acts[0].args.content, /const one=1;/);
  assert.match(acts[1].args.content, /const two=2;/, 'the second action got the wrong fenced block');
});

test('the real shape that lost 49 finishes: task_done x3 then finish', () => {
  const text = [
    'THOUGHT: closing them out.', 'ACTION: task_done', 'TEXT: 1',
    'THOUGHT: and this.', 'ACTION: task_done', 'TEXT: 2',
    'THOUGHT: and this.', 'ACTION: task_done', 'TEXT: 3',
    'THOUGHT: all done.', 'ACTION: finish', 'SUMMARY: built it.',
  ].join('\n');
  const acts = parseActions(text, null);
  assert.equal(acts.length, 4, `expected 4 actions, got ${acts.length}`);
  assert.equal(acts[3].tool, 'finish', 'the finish - the thing being discarded - was not recovered');
});

test('a runaway reply is capped', () => {
  const text = Array.from({ length: 40 }, (_, i) => `THOUGHT: t${i}\nACTION: list_dir\nPATH: .`).join('\n');
  const acts = parseActions(text, null, 6);
  assert.ok(acts.length <= 6, `cap ignored: ${acts.length} actions returned`);
  // The corpus contains a reply with 321 ACTION lines. Without a cap that is 321 tool calls
  // from one model turn.
});

// ── against the real corpus ──────────────────────────────────────────────────
if (!existsSync(CORPUS)) {
  console.log('  SKIP  no corpus - the checks below are the ones that matter');
} else {
  const rows = readFileSync(CORPUS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const multi = rows.filter((r) => r.actions.length > 1);

  test('CORPUS: it never throws on a real multi-action reply', () => {
    const boom = [];
    for (const r of multi) {
      try { parseActions(r.text, 'prior.js'); } catch (e) { boom.push(e.message); }
    }
    assert.equal(boom.length, 0, `threw on ${boom.length} of ${multi.length}: ${boom[0]}`);
  });

  test('CORPUS: it recovers more actions than the old parser did', () => {
    let recovered = 0, before = 0;
    for (const r of multi) {
      before += parseAction(r.text, 'prior.js') ? 1 : 0;
      recovered += parseActions(r.text, 'prior.js').length;
    }
    console.log(`        ${multi.length} multi-action replies: old parser saw ${before} actions, parseActions sees ${recovered}`);
    assert.ok(recovered > before, 'no additional actions recovered - the split is not working on real replies');
  });

  test('CORPUS: the first action never changes TOOL or THOUGHT', () => {
    // Non-negotiable. A different tool would mean enabling this changes what the loop does
    // rather than adding to it, and every measurement taken so far would be void.
    const drift = [];
    for (const r of multi) {
      const old = parseAction(r.text, 'prior.js');
      const now = parseActions(r.text, 'prior.js')[0];
      if (!old && !now) continue;
      if (old?.tool !== now?.tool || old?.thought !== now?.thought) drift.push(`${old?.tool} -> ${now?.tool}`);
    }
    assert.equal(drift.length, 0, `first action changed tool/thought on ${drift.length} reply(s): ${drift[0]}`);
  });

  test('CORPUS: argument drift happens ONLY where the old parser reached past its own action', () => {
    // The old whole-text parser could not tell whose PATH:/FIND: it was reading. Real case
    // from the corpus: `verify_project` followed by `see_screen`, where the only PATH: in the
    // reply belongs to see_screen - and the old parser used it as verify_project's entry.
    // One action silently stealing another's argument is a bug, so this drift is a FIX.
    //
    // Asserted narrowly: a difference is allowed only when the label that produces the field
    // is absent from the first action's own span. Anything else is a real regression.
    const bad = [];
    for (const r of multi) {
      const old = parseAction(r.text, 'prior.js');
      const now = parseActions(r.text, 'prior.js')[0];
      if (JSON.stringify(old) === JSON.stringify(now)) continue;
      const starts = [...r.text.matchAll(/^[ \t]*ACTION:[ \t]*[a-z_]+/gim)].map((m) => m.index);
      const ownSpan = r.text.slice(0, starts[1] ?? r.text.length);
      const keys = new Set([...Object.keys(old?.args || {}), ...Object.keys(now?.args || {})]);
      for (const k of keys) {
        if (JSON.stringify(old?.args?.[k]) === JSON.stringify(now?.args?.[k])) continue;
        const label = { path: /PATH:/i, entry: /PATH:/i, find: /^[ \t]*FIND:/im, replace: /^[ \t]*REPLACE:/im }[k];
        // If the label IS in the first action's own span, the split lost something it owned.
        if (label && label.test(ownSpan)) bad.push(`${old?.tool}.${k} was inside its own span but changed`);
      }
    }
    assert.equal(bad.length, 0, `the split lost a field the first action owned: ${bad[0]}`);
  });

  test('CORPUS: the recovered finishes are the ones that were being dropped', () => {
    const withLateFinish = multi.filter((r) => r.actions.indexOf('finish') > 0);
    const found = withLateFinish.filter((r) => parseActions(r.text, 'prior.js', 8).some((a) => a.tool === 'finish')).length;
    console.log(`        ${withLateFinish.length} replies contain a non-first finish; parseActions recovers ${found}`);
    assert.ok(found > withLateFinish.length * 0.5,
      `only ${found} of ${withLateFinish.length} recovered - the split is missing the trailing action`);
  });
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
