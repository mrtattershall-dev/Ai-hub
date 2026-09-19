// RE-AUDIT: does the 21.9% observability figure survive code-object identity?
//
// The earlier number used (module, line) keys, whose numerator AND denominator could each be contaminated
// by the same aliasing: a module-level `def foo(` statement executing during a traced import looked
// identical to a site inside foo. DO NOT ASSUME THE ERRORS CANCELLED. Both figures are computed here and
// both are preserved, because "the arithmetic was right and the proof ancestry was compromised" is a
// different failure from "the number was wrong".
//
// Also measured rather than assumed: whether a function's own `def` line is EVER emitted as a line event.
// The previous bytecode-offset argument for excluding it over-predicted (it claimed 212 phantom lines, 25
// of which had actually been traced), so this time the exclusion is decided by observation.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { FINGERPRINT_SRC, parseSite } from '../../legasus/legaexercise/pysite.mjs';

const NL = String.fromCharCode(10);
const ROOT = 'benchmarks/repoB/pristine/packaging';

const DENOM = [
  'import json, os, sys, types',
  FINGERPRINT_SRC,
  'root = sys.argv[1]',
  'rows = []',
  'def walk(code, qual, mod, top):',
  '    lines = sorted({ln for (_s, _e, ln) in code.co_lines() if ln is not None})',
  '    rows.append({"mod": mod, "qual": qual, "top": top, "first": code.co_firstlineno,',
  '                 "keys": [sitekey(mod, code, ln) for ln in lines],',
  '                 "defkey": sitekey(mod, code, code.co_firstlineno)',
  '                            if code.co_firstlineno in lines else None})',
  '    for c in code.co_consts:',
  '        if isinstance(c, types.CodeType):',
  '            walk(c, getattr(c, "co_qualname", c.co_name), mod, False)',
  'for f in sorted(os.listdir(root)):',
  '    if f.endswith(".py"):',
  '        src = open(os.path.join(root, f), encoding="utf-8").read()',
  '        walk(compile(src, f, "exec"), "<module>", f[:-3], True)',
  'print(json.dumps(rows))',
].join(NL);

const rows = JSON.parse(execFileSync('python', ['-c', DENOM, ROOT],
  { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));

const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json', 'utf8'));
const reachedQ = new Set(sweep.reachedQLines);
const reachedL = new Set(sweep.reachedLines);

// MEASURED, NOT ARGUED: is a function's own `def` line ever emitted as a line event?
const defKeys = rows.filter((r) => !r.top && r.defkey).map((r) => r.defkey);
const defHit = defKeys.filter((k) => reachedQ.has(k));
console.log('function `def` lines present in co_lines(): ' + defKeys.length);
console.log('  of those, EVER emitted as a line event  : ' + defHit.length
  + (defHit.length ? '  ' + defHit.slice(0, 3).join(', ') : ''));
const EXCLUDE_DEF = defHit.length === 0;
console.log('  -> excluded from the denominator by OBSERVATION: ' + EXCLUDE_DEF);
console.log('');

// NEW: code-object-identified sites, call-time code objects only.
let nTot = 0; let nHit = 0;
const perMod = {};
for (const r of rows) {
  if (r.top) continue;                       // module code object runs at import: not call-time
  for (const k of r.keys) {
    if (EXCLUDE_DEF && k === r.defkey) continue;
    nTot++;
    if (reachedQ.has(k)) nHit++;
    const m = perMod[r.mod] || (perMod[r.mod] = { hit: 0, tot: 0 });
    m.tot++; if (reachedQ.has(k)) m.hit++;
  }
}

// OLD: (module, line) keys, exactly as the 21.9% figure was computed.
const oldTot = new Set(); const oldHitSet = new Set();
for (const r of rows) {
  if (r.top) continue;
  for (const k of r.keys) {
    const p = parseSite(k);
    oldTot.add(p.module + ':' + p.line);
  }
}
for (const k of oldTot) if (reachedL.has(k)) oldHitSet.add(k);

console.log('OLD  (module, line) identity : ' + oldHitSet.size + '/' + oldTot.size
  + ' = ' + (100 * oldHitSet.size / oldTot.size).toFixed(1) + '%');
console.log('NEW  code-object identity    : ' + nHit + '/' + nTot
  + ' = ' + (100 * nHit / nTot).toFixed(1) + '%');
console.log('');
console.log('  module                 new            old');
for (const [m, c] of Object.entries(perMod).sort((a, b) => b[1].hit / b[1].tot - a[1].hit / a[1].tot)) {
  const o = [...oldTot].filter((k) => k.startsWith(m + ':'));
  const oh = o.filter((k) => reachedL.has(k)).length;
  console.log('  ' + m.padEnd(20) + (c.tot ? (100 * c.hit / c.tot).toFixed(1) : '0.0').padStart(6) + '%'
    + '  ' + String(c.hit) + '/' + String(c.tot).padEnd(6)
    + (o.length ? (100 * oh / o.length).toFixed(1) : '0.0').padStart(6) + '%');
}
