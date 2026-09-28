// THE OPERATION CONTEXT, built in exactly one place.
//
// The conformance audit reported seven over-constraints that the scorer reported as clean. The deriver
// was not at fault: the audit built `parentRange` as the whole file while the scorer computed the
// enclosing unit. `control_flow_boundary` then scanned past the operation's real block, found a
// terminator belonging to a different function, and removed positions beyond it.
//
// That is hazard 9 for the second time - two places computing one derived thing, disagreeing, and
// producing plausible numbers in both directions. The permanent rule applies: if two pieces of code
// must agree on a derived artifact, there is ONE implementation of it. Every consumer calls this.
//
// It also records a real property of the deriver, which belongs in the supported contract rather than
// in a comment: `control_flow_boundary` is sound only RELATIVE to a correctly computed parent range.
// Given a wrong one it over-constrains. The parent range is an input the deriver trusts, so it is not
// something any consumer may improvise.
import { operationFacts } from './opfacts.mjs';

const NL = String.fromCharCode(10);
const ind = (l) => (l.match(/^[ \t]*/) || [''])[0].length;

// The body range of the unit an insertion at `indent` belongs to. Module-level insertions belong to
// the whole file; deeper ones belong to the nearest enclosing def or class.
export function parentRangeFor(src, refPos, indent) {
  const lines = src.split(NL);
  if (indent === 0) return { lo: 0, hi: lines.length - 1 };
  for (let i = refPos; i >= 0; i--) {
    const m = lines[i].match(/^(\s*)(?:def|class)\b/);
    if (!m || m[1].length >= indent) continue;
    let end = i;
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].trim()) continue;
      if (ind(lines[j]) <= m[1].length) break;
      end = j;
    }
    return { lo: i + 1, hi: end };
  }
  return { lo: 0, hi: lines.length - 1 };
}

// Everything a deriver needs for one operation, from the reconstruction and its ground-truth row.
export function buildContext(recon, k, base, row, taskId) {
  const code = recon.full[k].code;
  const facts = operationFacts(code);
  const indent = ind(code.split(NL).find((l) => l.trim()) || '');
  return {
    src: base,
    origin: recon.src,
    code,
    indent,
    provides: facts.provides,
    siblingKind: /^\s*def\b/m.test(code) ? 'def' : null,
    operation_id: (taskId ? taskId + ':' : '') + (row && row.op ? row.op : 'op' + (k + 1)),
    parentRange: parentRangeFor(base, row ? row.ref_position : 0, indent),
    facts,
  };
}

export { NL };
