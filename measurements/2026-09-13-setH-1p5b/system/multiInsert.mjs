// V3 DELTA 1 - MULTI_MEMBER_LOCALIZED_INSERTION.
//
// v2's add_method inserted only members[0]. The 41-60 holdout split perfectly on that defect:
// all seven single-member goals passed, both two-member goals failed with missing_member, and those
// two were the ENTIRE v1-pass -> v2-fail reversal column.
//
// THE DESIGN TRAP, recorded before this was written and still the thing that matters most:
// multi-member insertion is NOT "call FIM twice". Every successful insertion creates the
// AUTHORITATIVE SOURCE for the next one. Spans must not be derived up front, and the preservation
// audit for insertion N must be baselined against source_{N-1}, never against source_0. Comparing
// insertion 2 to the original would make it appear to have deleted insertion 1 - a false
// preservation violation indistinguishable from the model destroying code.
//
//   source_0 -> span(member_1 | source_0) -> FIM -> audit vs source_0 -> load -> source_1
//   source_1 -> span(member_2 | source_1) -> FIM -> audit vs source_1 -> load -> source_2
//   ...
//   any failure -> ROLL BACK THE WHOLE GOAL to source_0
//
// A partially modified artifact is never left behind: half a feature that loads is worse than a
// clean refusal, because it scores as "the file still works" while the goal is unmet.
import { validateSpanShape, auditLocalizedEdit } from './spanSafety.mjs';
import { spanAddMethod, spanAddFunction } from './fimspan.mjs';
import { checkContract } from './contractCheck.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// fimFn(prefix, suffix) -> Promise<string>. Injected so fixtures can drive this without a model.
export async function insertMembers({ ws, contract, owner, members, fimFn, op = 'add_method' }) {
  const file = contract.lead;
  const path = join(ws, file);
  const source0 = readFileSync(path, 'utf8');

  const steps = [];
  let current = source0;
  const rollback = (why) => {
    writeFileSync(path, source0, 'utf8');
    return { ok: false, why, steps, rolled_back: true, members_inserted: 0 };
  };

  for (let i = 0; i < members.length; i++) {
    const name = members[i];
    const step = { member: name, index: i, baseline_bytes: current.length };

    // 1. SPAN VALIDITY against the CURRENT authoritative source, not the original.
    const target = op === 'add_method'
      ? { op: 'add_method', owner, member: name, lang: contract.lang }
      : { op: 'add_function', fn: name, lang: contract.lang };
    const shape = validateSpanShape(current, target);
    if (!shape.ok) { step.failed = 'span_invalid: ' + shape.problems.join('; '); steps.push(step); return rollback(step.failed); }

    const span = op === 'add_method'
      ? spanAddMethod(current, contract.lang, owner, name)
      : spanAddFunction(current, contract.lang, name);
    if (!span.ok) { step.failed = 'span_not_locatable: ' + span.why; steps.push(step); return rollback(step.failed); }
    step.prefix_bytes = span.prefix.length;
    step.suffix_bytes = span.suffix.length;
    step.where = span.where;

    let mid;
    try { mid = await fimFn(span.prefix, span.suffix); } catch (e) { mid = ''; step.threw = String(e.message).slice(0, 80); }
    step.fim_output_bytes = String(mid || '').length;
    if (!String(mid || '').trim()) { step.failed = 'fim_empty'; steps.push(step); return rollback('FIM returned nothing for ' + name); }

    const candidate = span.prefix + mid + span.suffix;

    // 2. PRESERVATION, RE-BASELINED against the immediately preceding successful source.
    const audit = auditLocalizedEdit({
      before: current, after: candidate, op, lang: contract.lang,
      span: { prefixOriginal: span.origPrefix, suffixOriginal: span.origSuffix },
    });
    step.deleted_bytes = audit.metrics.deleted_bytes;
    step.outside_span_changed = audit.metrics.outside_span_changed;
    if (!audit.ok) { step.failed = 'preservation: ' + audit.problems.join('; '); steps.push(step); return rollback(step.failed); }

    // 3. STRUCTURAL SAFETY - the INTERMEDIATE artifact must load on its own.
    writeFileSync(path, candidate, 'utf8');
    const mid_check = checkContract(ws, file, { ...contract, moduleExports: [], members: [] });
    if (!mid_check.loads) {
      step.failed = 'intermediate_does_not_load: ' + String(mid_check.msg).slice(0, 70);
      steps.push(step);
      return rollback(step.failed);
    }

    // 4. EVERY PREVIOUSLY INSERTED MEMBER MUST STILL BE THERE.
    const earlier = members.slice(0, i);
    if (earlier.length) {
      const survive = checkContract(ws, file, {
        ...contract,
        moduleExports: contract.moduleExports,
        members: earlier.map((m) => ({ owner, kind: 'instance_method', name: m })),
      });
      if (!survive.ok) {
        step.failed = 'earlier_member_lost: ' + String(survive.msg).slice(0, 70);
        steps.push(step);
        return rollback(step.failed);
      }
    }

    step.ok = true;
    steps.push(step);
    current = candidate;
  }

  // 5. THE FULL CONTRACT, only after every requested member is in.
  const final = checkContract(ws, file, contract);
  if (!final.ok) {
    return { ok: false, why: 'final contract: ' + String(final.msg).slice(0, 90), steps,
      rolled_back: false, members_inserted: members.length, final_check: final };
  }
  return { ok: true, steps, rolled_back: false, members_inserted: members.length, final_check: final,
    bytes_before: source0.length, bytes_after: current.length };
}
