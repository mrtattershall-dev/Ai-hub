// INFORMATION AUDIT: was the disambiguating evidence IN the prompt?
//
// Condition A shows a repeated wrong topology across 1.5B and 7B:
//     to_html("a\nb") -> '<p>a</p>\n<p>b</p>'   instead of   '<p>a b</p>'
// Either the evidence distinguishing those is missing from the prompt - an information mismatch, i.e.
// another apparatus defect - or it is present and unused, which is a statement about the model.
//
// MY FIRST VERSION OF THIS AUDIT WAS VACUOUS AND IS REPLACED. It rebuilt each candidate file and ran
// python against the visible asserts, but when the rebuilt module failed to import, no comparison ran
// and the violation counter stayed at zero. It reported "0 of 160 visible assertions violated" for
// trajectories whose regression demonstrably failed - a checker branch that cannot fail, the same
// defect class as the `[].every()` one. The reconstruction was also unnecessary.
//
// This version asks only what it needs to ask, from data that already exists:
//   VISIBLE   does the trajectory's own prompt contain the assertion, verbatim?
//   VIOLATED  did the run record that behaviour failing? (the recorded message names the expectation)
// No reconstruction, no second interpreter, nothing that can silently skip.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RUNS = process.argv.slice(2).map((s) => { const [label, dir] = s.split('='); return { label, dir }; });

// The behaviour both model sizes converge on getting wrong.
const PROBE = {
  name: 'paragraph line-joining (goal 4, oldest behaviour in the file)',
  assertion: 'assert to_html("a\\nb") == "<p>a b</p>"',
  wantedMarker: "wanted '<p>a b</p>'",
};

console.log('  INFORMATION AUDIT - was the disambiguating evidence in the prompt?');
console.log('  looking for, verbatim:  ' + PROBE.assertion + '\n');

const summary = [];
for (const { label, dir } of RUNS) {
  let rows;
  try { rows = JSON.parse(readFileSync(join(dir, 'rows.json'), 'utf8')); } catch (e) { console.log('  skip ' + dir); continue; }
  const A = rows.filter((r) => r.condition === 'A_instruction_only');
  if (!A.length) continue;
  console.log('===== ' + label + ' =====');
  let visible = 0; let violated = 0; let both = 0; let unevaluable = 0;

  for (const r of A) {
    const step = r.steps && r.steps[0];
    if (!step || !step.wire_id) continue;
    let req;
    try { req = JSON.parse(readFileSync(join(dir, 'wire', step.wire_id + '.request.json'), 'utf8')); } catch (e) { continue; }
    const promptAll = String(req.prompt || '') + String(req.suffix || '');
    const isVisible = promptAll.includes(PROBE.assertion);

    // Three distinguishable outcomes, so a load failure can never be silently scored as "no violation".
    let state;
    if (r.final_loads === false) state = 'did-not-load';
    else if (r.final_old_regression === false) {
      state = String(r.final_old_regression_why || '').includes(PROBE.wantedMarker) ? 'VIOLATED-this' : 'broke-something-else';
    } else state = 'preserved';

    if (isVisible) visible++;
    if (state === 'VIOLATED-this') violated++;
    if (state === 'did-not-load') unevaluable++;
    if (isVisible && state === 'VIOLATED-this') both++;

    console.log('  g' + r.goal + ' s' + String(r.seed).padEnd(3)
      + '  assertion visible in its own prompt: ' + (isVisible ? 'YES' : 'no ')
      + '   outcome: ' + state);
  }
  console.log('  ---- visible ' + visible + '/' + A.length
    + '   violated-this ' + violated + '/' + A.length
    + '   VISIBLE AND VIOLATED ' + both + '/' + A.length
    + '   unevaluable (did not load) ' + unevaluable);
  summary.push({ label, n: A.length, visible, violated, both, unevaluable });
  console.log('');
}

console.log('===== VERDICT =====');
for (const s of summary) {
  console.log('  ' + s.label.padEnd(22) + 'visible ' + s.visible + '/' + s.n
    + '   visible AND violated ' + s.both + '/' + s.n
    + '   unevaluable ' + s.unevaluable);
}
const anyBoth = summary.some((s) => s.both > 0);
const allVisible = summary.every((s) => s.visible === s.n);
console.log('');
if (allVisible && anyBoth) {
  console.log('  The assertion is present, verbatim, in every prompt, and is contradicted by the output.');
  console.log('  This is NOT an information mismatch: the evidence distinguishing the reference from the');
  console.log('  wrong topology was printed in the model\'s own context and was not used.');
} else if (!allVisible) {
  console.log('  The assertion is MISSING from some prompts - that is an information mismatch and an');
  console.log('  apparatus defect, not a model result.');
} else {
  console.log('  Visible everywhere but not violated in the audited runs - nothing to attribute.');
}
