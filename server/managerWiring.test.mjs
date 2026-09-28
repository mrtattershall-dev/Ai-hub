/**
 * managerWiring.test.mjs — does ONE COMPLETE MANAGER INVOCATION use the planner's proposal, and does the
 * returned edit reach the final retain decision?
 *
 *   node server/managerWiring.test.mjs
 *
 * This runs `managerRun.mjs` AS A CHILD PROCESS against a SCRIPTED BACKEND that speaks the model API. So
 * the real runner does the real work - observe, plan, build the prompt, call the model, contain, judge,
 * decide - and the only thing replaced is the model's answer, which makes the test deterministic and
 * free.
 *
 * What it establishes, none of which a unit test can:
 *   the request that ACTUALLY reached the model carries the planner's proposed site and guidance
 *   a correct edit travels all the way to RETENTION
 *   an inert-but-plausible edit does NOT survive
 *
 * `acceptanceDecision` once had 30 passing assertions while nothing consumed it. This is the test that
 * would have caught that.
 */
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const NL = String.fromCharCode(10);
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const ITEMS = ['apple', 'apricot', 'banana', 'cherry', 'date'];
const BASE = `<!DOCTYPE html><html><body>
<h1>Fruit</h1>
<input type="text" id="filter" placeholder="filter">
<ul id="list">${ITEMS.map((x) => `<li class="item">${x}</li>`).join('')}</ul>
<script>
const input = document.getElementById('filter');
const items = Array.from(document.querySelectorAll('#list .item'));
function applyFilter() {
  const q = input.value.toLowerCase();
  items.forEach((li) => { li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none'; });
}
input.addEventListener('input', applyFilter);
</script></body></html>`;

const GOOD = `
const clearBtn = document.createElement('button');
clearBtn.id = 'clear-filter';
clearBtn.textContent = 'Clear';
document.body.appendChild(clearBtn);
clearBtn.addEventListener('click', () => { input.value = ''; applyFilter(); });`;

const INERT = `
const clearBtn = document.createElement('button');
clearBtn.id = 'clear-filter';
clearBtn.textContent = 'Clear';
document.body.appendChild(clearBtn);
clearBtn.addEventListener('click', () => { const intended = ''; });`;

// Creates the control, wires it, and empties the field - but never tells the page to re-render, so the
// list stays filtered. It FAILS its task. It also demonstrably got the control-and-wiring part right.
const PARTIAL = `
const clearBtn = document.createElement('button');
clearBtn.id = 'clear-filter';
clearBtn.textContent = 'Clear';
document.body.appendChild(clearBtn);
clearBtn.addEventListener('click', () => { input.value = ''; });`;

/** A scripted backend speaking the model API. It RECORDS every request it is asked to complete. */
function scriptedBackend(completion) {
  const seen = [];
  return new Promise((done) => {
    const srv = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        let j = {};
        try { j = JSON.parse(body); } catch { /* ignore */ }
        seen.push(j);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ response: completion, done: true, done_reason: 'stop', eval_count: 40, prompt_eval_count: 300 }));
      });
    });
    srv.listen(0, '127.0.0.1', () => done({ srv, port: srv.address().port, seen }));
  });
}

async function invoke(completion) {
  const dir = mkdtempSync(join(tmpdir(), 'wire-'));
  const { srv, port, seen } = await scriptedBackend(completion);
  try {
    writeFileSync(join(dir, 'baseline-as-delivered.html'), BASE, 'utf8');
    // THE EMITTER WRITES THE TASK. Nothing in this file hands the runner a requirement: the emitter
    // observes the delivered page, establishes the governed item set, and states the clear-filter
    // requirement with its two effects as two separate expectations.
    const em = await exec(process.execPath, ['server/emitTaskAuto.mjs', '--dir', dir],
      { cwd: process.cwd(), windowsHide: true, maxBuffer: 20e6 }).catch((e) => ({ stdout: e.stdout || '', stderr: e.stderr || '' }));
    const emitted = existsSync(join(dir, 'task.json')) ? JSON.parse(readFileSync(join(dir, 'task.json'), 'utf8')) : null;
    const outFile = join(dir, 'run.json');
    if (!emitted) return { run: null, seen, emitted: null, emitLog: String(em.stdout || '') + String(em.stderr || '') };
    const r = await exec(process.execPath, [
      'server/managerRun.mjs', '--dir', dir, '--out', outFile,
      '--model-url', `http://127.0.0.1:${port}`, '--seeds', '1', '--max-rounds', '1',
    ], { cwd: process.cwd(), windowsHide: true, maxBuffer: 20e6 }).catch((e) => ({ stdout: e.stdout || '', stderr: e.stderr || '' }));
    const run = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : null;
    // Read the corpus back off disk BEFORE the directory is removed: "the record says it wrote a file"
    // is not the same claim as "the file is there with the candidate in it".
    const cdir = run && run.totals && run.totals.corpus;
    const corpus = cdir && existsSync(cdir)
      ? readdirSync(cdir).map((f) => ({ f, chars: readFileSync(join(cdir, f), 'utf8').length }))
      : [];
    return { run, seen, emitted, corpus, emitLog: String(em.stdout || ''), stdout: r.stdout || '' };
  } finally {
    try { srv.close(); } catch { /* best effort */ }
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

// ══ 0. the EMITTER states the requirement ══════════════════════════════════════════════════════
console.log('\n0. the emitter states the clear-filter requirement, with independent expectations');
const good = await invoke(GOOD);
const em = good.emitted;
say(!!em, 'the emitter wrote a task from the delivered page alone');
if (!em) { console.log(String(good.emitLog).split(NL).map((l) => '    ' + l).join(NL)); process.exit(1); }
say(em && em.observation.additionRule === 'FILTER', `it took the FILTER rule (${em && em.observation.additionRule})`);
say(em && em.requirement.trigger.kind === 'click' && em.requirement.trigger.selector === '#clear-filter',
  `the requirement is click #clear-filter (${em && JSON.stringify(em.requirement.trigger)})`);
say(em && em.requirement.effects.length === 2, 'it names TWO effects, not one compound one');
const addSteps = (em.provenance.additionSteps || []).map((n) => em.diagnostic.spec.steps.find((s) => s.n === n));
// The two EFFECTS get two expectations. The repeated-clear check deliberately restates the first one,
// because "it works the second time" is the same obligation asked again, not a different one.
const addExpects = new Set(addSteps.map((s) => s.expect));
say(addSteps.length === 3 && addExpects.size === 2,
  `its ${addSteps.length} addition checks carry ${addExpects.size} distinct expectations - one per effect, the third a repeat of the restore obligation`);
say(addSteps.some((s) => /inputValues/.test(s.expect)) && addSteps.some((s) => /dom\.visible\.filter/.test(s.expect)),
  'one reads the input value, another reads the list - a control that does half the job fails half the checks');
say(em.diagnostic.spec.steps.every((s) => !/dom\.visible\) ===/.test(s.expect)),
  'every list check is SCOPED to the governed items, so the new control is not itself a regression');
say(Array.isArray(em.provenance.governedItems) && em.provenance.governedItems.length === ITEMS.length,
  `the governed set was established on the delivered page: ${em.provenance.governedItems.length} items via ${JSON.stringify(em.provenance.nonMatchingTerm)}`);

// ══ 1. the request that reached the model carries the planner's proposal ════════════════════════
console.log('\n1. one complete manager invocation, and what ACTUALLY reached the model');
say(!!good.run, 'the run completed and wrote its record');
say(good.seen.length >= 1, `the scripted backend received ${good.seen.length} model request(s)`);

const round = good.run.rounds[0];
say(round.proposal && round.proposal.move === 'CREATE_A_CONTROL_AND_WIRE_IT',
  `the runner used the PLANNER's move (${round.proposal && round.proposal.move})`);
say(!/R1|R2/.test(String(round.rule)), `and not autoGuide's keyboard rules (rule recorded as ${round.rule})`);

const sentPrompt = String(good.seen[0].prompt || '');
const sentSuffix = String(good.seen[0].suffix || '');
say(sentPrompt.length > 0 && sentSuffix.length > 0, 'the request carries a prefix and a suffix - the real infill interface');
say(sentPrompt.includes('// FILL IN') === false, 'the FILL IN marker is cut out to form the slot, not sent verbatim');
say(/create #clear-filter/.test(sentPrompt), 'the prompt carries the PROPOSAL\'s scope - create #clear-filter and wire it');
say(/applyFilter/.test(sentPrompt), 'and names the page function the change must go through');
say(/on this key|clear-filter/.test(sentPrompt), 'the instruction from the requirement is present');
// The slot must be at the planner's site: the prefix ends inside the script, after the existing handler.
say(/input\.addEventListener\('input', applyFilter\);/.test(sentPrompt),
  'the prefix reaches the END of the existing script - the site the planner proposed');
say(sentSuffix.includes('</script>'), 'and the suffix resumes at the script close');
say(good.run.observation && good.run.observation.selectedAdapters.join() === 'browser.input',
  `the runner observed the page itself first (${good.run.observation && good.run.observation.selectedAdapters.join()})`);

// ══ 2. the returned edit reaches the final retain decision ══════════════════════════════════════
console.log('\n2. the returned edit travels all the way to retention');
const att = good.run.attempts[0];
say(!!att, 'an attempt was recorded');
say(att.outcome === 'ACCEPTED', `its outcome is ACCEPTED (${att && att.outcome})`);
say(att.decision && att.decision.accepted === true, 'the acceptance DECISION accepted it');
say(good.run.accepted === true, 'and the run reports the addition accepted');
const NSTEPS = em.diagnostic.spec.steps.length;
say((att.play.passing || []).length === NSTEPS, `all ${NSTEPS} checks passed (${(att.play.passing || []).length})`);
say(att.acceptance.survivingWorkspaceVerdict.protected === 'PASS', 'the carried-forward checks passed despite a new visible button');

// ══ 3. an inert-but-plausible edit does not survive ═════════════════════════════════════════════
console.log('\n3. an inert but plausible button does NOT survive the same path');
const inert = await invoke(INERT);
const iatt = inert.run.attempts[0];
say(!!iatt, 'an attempt was recorded');
say(iatt.outcome !== 'ACCEPTED', `its outcome is NOT accepted (${iatt && iatt.outcome})`);
say(inert.run.accepted === false, 'the run reports no accepted addition');
say(iatt.decision && iatt.decision.accepted === false, 'the acceptance decision refused it');
const CARRIED = em.provenance.carriedSteps;
const ADDED = em.provenance.additionSteps;
say(CARRIED.every((n) => (iatt.play.passing || []).includes(n)),
  `even though every carried-forward check passed (${CARRIED.join(',')}) - the page still filters`);
say(ADDED.every((n) => !(iatt.play.passing || []).includes(n)),
  `every addition check failed (${ADDED.join(',')}) - the button is there and does nothing`);
say(inert.seen.length >= 1, 'and it reached the model through the same scripted backend');

// ══ 4. a failed attempt that shows a mechanism working is KEPT, not authorized ══════════════════
console.log('\n4. an attempt can fail its task and still be worth keeping');
const part = await invoke(PARTIAL);
const patt = part.run.attempts[0];
say(patt.outcome !== 'ACCEPTED' && part.run.accepted === false, `it is NOT retained (${patt && patt.outcome}) - the task verdict is unchanged`);
say(patt.classification && patt.classification.mismatch === 'PARTIAL_EFFECT',
  `and it is recorded as ${patt.classification && patt.classification.mismatch}: ${patt.classification && patt.classification.why}`);
say((patt.classification.addition.passed || []).length > 0 && (patt.classification.addition.failed || []).length > 0,
  `some of what the requirement asked for worked (${patt.classification.addition.passed.join(',')}) and some did not (${patt.classification.addition.failed.join(',')})`);
say((patt.classification.carriedForward.broken || []).length === 0, 'nothing that already worked was broken, so this is a partial effect and not a regression');
say(typeof patt.preserved === 'string', `the full candidate survives the run as ${patt.preserved}.html - not just its hash`);
say(inert.run.attempts[0].classification.mismatch === 'NOTHING_WORKED',
  `and the inert button is recorded differently (${inert.run.attempts[0].classification.mismatch}) - a button that does nothing is not a partial success`);
say(good.run.attempts[0].classification.mismatch === 'MET', `the accepted one is recorded as ${good.run.attempts[0].classification.mismatch}`);
say(part.run.totals.partialEffects === 1 && part.run.totals.corpus, 'the run reports how many attempts showed a partial effect, and where they were kept');

console.log(`\n  manager wiring: ${passed} passed, ${failed} failed -> ${failed ? 'THE PLANNING-TO-EXECUTION CONNECTION IS NOT ESTABLISHED' : 'the live runner plans the site, sends it to the model, and the returned edit reaches a retain decision that refuses an inert one'}`);
process.exit(failed ? 1 : 0);
