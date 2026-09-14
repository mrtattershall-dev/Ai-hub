// CONTROL FOR THE v2 INSTRUMENT. The html check replaced a branch that returned ok:true
// unconditionally, so it must be shown to FAIL something and PASS something before it scores a run.
// Subject 1 is the REAL artifact v1 credited a full-chain pass (it loads s9_board.js, which does
// not exist). If the new check passes it, the fix is cosmetic.
//
// It imports the SHIPPING module rather than a copy - an earlier version of this file duplicated
// the logic, which is how a checker and its test can drift apart and both look green.
import { htmlCheck, goalTokens } from './_htmlcheck.mjs';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const V1 = 'C:/Users/tatte/AppData/Local/Temp/spec-keFqQA';
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const GOAL9 = GOALS[8];

const ws = mkdtempSync(join(tmpdir(), 'spec2ctl-'));
let pass = 0;
let fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '   ' + (detail || '')); }
};

const tok = goalTokens(GOAL9);
console.log('  goal 9 ids ' + JSON.stringify(tok.ids) + '  classes ' + JSON.stringify(tok.classes) + '\n');

const real = join(V1, 's9_board.html');
const haveReal = existsSync(real);

// 1. THE REAL v1 ARTIFACT - v1 scored this L and C. It must now fail on the dead script ref.
if (haveReal) {
  writeFileSync(join(ws, 'subject_real.html'), readFileSync(real, 'utf8'), 'utf8');
  const r = htmlCheck(ws, 'subject_real.html', GOAL9);
  check('v1 artifact is REJECTED (v1 credited it a full-chain pass)', r.ok === false, 'got ok=true');
  console.log('       reason: ' + r.msg);
} else {
  check('v1 artifact present to re-score', false, 'file missing: ' + real);
}

// 2. SAME FILE, dead ref resolved. Isolates the ref rule from every other rule.
if (haveReal) {
  writeFileSync(join(ws, 'subject_fixed.html'), readFileSync(real, 'utf8'), 'utf8');
  writeFileSync(join(ws, 's9_board.js'), 'document.body.dataset.k="s9-card";', 'utf8');
  const r = htmlCheck(ws, 'subject_fixed.html', GOAL9);
  console.log('       with the script present: ok=' + r.ok + (r.msg ? '  ' + r.msg : ''));
  check('resolving the dead ref changes the verdict on that rule', !/dead refs \["s9_board\.js"\]/.test(r.msg || ''), r.msg);
  rmSync(join(ws, 's9_board.js'), { force: true });
}

// 3. NEGATIVE CONTROL - missing ids alone, no refs involved.
writeFileSync(join(ws, 'noid.html'), '<!doctype html><html><body><ul id="s9-todo"></ul></body></html>', 'utf8');
const noid = htmlCheck(ws, 'noid.html', GOAL9);
check('missing ids alone are caught (no refs involved)', noid.ok === false, 'got ok=true');
console.log('       reason: ' + noid.msg);

// 4. POSITIVE CONTROL - a hand-written page that genuinely satisfies the goal must PASS.
//    This is the case that caught the first version of the checker.
const good = '<!doctype html><html><body>'
  + '<div id="s9-todo"><ul></ul></div><div id="s9-doing"><ul></ul></div><div id="s9-done"><ul></ul></div>'
  + '<input id="s9-new"><button id="s9-add">Add</button>'
  + '<scr' + 'ipt>document.getElementById("s9-add").addEventListener("click",function(){'
  + 'var li=document.createElement("li");li.className="s9-card";'
  + 'li.textContent=document.getElementById("s9-new").value;'
  + 'document.querySelector("#s9-todo ul").appendChild(li);});</scr' + 'ipt>'
  + '</body></html>';
writeFileSync(join(ws, 'good.html'), good, 'utf8');
const g = htmlCheck(ws, 'good.html', GOAL9);
check('hand-written correct page PASSES', g.ok === true, g.msg);

// 5. The class rule must not be free either - drop the class and it must fail.
writeFileSync(join(ws, 'noclass.html'), good.replace(/s9-card/g, 'other'), 'utf8');
const nc = htmlCheck(ws, 'noclass.html', GOAL9);
check('removing the required class FAILS (class rule is live)', nc.ok === false, 'got ok=true');

// 6. The ref rule must not be free either - add a dead ref to the good page.
writeFileSync(join(ws, 'deadref.html'), good.replace('<body>', '<body><scr' + 'ipt src="nope.js"></scr' + 'ipt>'), 'utf8');
const dr = htmlCheck(ws, 'deadref.html', GOAL9);
check('adding a dead ref to a good page FAILS (ref rule is live)', dr.ok === false, 'got ok=true');

// 7. A class token must not be mistaken for an id (the original defect, pinned).
check('s9-card is classified as a class, not an id',
  tok.classes.includes('s9-card') && !tok.ids.includes('s9-card'),
  'ids=' + JSON.stringify(tok.ids));

console.log('\n  ' + pass + ' passed, ' + fail + ' failed   ws=' + ws);
process.exit(fail ? 1 : 0);
