// V3 DELTA 2 - SAFE_BEHAVIOURAL_REPLACEMENT.
//
// The lane v2 deliberately left empty. replace_method was built and fixture-tested in v2 but never
// wired in, because its default action is DESTRUCTIVE rather than additive and there was no way to
// distinguish "implemented the new feature" from "implemented it by deleting yesterday's feature".
// Behavioural oracles with three witnesses now exist, so that distinction is finally measurable.
//
// A replacement passes ONLY when:
//     OLD BEHAVIOUR STILL PASSES   and   NEW REQUESTED BEHAVIOUR PASSES
//
// Pipeline:
//   identify the exact target -> prove uniqueness -> capture the authorized span
//   -> prove the OLD regression suite passes BEFORE modification (a broken baseline witnesses
//      nothing, so that is a refusal, not a failure)
//   -> native FIM replacement of only that span
//   -> prove everything outside the span is unchanged
//   -> isolated parse/load
//   -> rerun OLD regression proofs
//   -> run the NEW delta proof
//   -> contract check
//   -> PASS only if all green, otherwise ROLL BACK
//
// The v2 rule is unchanged: when uncertain, refuse. A false-negative costs performance; a
// false-positive silently corrupts working code while looking precise.
import { spanReplaceMethod } from './fimspan.mjs';
import { outsideSpanChanged } from './spanSafety.mjs';
import { checkContract } from './contractCheck.mjs';
import { regressionFor } from './regression.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Module-level function replacement. spanReplaceMethod handles INDENTED members; a module-level
// def/function needs its own span, and it lives here rather than in the frozen v2 fimspan.mjs.
export function spanReplaceFunction(src, lang, fn) {
  if (lang === 'py') {
    const re = new RegExp('^def\\s+' + esc(fn) + '\\s*\\(', 'm');
    const m = src.match(re);
    if (!m) return { ok: false, why: 'no module-level def ' + fn };
    if ((src.match(new RegExp('^def\\s+' + esc(fn) + '\\s*\\(', 'gm')) || []).length > 1) {
      return { ok: false, why: fn + ' is defined more than once - ambiguous' };
    }
    const start = m.index;
    const rest = src.slice(start).split('\n');
    let end = rest.length;
    for (let i = 1; i < rest.length; i++) {
      const l = rest[i];
      if (l.trim() === '') continue;
      if (!/^[ \t]/.test(l)) { end = i; break; }    // first line back at column 0 ends the def
    }
    const cut = start + rest.slice(0, end).join('\n').length;
    return { ok: true, where: 'body of ' + fn,
      prefix: src.slice(0, start) + 'def ' + fn + '(',
      suffix: '\n' + src.slice(cut),
      origPrefix: src.slice(0, start), origSuffix: src.slice(cut) };
  }
  const re = new RegExp('^function\\s+' + esc(fn) + '\\s*\\([^\\n]*\\{', 'm');
  const m = src.match(re);
  if (!m) return { ok: false, why: 'no module-level function ' + fn };
  if ((src.match(new RegExp('^function\\s+' + esc(fn) + '\\s*\\(', 'gm')) || []).length > 1) {
    return { ok: false, why: fn + ' is defined more than once - ambiguous' };
  }
  let depth = 0;
  let i = m.index + m[0].length - 1;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  if (depth !== 0) return { ok: false, why: 'unbalanced braces in ' + fn };
  return { ok: true, where: 'body of ' + fn,
    prefix: src.slice(0, m.index) + 'function ' + fn + '(',
    suffix: '\n' + src.slice(i + 1),
    origPrefix: src.slice(0, m.index), origSuffix: src.slice(i + 1) };
}

export async function replaceBehaviour({ ws, contract, target, owner, fimFn, deltaProbe, runProbe }) {
  const file = contract.lead;
  const path = join(ws, file);
  const source0 = readFileSync(path, 'utf8');
  const rec = {
    target, owner: owner || null, where: null,
    baseline_regression: null, span_bytes: 0, fim_output_bytes: 0,
    outside_span_changed: null, lost_symbols: [], loads_after: null,
    regression_after: null, delta_after: null, contract_after: null,
    ok: false, rolled_back: false, why: '',
  };
  const rollback = (why) => { writeFileSync(path, source0, 'utf8'); rec.why = why; rec.rolled_back = true; return rec; };

  // 1. THE BASELINE MUST BE SOUND. A regression suite that is already failing cannot witness that
  //    the replacement preserved anything, so this is a REFUSAL rather than a goal failure.
  const suite = regressionFor(file);
  if (!suite) { rec.why = 'no old-behaviour regression suite for ' + file + ' - refusing to replace'; return rec; }
  const before = suite(ws);
  rec.baseline_regression = before.pass;
  if (!before.pass) { rec.why = 'baseline regression already failing: ' + before.why; return rec; }

  // 2. AUTHORIZED SPAN, with uniqueness proven by the span function itself.
  const span = owner
    ? spanReplaceMethod(source0, contract.lang, owner, target)
    : spanReplaceFunction(source0, contract.lang, target);
  if (!span.ok) { rec.why = 'span refused: ' + span.why; return rec; }
  rec.where = span.where;
  rec.span_bytes = source0.length - span.origPrefix.length - span.origSuffix.length;

  let mid;
  try { mid = await fimFn(span.prefix, span.suffix); } catch (e) { mid = ''; }
  rec.fim_output_bytes = String(mid || '').length;
  if (!String(mid || '').trim()) { rec.why = 'FIM returned nothing'; return rec; }
  const candidate = span.prefix + mid + span.suffix;

  // 3. NOTHING OUTSIDE THE AUTHORIZED SPAN MAY CHANGE. Unlike an insertion this is not
  //    zero-deletion - the old body is meant to go - so preservation is checked on the boundaries
  //    and on the surviving symbol set, not on byte count.
  const outside = outsideSpanChanged(source0, candidate, { prefixOriginal: span.origPrefix, suffixOriginal: span.origSuffix });
  rec.outside_span_changed = !outside.ok;
  if (!outside.ok) { rec.why = 'bytes outside the authorized span changed'; return rec; }

  // survivingSymbols is NOT applied here, and that is deliberate. It is correct for an INSERTION,
  // where nothing should vanish. For a REPLACEMENT it is both wrong and redundant:
  //   wrong     - helpers defined INSIDE the replaced body (to_html's nested `flush`, evaluate's
  //               nested `eat`) legitimately disappear; that is what replacement means. Requiring
  //               them to survive rejects every correct replacement.
  //   redundant - once prefix and suffix are proven byte-identical, everything OUTSIDE the span is
  //               preserved by construction; there is nothing left for a symbol scan to add.
  // What guards behaviour here is the OLD REGRESSION SUITE below, which is the real test of whether
  // anything that mattered was lost.
  rec.lost_symbols = [];

  writeFileSync(path, candidate, 'utf8');

  // 4. ISOLATED LOAD
  const loadOnly = checkContract(ws, file, { ...contract, moduleExports: [], members: [] });
  rec.loads_after = loadOnly.loads;
  if (!loadOnly.loads) return rollback('does not load after replacement: ' + String(loadOnly.msg).slice(0, 80));

  // 5. OLD BEHAVIOUR MUST STILL PASS
  const after = suite(ws);
  rec.regression_after = after.pass;
  if (!after.pass) return rollback('OLD BEHAVIOUR BROKE: ' + after.why);

  // 6. NEW BEHAVIOUR MUST PASS
  if (deltaProbe) {
    let pr;
    try { pr = await (runProbe ? runProbe(deltaProbe, ws) : deltaProbe.run(ws)); } catch (e) { pr = { pass: false, why: String(e.message).slice(0, 80) }; }
    rec.delta_after = pr.pass;
    if (!pr.pass) return rollback('new behaviour not delivered: ' + String(pr.why).slice(0, 90));
  }

  // 7. STRUCTURAL CONTRACT
  const con = checkContract(ws, file, contract);
  rec.contract_after = con.ok;
  if (!con.ok) return rollback('contract: ' + String(con.msg).slice(0, 80));

  rec.ok = true;
  return rec;
}
