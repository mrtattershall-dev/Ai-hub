// CONFINEMENT AUDIT for candidate SINGLE_SPAN_BEHAVIORAL goals.
//
// Goals 44/45 taught this: "the behaviour changes in one named function" does NOT imply the
// implementation delta is confined to that function. Goal 44's link logic lived in a helper and
// goal 45's function table in a module-level const, so single-span replacement could never express
// either - and only reading the reference implementations revealed that.
//
// So a goal is only labelled SINGLE_SPAN_BEHAVIORAL_ELIGIBLE if a CORRECT implementation can be
// CONSTRUCTED by substituting one span and nothing else. The reference here is built by literally
// splicing a new body into the frozen post-60 source, which makes confinement true by construction;
// what is then tested is whether such a construction can actually deliver the goal while keeping
// every prior behaviour. If it cannot, the goal belongs in UNSUPPORTED.
import { spanReplaceFunction } from './safeReplace.mjs';
import { regressionFor } from './regression.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');

export function freshPost60() {
  const ws = mkdtempSync(join(tmpdir(), 'confine-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of readdirSync(join(HERE, 'seed'))) {
    const p = join(HERE, 'seed', f);
    if (statSync(p).isFile()) copyFileSync(p, join(ws, f));
  }
  for (const f of readdirSync(join(HERE, 'seed60'))) {
    const p = join(HERE, 'seed60', f);
    if (statSync(p).isFile()) copyFileSync(p, join(ws, f));
  }
  return ws;
}

// Splice a new body into exactly one span of the frozen source. Returns the candidate file and the
// span metrics, or a refusal.
export function spliceOneSpan(ws, file, lang, fn, newBody) {
  const path = join(ws, file);
  const src = readFileSync(path, 'utf8');
  const span = spanReplaceFunction(src, lang, fn);
  if (!span.ok) return { ok: false, why: span.why };
  const candidate = span.prefix + newBody + span.suffix;
  return {
    ok: true,
    candidate,
    origPrefix: span.origPrefix,
    origSuffix: span.origSuffix,
    span_bytes: src.length - span.origPrefix.length - span.origSuffix.length,
  };
}

// Does a spliced candidate keep every old behaviour AND deliver the new one?
export function auditConfinement({ file, lang, fn, newBody, deltaCheck }) {
  const ws = freshPost60();
  const spliced = spliceOneSpan(ws, file, lang, fn, newBody);
  if (!spliced.ok) return { confined: false, why: 'span refused: ' + spliced.why };

  const before = regressionFor(file);
  if (!before) return { confined: false, why: 'no regression suite for ' + file };
  const baseline = before(ws);
  if (!baseline.pass) return { confined: false, why: 'baseline already failing: ' + baseline.why };

  writeFileSync(join(ws, file), spliced.candidate, 'utf8');
  const after = before(ws);
  if (!after.pass) return { confined: false, why: 'OLD BEHAVIOUR BROKE: ' + after.why, ws };

  const delta = deltaCheck(ws);
  if (!delta.pass) return { confined: false, why: 'delta not delivered by a single-span edit: ' + delta.why, ws };

  return { confined: true, span_bytes: spliced.span_bytes, new_body_bytes: newBody.length, ws };
}

export function pyCheck(ws, code) {
  writeFileSync(join(ws, '_c.py'), code, 'utf8');
  const r = spawnSync('python', [join(ws, '_c.py')], { cwd: ws, encoding: 'utf8', timeout: 30000 });
  return (String(r.stdout || '') + String(r.stderr || '')).trim();
}
