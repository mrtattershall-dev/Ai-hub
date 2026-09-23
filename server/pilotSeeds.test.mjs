/**
 * pilotSeeds.test.mjs - THE SEED RULE.
 *
 *   node server/pilotSeeds.test.mjs
 *
 * Before the pilot may run, every STARTING workspace must:
 *     FAIL at least one requested-behaviour check   (there is real work to do)
 *     PASS all of its protected-behaviour checks    (the starting point is sound)
 *
 * Without the first, a seeded success masquerades as completed work - and that is not a
 * hypothetical failure mode here: the batch runner was already caught scoring an untouched
 * seeded workspace as COMPLETED when the worker was unavailable. Without the second, a task
 * would be scored FAIL for breakage it inherited rather than caused.
 *
 * This also proves the CHECKS THEMSELVES RUN. A check that errors on every input would "fail"
 * the seed for the wrong reason, so the requested check is additionally shown to PASS against a
 * known-good reference implementation. That is the positive control: sensitivity and
 * specificity are orthogonal, and a check that can never pass is as useless as one that can
 * never fail.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { PILOT_TASKS } = await import('./pilotTasks.js');
const { evaluate, VERDICT } = await import('./evaluator.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

/** A known-good reference for each task, used ONLY as the positive control for its check. */
const REFERENCE = {
  't1-repair-node-average': { 'stats.js': 'function total(xs){return xs.reduce((a,b)=>a+b,0);}\nfunction average(xs){return xs.length===0?0:total(xs)/xs.length;}\nmodule.exports={total,average};\n' },
  't2-repair-python-parse': { 'parser.py': 'def normalise(s):\n    return s.strip().lower()\n\ndef parse_pairs(s):\n    parts = [p for p in s.split(";") if p]\n    out = {}\n    for p in parts:\n        if "=" in p:\n            k, v = p.split("=", 1)\n            out[normalise(k)] = normalise(v)\n    return out\n' },
  't3-add-node-median': { 'numbers.js': 'function sum(xs){return xs.reduce((a,b)=>a+b,0);}\nfunction max(xs){return xs.length?Math.max(...xs):null;}\nfunction median(xs){if(!xs.length)return 0;const s=[...xs].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;}\nmodule.exports={sum,max,median};\n' },
  't4-add-python-slugify': { 'text.py': 'import re\n\ndef word_count(s):\n    return len([w for w in s.split() if w])\n\ndef slugify(s):\n    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")\n' },
  't5-multifile-node-discount': {
    'pricing.js': 'function round2(n){return Math.round(n*100)/100;}\nfunction applyDiscount(amount,percent){return round2(amount*(1-percent/100));}\nmodule.exports={round2,applyDiscount};\n',
    'cart.js': "const {round2,applyDiscount}=require('./pricing');\nfunction cartTotal(items,percent){const t=round2(items.reduce((a,i)=>a+i.price*i.qty,0));return percent?applyDiscount(t,percent):t;}\nmodule.exports={cartTotal};\n",
  },
};

const dirs = [];
function materialise(task, overlay = null) {
  const ws = mkdtempSync(join(tmpdir(), 'seed-'));
  dirs.push(ws);
  const files = { ...task.seed, ...(overlay || {}) };
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(join(ws, f, '..'), { recursive: true });
    writeFileSync(join(ws, f), body, 'utf8');
  }
  const g = (...a) => execFileSync('git', ['-C', ws, ...a], { encoding: 'utf8', stdio: 'pipe' });
  g('init', '-q'); g('add', '-A'); g('-c', 'user.email=s@s', '-c', 'user.name=s', 'commit', '-q', '-m', 'seed');
  return ws;
}

try {
  console.log(`=== ${PILOT_TASKS.length} frozen tasks ===`);
  const kinds = PILOT_TASKS.reduce((a, t) => { a[t.kind] = (a[t.kind] || 0) + 1; return a; }, {});
  const langs = PILOT_TASKS.reduce((a, t) => { a[t.language] = (a[t.language] || 0) + 1; return a; }, {});
  say(PILOT_TASKS.length === 5, `five tasks (${PILOT_TASKS.length})`);
  say(kinds.repair === 2 && kinds.addition === 2 && kinds['multi-file'] === 1, `two repairs, two additions, one multi-file (${JSON.stringify(kinds)})`);
  say(langs.node === 3 && langs.python === 2, `three Node, two Python (${JSON.stringify(langs)})`);
  say(new Set(PILOT_TASKS.map((t) => t.id)).size === 5, 'task ids are distinct');

  for (const task of PILOT_TASKS) {
    console.log(`\n=== ${task.id} ===`);
    const seedWs = materialise(task);
    const seedResult = await evaluate(seedWs, task);

    // THE WORK MUST BE REAL.
    say(seedResult.requested?.verdict === VERDICT.FAIL,
      `the seed FAILS the requested check - there is real work to do (${seedResult.requested?.verdict})`);
    // THE STARTING POINT MUST BE SOUND.
    say(seedResult.protected?.verdict === VERDICT.PASS,
      `the seed PASSES the protected check - nothing is inherited broken (${seedResult.protected?.verdict})`);

    // POSITIVE CONTROL: the requested check must be capable of passing at all.
    const refWs = materialise(task, REFERENCE[task.id]);
    const refResult = await evaluate(refWs, task);
    say(refResult.verdict === VERDICT.PASS,
      `POSITIVE CONTROL: a known-good implementation PASSES both checks (${refResult.verdict}` +
      `${refResult.verdict !== VERDICT.PASS ? ' | ' + String(refResult.requested?.out || refResult.requested?.reason || '').replace(/\s+/g, ' ').slice(0, 90) : ''})`);
  }
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  pilot seeds: ${passed} passed, ${failed} failed -> ${failed ? 'THE QUEUE IS NOT FIT TO RUN' : 'every seed has real work to do and a sound starting point'}`);
process.exit(failed ? 1 : 0);
