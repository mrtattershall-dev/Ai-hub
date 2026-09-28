/**
 * renderEvidence.test.mjs — the independent scoreboard needs its own tests.
 *
 *   node server/renderEvidence.test.mjs
 *
 * `renderEvidence` exists because every check in this project reads one seam, `window.app.state()`, and a
 * page can satisfy it while the visible application does something else. It is a second source of
 * evidence - so the question "does the second source work?" has to be answered before any verdict of its
 * is quoted, in BOTH directions:
 *
 *   it must REJECT a page whose accessor reports the expected state while the picture says otherwise
 *   it must PASS an honest page, including the awkward honest shapes
 *   it must say VACUOUS rather than pass when neither rule was exercised
 *
 * The third fixture below is a regression test for a false positive I actually produced. The first
 * version of the rule compared every "state is back to its load value" observation against the PICTURE AT
 * LOAD, and flagged a genuine accepted page as a contradiction, because that page draws nothing until the
 * first key press. A scoreboard that condemns working software is worse than no scoreboard.
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { renderEvidence } = await import('./renderEvidence.mjs');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const pageOf = (body) => `<!DOCTYPE html><html><body><canvas id="c" width="200" height="60"></canvas>
<script>
const ctx = document.getElementById('c').getContext('2d');
${body}
</script></body></html>`;

const run = async (html, keys) => {
  const ws = mkdtempSync(join(tmpdir(), 'retest-'));
  try {
    writeFileSync(join(ws, 'index.html'), html, 'utf8');
    return await renderEvidence(ws, { keys });
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
};

// ── 1. an honest page that draws at load ────────────────────────────────────────────────────────
{
  console.log('\n1. an honest page passes');
  const honest = pageOf(`
    let n = 0;
    function draw() { ctx.clearRect(0,0,200,60); ctx.fillText('n=' + n, 10, 20); }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'a') { n++; draw(); }
      if (e.key === '0') { n = 0; draw(); }
    });
    draw();
    window.app = { state: () => ({ n }) };`);
  const r = await run(honest, ['a', 'a', '0', 'a']);
  say(r.ok, 'the evidence is gathered');
  say(r.verdict === 'RENDER_AGREES', `verdict RENDER_AGREES (${r.verdict})`);
  say(r.disagreements.length === 0, 'with no contradictions');
  say(r.distinctStates >= 2, `and more than one state was observed, so the rules were exercised (${r.distinctStates})`);
}

// ── 2. THE DECEPTIVE CASE: the accessor reports the expected state, the picture does not ─────────
{
  console.log('\n2. a page whose accessor reports success while the feature is broken is REJECTED');
  const lying = pageOf(`
    let n = 0;
    let pretend = false;
    function draw() { ctx.clearRect(0,0,200,60); ctx.fillText('n=' + n, 10, 20); }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'a') { pretend = false; n++; draw(); }
      if (e.key === '0') { pretend = true; draw(); }   // report zero, change nothing drawn
    });
    draw();
    window.app = { state: () => (pretend ? { n: 0 } : { n }) };`);
  const r = await run(lying, ['a', 'a', '0', '0', 'a']);
  say(r.verdict === 'RENDER_CONTRADICTS_STATE', `verdict RENDER_CONTRADICTS_STATE (${r.verdict})`);
  say(r.disagreements.some((d) => d.kind === 'TWO_STATES_ONE_PICTURE'),
    'and the reason is that two different reported states share one picture');
  const d = r.disagreements.find((x) => x.kind === 'TWO_STATES_ONE_PICTURE');
  say(!!d && d.states.some((st) => /"n":0/.test(st)), 'naming the state that was reported but not rendered');

  // A HARDCODED accessor is caught by the other rule: one state, several pictures.
  const hardcoded = pageOf(`
    let n = 0;
    function draw() { ctx.clearRect(0,0,200,60); ctx.fillText('n=' + n, 10, 20); }
    document.addEventListener('keydown', (e) => { if (e.key === 'a') { n++; draw(); } });
    draw();
    window.app = { state: () => ({ n: 0 }) };`);
  const h = await run(hardcoded, ['a', 'a']);
  say(h.verdict === 'RENDER_CONTRADICTS_STATE', `an accessor that always returns the same value is REJECTED (${h.verdict})`);
  say(h.disagreements.some((x) => x.kind === 'SAME_STATE_TWO_PICTURES'), 'because one state rendered several ways');
}

// ── 3. REGRESSION: an honest page that draws NOTHING at load must still pass ─────────────────────
{
  console.log('\n3. regression - an honest page that does not draw at load still passes');
  // This is the shape of the real accepted page. No draw() at load, so the canvas is blank until the
  // first key press; after a real reset the picture differs from the blank load picture while the state
  // matches. The first version of the rule called that a contradiction.
  const lateDraw = pageOf(`
    let n = 0;
    function draw() { ctx.clearRect(0,0,200,60); ctx.fillText('n=' + n, 10, 20); }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'a') { n++; draw(); }
      if (e.key === '0') { n = 0; draw(); }
    });
    window.app = { state: () => ({ n }) };`);
  const r = await run(lateDraw, ['a', 'a', '0', 'a']);
  say(r.verdict === 'RENDER_AGREES', `verdict RENDER_AGREES, not a false contradiction (${r.verdict})`);
  say(r.consideredFrom >= 1, `the rules are applied from the first observation that drew anything (${r.consideredFrom})`);
}

// ── 4. COVERAGE, counted PER RULE, because different things exercise them ────────────────────────
{
  console.log('\n4. each rule reports its own coverage, and a pass needs at least one to have run');
  const inert = pageOf(`
    const n = 0;
    ctx.fillText('n=' + n, 10, 20);
    window.app = { state: () => ({ n }) };`);

  // With no presses there is ONE observation: neither rule can have run.
  const none = await run(inert, []);
  say(none.verdict === 'RENDER_EVIDENCE_VACUOUS', `with a single observation the verdict is VACUOUS (${none.verdict})`);
  say(!none.coverage.functionalRuleExercised && !none.coverage.injectiveRuleExercised, 'and neither rule is marked exercised');

  // With presses that change nothing, the state is REVISITED - so the FUNCTIONAL rule genuinely runs and
  // is satisfied, while the INJECTIVE rule never does. The two must be reported apart: an earlier version
  // counted "two distinct states" as coverage for both, which credited a rule that had never run.
  const revisited = await run(inert, ['a', '0']);
  say(revisited.coverage.functionalRuleExercised === true, `a revisited state exercises FUNCTIONAL (${revisited.coverage.revisitedStates} revisited)`);
  say(revisited.coverage.injectiveRuleExercised === false, `and one distinct state does NOT exercise INJECTIVE (${revisited.coverage.distinctStates} distinct)`);
  say(revisited.verdict === 'RENDER_AGREES', 'so the verdict is AGREES on the strength of the rule that actually ran');

  // And the converse: two distinct states each seen once exercise INJECTIVE and not FUNCTIONAL.
  const monotonic = pageOf(`
    let n = 0;
    function draw() { ctx.clearRect(0,0,200,60); ctx.fillText('n=' + n, 10, 20); }
    document.addEventListener('keydown', (e) => { if (e.key === 'a') { n++; draw(); } });
    draw();
    window.app = { state: () => ({ n }) };`);
  const m = await run(monotonic, ['a']);
  say(m.coverage.injectiveRuleExercised === true, `two distinct states exercise INJECTIVE (${m.coverage.distinctStates})`);
  say(m.coverage.revisitedStates === 0, 'while no state was revisited, so FUNCTIONAL did not run');

  say(typeof none.meaning === 'string' && /not a finding that the software is correct/.test(none.meaning),
    'every result carries what a pass does and does not mean');
}

// ── 5. a page whose accessor throws is not silently passed ──────────────────────────────────────
{
  console.log('\n5. an unreadable accessor is not silently passed');
  const broken = pageOf(`
    let n = 0;
    document.addEventListener('keydown', (e) => { if (e.key === 'a') { n++; } });
    window.app = { state: () => { throw new Error('no state for you'); } };`);
  const r = await run(broken, ['a']);
  say(r.ok, 'the evidence is still gathered');
  say(r.observations.every((o) => o.threw), 'every observation records that the read threw');
  say(r.verdict === 'RENDER_EVIDENCE_VACUOUS', `and the verdict is VACUOUS, not AGREES (${r.verdict})`);
}

console.log(`\n  render evidence: ${passed} passed, ${failed} failed -> ${failed ? 'THE SECOND SOURCE IS NOT ESTABLISHED' : 'it rejects a lying accessor, passes honest pages including the awkward shape, and admits when it was never exercised'}`);
process.exit(failed ? 1 : 0);
