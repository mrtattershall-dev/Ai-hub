// V1..V8 — the comparison, per VALUE-COMPARISON_PREREG.md.
//
// Every step is a separate OS process, so "restart" is real and only bytes on disk survive.
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';

const STEP = new URL('./value-step.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const FILE = 'value-subject.js';
const CLEAN = 'export const doubled = (xs) => xs.map((x) => x * 2);\n';
const DIRTY = 'export const bad = (xs) => xs.map((x) => { if (x > 0) return x; });\n';

const run = (arm, op) => {
  const t0 = Date.now();
  const out = execFileSync(process.execPath, [STEP, arm, op, FILE], { encoding: 'utf8' });
  return { ...JSON.parse(out), wall: Date.now() - t0 };
};

const reset = (arm) => {
  for (const f of ['arm-b0-store.json', 'arm-b1-store.json', 'arm-t-journal.json']) {
    if (existsSync(f)) rmSync(f);
  }
  writeFileSync(FILE, CLEAN);
  void arm;
};

// CONFIGURATION CHANGE. Identical mechanism for every arm: the adapter's makeLinter() reads this
// file, so all three see the same change through the same door.
const CFGFILE = 'value-config.json';
const setConfig = (opts) => writeFileSync(CFGFILE, JSON.stringify(opts));

const rows = [];
const record = (arm, scenario, res, expectReuse) => {
  const ok = res.reused === expectReuse;
  rows.push({ arm, scenario, reused: res.reused === true, why: res.why || '', ms: res.ms,
    wall: res.wall, expected: expectReuse, verdict: ok ? 'as required' : 'REQUIREMENT VIOLATED' });
};

for (const arm of ['b0', 'b1', 't', 'tc']) {
  // R-c + R-d: nothing changed, across a restart
  reset(arm);
  setConfig({});
  run(arm, 'record');
  record(arm, 'unchanged, after restart', run(arm, 'reuse'), true);

  // R-a: content changed
  reset(arm);
  setConfig({});
  run(arm, 'record');
  writeFileSync(FILE, DIRTY);
  record(arm, 'CONTENT changed', run(arm, 'reuse'), false);

  // R-b: configuration changed
  reset(arm);
  setConfig({});
  run(arm, 'record');
  setConfig({ allowImplicit: true });
  record(arm, 'CONFIG changed', run(arm, 'reuse'), false);

  // R-e: the TOOL changed. Simulated by perturbing what each arm reads as tool identity, through
  // an environment variable both arms consult identically via LEGASUS_FAKE_TOOL_BUMP.
  reset(arm);
  setConfig({});
  run(arm, 'record');
  process.env.LEGASUS_FAKE_TOOL_BUMP = '1';
  record(arm, 'TOOL changed (R-e)', run(arm, 'reuse'), false);
  delete process.env.LEGASUS_FAKE_TOOL_BUMP;
}

console.log('arm  scenario                      reused  expected  verdict                ms');
console.log('-'.repeat(92));
for (const r of rows) {
  console.log(r.arm.padEnd(5) + r.scenario.padEnd(30) + String(r.reused).padEnd(8)
    + String(r.expected).padEnd(10) + r.verdict.padEnd(23) + String(r.ms));
  if (r.why) console.log('        why: ' + r.why.slice(0, 110));
}
const violations = rows.filter((r) => r.verdict !== 'as required');
console.log('\nREQUIREMENT VIOLATIONS: ' + violations.length);
for (const v of violations) console.log('  ' + v.arm + ' / ' + v.scenario);
writeFileSync('value-result.json', JSON.stringify(rows, null, 2));
void readFileSync;
