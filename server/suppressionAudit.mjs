#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// suppressionAudit.mjs — SUPPRESSION-1's post-run sanity check, BEFORE interpretation.
//
//   node server/suppressionAudit.mjs --pages legasus/bench/suppression1 --runs .../runs
//
// A 1.5B scoring 9 of 9 on a family where it previously scored 0 of 4 is exactly the result to
// distrust first. Two ways it could be hollow, and both are checked mechanically:
//
//   THE PROMPT CONTAINED THE ANSWER    if the chat prompt carries an implementation, or text derived
//                                      from the evaluator, the arm is reading the solution rather than
//                                      producing it
//   THE CANDIDATE DID NOT DO THE WORK  if an accepted page does not differ from its own baseline in the
//                                      way the requirement asked, the gate is what is wrong
//
// This changes no run and rewrites nothing. It reads what is on disk and reports.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const PAGES = opt('pages', 'legasus/bench/suppression1');
const RUNS = opt('runs', join(PAGES, 'runs'));
const NL = String.fromCharCode(10);
const sha = (t) => createHash('sha256').update(t).digest('hex').slice(0, 16);

let problems = 0;
let audited = 0;
const note = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'BAD '} ${m}`); if (!ok) problems++; };

const pages = readdirSync(PAGES).filter((d) => /^s\d+$/.test(d) && existsSync(join(PAGES, d, 'task.json'))).sort();
console.log(`pages ${pages.length}   runs dir ${RUNS}${NL}`);

// ══ 1. THE PROMPT MUST NOT CARRY THE ANSWER ═════════════════════════════════════════════════════
console.log('1. does any prompt contain an implementation, or evaluator-derived text?');
for (const p of pages) {
  const task = JSON.parse(readFileSync(join(PAGES, p, 'task.json'), 'utf8'));
  const spec = task.diagnostic.spec;
  const control = (task.requirement.trigger || {}).selector || '';
  const id = control.replace(/^#/, '');

  // 'manager' WAS MISSING HERE while the acceptance loop below covers all four, so a manager run's
  // prompt was never leak-checked at all. Coverage gaps do not announce themselves: this one read
  // as a clean pass because the arm was simply never visited.
  for (const arm of ['chat', 'operator', 'contract', 'manager']) {
    const f = join(RUNS, `${p}-${arm}.json`);
    if (!existsSync(f)) continue;
    const run = JSON.parse(readFileSync(f, 'utf8'));
    const a = run.attempts[0];
    if (!a || !a.preserved) continue;
    const corpus = join(RUNS, `${p}-${arm}.attempts`, `${a.preserved}.json`);
    if (!existsSync(corpus)) continue;
    const prompt = String((JSON.parse(readFileSync(corpus, 'utf8')).request || {}).prompt || '');

    // The requirement legitimately NAMES the control - that is the request. What must not appear is a
    // WIRED implementation of it, which would be the answer rather than the ask.
    //
    // THE FIRST VERSION OF THIS CHECK WAS A PROXIMITY TEST - the id within 200 characters of
    // `addEventListener` - and it reported 36 leaks that were all the same false positive: the page's
    // OWN listener on the filter field sits about a hundred characters before the requirement line
    // that names the control. Nearness is not binding. What matters is whether a handler is attached
    // TO the control, so the test is now same-statement: the id, then only quotes, brackets and
    // whitespace, then the binding.
    const bindAfter = new RegExp(`${id}['\"]?\\s*\\)?\\s*\\.\\s*(addEventListener|onclick|onClick)`);
    const sameLine = prompt.split(NL).some((l) => l.includes(id) && /addEventListener|onclick/i.test(l));
    const wired = bindAfter.test(prompt) || sameLine;
    note(!wired, `${p}/${arm}: no handler wired to ${control} appears in the prompt`);

    // Nothing from the evaluator. An `expect` expression, or the governed item list the checks compare
    // against, would be the oracle leaking into the question.
    const leaked = spec.steps.filter((s) => s.expect && s.expect.length > 12 && prompt.includes(s.expect));
    note(leaked.length === 0, `${p}/${arm}: no evaluator expectation text in the prompt${leaked.length ? ` (LEAKED ${leaked.length})` : ''}`);
    const items = (task.provenance.governedItems || []);
    const itemsJson = JSON.stringify(items);
    note(!prompt.includes(itemsJson), `${p}/${arm}: the checks' governed-item array does not appear verbatim`);
  }
}

// ══ 2. EVERY ACCEPTED CANDIDATE MUST DIFFER FROM ITS OWN BASELINE IN THE REQUESTED WAY ═══════════
console.log(`${NL}2. does each accepted candidate actually do the requested work?`);
let accepted = 0;
for (const p of pages) {
  const task = JSON.parse(readFileSync(join(PAGES, p, 'task.json'), 'utf8'));
  const baseline = readFileSync(join(PAGES, p, 'baseline-as-delivered.html'), 'utf8');
  const control = (task.requirement.trigger || {}).selector || '';
  const id = control.replace(/^#/, '');
  const addition = task.provenance.additionSteps || [];

  for (const arm of ['chat', 'operator', 'contract', 'manager']) {
    const f = join(RUNS, `${p}-${arm}.json`);
    if (!existsSync(f)) continue;
    const run = JSON.parse(readFileSync(f, 'utf8'));
    audited++;
    if (!run.accepted) continue;
    accepted++;
    const a = run.attempts.find((x) => x.outcome === 'ACCEPTED');
    const cand = (a.transformedCandidate || {}).text || '';

    note(!baseline.includes(id), `${p}/${arm}: the BASELINE did not contain ${control} - the work was absent before`);
    note(cand.includes(id), `${p}/${arm}: the candidate contains ${control}`);
    note(/addEventListener|onclick/.test(cand), `${p}/${arm}: and wires a handler`);
    note(sha(cand) !== sha(baseline), `${p}/${arm}: candidate differs from baseline (${sha(baseline)} -> ${sha(cand)})`);
    note(addition.every((n) => (a.play.passing || []).includes(n)),
      `${p}/${arm}: every addition check passed (${addition.join(',')})`);
    note((a.acceptance || {}).survivingWorkspaceVerdict.protected === 'PASS',
      `${p}/${arm}: and the carried-forward set still passes`);
  }
}

// ══ 3. THE 12 ELIGIBILITY RECORDS ═══════════════════════════════════════════════════════════════
console.log(`${NL}3. eligibility: was the addition genuinely absent on every baseline?`);
for (const p of pages) {
  const task = JSON.parse(readFileSync(join(PAGES, p, 'task.json'), 'utf8'));
  const v = task.validation || {};
  note(Array.isArray(v.checked) && v.checked.length === 2, `${p}: the emitter recorded both necessary conditions`);
  note(Array.isArray(task.provenance.additionSteps) && task.provenance.additionSteps.length > 0, `${p}: addition steps declared (${(task.provenance.additionSteps || []).join(',')})`);
}

// READING NOTHING IS NOT PASSING. Every increment to `problems` sits inside an existsSync-guarded
// loop, so a wrong --runs path or a moved corpus produced zero iterations and printed
// 'NO PROBLEMS FOUND - the result survives this check' with exit 0, over no data at all. The count
// was printed beside it, but the VERDICT did not depend on it and neither did the exit code.
if (audited === 0) {
  console.log(`${NL}NOTHING WAS AUDITED - no run records were found under ${RUNS}. This is NOT a pass;`);
  console.log('the checks below never ran. Check the --runs path before reading anything into this.');
  process.exit(2);
}
console.log(`${NL}${audited} run record(s) read, ${accepted} accepted candidate(s) audited. ${problems === 0 ? 'NO PROBLEMS FOUND - the result survives this check' : `${problems} PROBLEM(S) FOUND - do not interpret until resolved`}`);
process.exit(problems ? 1 : 0);
