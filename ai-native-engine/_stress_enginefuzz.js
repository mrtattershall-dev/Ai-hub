'use strict';
// LABEL=enginefuzz — run the project's existing fuzzers at high iteration counts,
// multiple seeds. Report any invariant break. Zero deps beyond node.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const ROOT = __dirname;

function run(rel, args, env) {
  const file = path.join(ROOT, rel);
  const t0 = Date.now();
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath, [file, ...args], {
      cwd: ROOT, env: { ...process.env, ...(env || {}) },
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000,
    });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
    code = e.status == null ? 'ERR/' + e.message : e.status;
  }
  const ms = Date.now() - t0;
  return { out, code, ms };
}

function tailLines(s, n) {
  const L = s.trimEnd().split(/\r?\n/);
  return L.slice(-n).join('\n');
}

const report = [];

// ---- 024 concurrency fuzz: node fuzz.js [iterations] [masterSeed] ----
console.log('\n########## 024 concurrency fuzz ##########');
for (const seed of [1, 2, 7, 12345]) {
  const iters = 50000;
  const r = run('experiments/024_concurrency_fuzz/fuzz.js', [String(iters), String(seed)]);
  const summary = tailLines(r.out, 3);
  const failed = r.code !== 0 || /FAILURE/.test(r.out) || !/ALL PASS/.test(r.out);
  console.log(`seed=${seed} iters=${iters} exit=${r.code} ${r.ms}ms`);
  console.log(summary);
  report.push({ fuzzer: '024', seed, iters, exit: r.code, failed, summary });
}

// ---- 026 behavior invariants: FUZZ_N env controls the I5 fuzz count ----
console.log('\n########## 026 behavior invariants ##########');
for (const n of [20000, 20000]) {
  // second run gets a different-ish behavior by env; the fuzzer seeds by index so
  // just bump N high. Run twice to check stability.
  const r = run('experiments/026_behavior_invariants/behavior_invariants.js', [], { FUZZ_N: String(n) });
  const failLines = r.out.split(/\r?\n/).filter(l => /^FAIL|FAILURES|divergence|ACCEPTED|desync|identity break|growth bound|invalid/.test(l));
  const passed = r.code === 0 && /ALL PASS/.test(r.out);
  console.log(`FUZZ_N=${n} exit=${r.code} ${r.ms}ms  passed=${passed}`);
  console.log(tailLines(r.out, 2));
  if (failLines.length) { console.log('  FAIL/anomaly lines:'); failLines.forEach(l => console.log('   ' + l)); }
  report.push({ fuzzer: '026', n, exit: r.code, failed: !passed, failLines });
}

// ---- 031 reload composition (no iteration knob; deterministic T1-T6) ----
console.log('\n########## 031 reload composition ##########');
{
  const r = run('experiments/031_reload_composition/reload_composition.js', []);
  const failLines = r.out.split(/\r?\n/).filter(l => /^FAIL/.test(l));
  const passed = r.code === 0 && /ALL PASS/.test(r.out);
  console.log(`exit=${r.code} ${r.ms}ms  passed=${passed}`);
  console.log(tailLines(r.out, 2));
  if (failLines.length) { console.log('  FAIL lines:'); failLines.forEach(l => console.log('   ' + l)); }
  report.push({ fuzzer: '031', exit: r.code, failed: !passed, failLines });
}

// ---- verdict ----
console.log('\n########## VERDICT ##########');
const broken = report.filter(r => r.failed);
if (!broken.length) {
  console.log('ALL FUZZERS PASS across all seeds/iterations — no invariant break, no known-stale failure either.');
} else {
  console.log(`${broken.length} run(s) reported failure:`);
  for (const b of broken) console.log('  ' + JSON.stringify(b));
}
