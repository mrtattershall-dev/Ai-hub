/**
 * historyWindow.test.mjs - the context window a long run actually gets to keep.
 *
 *   node server/historyWindow.test.mjs
 *
 * THE DEFECT, found 2026-09-12 by replaying pruneHistory over all 835 set J model calls: the tail admission loop
 * carries BOTH a token budget and a vestigial MESSAGE-COUNT cap, and the count always wins. The comment directly
 * above the break says the count rule was REPLACED because "Sixteen messages can be 200 tokens or 200,000 ... Tokens
 * are the only unit the backend charges in" - and then the count rule was left in the loop, still deciding. It caps
 * the tail at MAX_HISTORY_MSGS - head - 1 = 12 messages = THE LAST SIX TURNS. It first fires at call 8 of every run
 * of every arm, and across all 835 calls the token budget was never the binding constraint once: final windows used
 * 38-70% of their allowance while content was discarded on message count alone.
 *
 * This is the same shape as the def-loss warning and verify_project before it: the rule that was FIXED advises, and
 * the rule that was SUPERSEDED decides. A 30-call run remembers six turns, so it re-reads what it already read and
 * edits files it can no longer see - setI run de950b2d read s3_matrix.js twice, lost both reads to pruning by call
 * 25, then spent ten calls deleting lines it believed were a stray brace. 55 lines -> 47, and sub() is a comment.
 *
 * Every case drives the SHIPPED pruneHistory. The cases that must FAIL before the fix assert the shipped behaviour
 * as a `precondition:` first, so none of them can quietly pass for the wrong reason.
 */
import assert from 'node:assert/strict';

const { __modelCallTest } = await import('./agent.js');
const { pruneHistory } = __modelCallTest;
const { estimateTokens } = await import('./escalate.js');

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log('  ok    ' + name); }
  catch (e) { failed++; console.error('  FAIL  ' + name + '\n        ' + String(e.message).split('\n').slice(0, 4).join('\n        ')); }
};

/** A run whose history is `n` SMALL messages after the anchors - small enough that tokens can never be the limit. */
const makeRun = (n, chars = 200) => {
  const history = [
    { role: 'system', content: 'SYSTEM' },
    { role: 'user', content: 'GOAL: build s3_matrix.js' },
    { role: 'assistant', content: 'BUILD PLAN: do the thing' },
  ];
  for (let i = 0; i < n; i++) {
    history.push({ role: i % 2 ? 'assistant' : 'user', content: ('m' + i + ' ').padEnd(chars, 'x') });
  }
  return { history };
};

console.log('\nthe context window a long run keeps (shipped pruneHistory)\n');

test('THE BUG: 40 small messages, a budget none of them threaten - the window must survive intact', () => {
  const run = makeRun(40);
  const before = run.history.length;
  const budget = 20000;                                  // 40 x 200 chars = ~2000 est-tokens. Nowhere near it.
  assert.ok(estimateTokens(run.history) < budget / 4,
    'precondition: the whole history is a small fraction of the budget, so tokens cannot be what prunes it');
  pruneHistory(run, budget);
  const kept = run.history.length;
  // RED-FIRST EVIDENCE, recorded the first time this case ran against the SHIPPED function (2026-09-12):
  //     kept 16 of 43, spending 645 of 20,000 tokens - 3.2% of the allowance.
  // The old ceiling was head(system+goal+plan) + the trimmed-notice + 12 tail = 17, whatever the budget said.
  // This assertion cannot be satisfied by the rule it replaced, which is the only reason it is worth having.
  assert.ok(kept > 17,
    'the tail must be admitted until the TOKEN budget is spent, not cut at 12 messages. kept=' + kept
    + ' of ' + before + ', using ' + estimateTokens(run.history) + ' of ' + budget + ' tokens');
  assert.equal(kept, before,
    'and with 97% of the budget unspent nothing may be dropped AT ALL: kept=' + kept + ' of ' + before);
});

test('THE CONSEQUENCE: a read from 20 steps ago is still in the window when the budget allows it', () => {
  const run = makeRun(40);
  run.history[4] = { role: 'user', content: 'TOOL RESULT (read_file): s3_matrix.js line 52 is RETURN_NEW_MATRIX' };
  pruneHistory(run, 20000);
  const text = run.history.map((m) => m.content).join('\n');
  assert.match(text, /RETURN_NEW_MATRIX/,
    'the file the model read must survive while there is budget for it - losing it is what made de950b2d delete real lines');
});

test('the TOKEN budget still binds when it is the real constraint', () => {
  const run = makeRun(40, 4000);                         // 40 x 4000 chars = 40,000 est-tokens
  pruneHistory(run, 3000);
  assert.ok(estimateTokens(run.history) <= 3000 * 1.35,
    'a small budget must still prune: got ' + estimateTokens(run.history) + ' est-tokens against 3000');
});

test('the anchors survive either way - goal and plan are never dropped', () => {
  const run = makeRun(40);
  pruneHistory(run, 20000);
  const text = run.history.map((m) => m.content).join('\n');
  assert.match(text, /GOAL: build s3_matrix\.js/, 'the goal anchor must survive');
  assert.match(text, /BUILD PLAN:/, 'the plan anchor must survive');
});

test('the newest message is always the last one the model sees', () => {
  const run = makeRun(40);
  pruneHistory(run, 20000);
  assert.match(String(run.history[run.history.length - 1].content), /^m39 /,
    'the most recent step must remain last');
});

test('a history already inside both limits is left completely alone', () => {
  const run = makeRun(5);
  const before = JSON.stringify(run.history);
  pruneHistory(run, 20000);
  assert.equal(JSON.stringify(run.history), before, 'nothing to prune means no rewrite');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
