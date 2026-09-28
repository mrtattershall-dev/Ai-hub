// OPERATION PLANNER. Chooses generation granularity from the typed contract plus the CURRENT state
// of the artifact - not from the goal's prose.
//
// THE PRINCIPLE: prevent invalid choices instead of teaching the model to recover from them.
//
// If the contract already knows
//     owner: Graph   operation: add instance method   member: shortest_path
//     new artifacts: none   new dependencies: none
// then letting a 1.5B decide to rewrite the whole module and import networkx is needless autonomy.
// On goals 21-40 that autonomy produced nine of twelve genuine failures - seven of them invented
// dependencies - before the requested member could even be evaluated.
//
// Choosing WHERE a method belongs is no longer a semantic mystery. The contract knows. So the
// system hands the model the exact hole and asks it to fill that, which is also far closer to this
// model's native fill-in-the-middle training regime than a whole-file agent loop.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Does the owner already exist in the artifact on disk, and which members are actually absent?
function ownerState(src, contract, owner, lang) {
  const esc = owner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // COUNT, do not merely test. Two declarations of the same owner means the insertion point is
  // ambiguous, and the planner must refuse on its own rather than leaning on validateSpanShape to
  // catch it downstream - a route whose correctness depends on a later stage saying no is the same
  // defect already fixed once in classifyFailure.
  const declRe = lang === 'py'
    ? new RegExp('^class\\s+' + esc + '\\b', 'gm')
    : new RegExp('^(?:class|const|let|var|function)\\s+' + esc + '\\b', 'gm');
  const n = (src.match(declRe) || []).length;
  return { present: n === 1, count: n };
}

// Comments are not code. The canonical seed's headers NAME the held-out functions in order to
// document that they are absent ("Goal 42 (percentile) ... HELD OUT"), and a bare presence test
// reads that documentation and concludes the name already exists - which mis-routed four goals to
// a behavioural fallback when they are ordinary module-level additions. Strings are stripped too:
// a name mentioned in an error message is not a definition either.
export function stripNonCode(src, lang) {
  let s = String(src);
  if (lang === 'py') {
    s = s.replace(/^[ \t]*#.*$/gm, '').replace(/'''[\s\S]*?'''/g, '').replace(/"""[\s\S]*?"""/g, '');
  } else {
    s = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
  }
  return s.replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
}

function memberPresent(src, name, lang) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Horizontal whitespace only. With \s+ a MODULE-level function would match (newline + name) and
  // be reported as a class member, which would mis-route the whole operation.
  return lang === 'py'
    ? new RegExp('^[ \\t]+def\\s+' + esc + '\\s*\\(', 'm').test(src)
    : new RegExp('^[ \\t]+(?:static\\s+)?' + esc + '\\s*\\(', 'm').test(src);
}

// Fallback reasons are ENUMS, not prose, so the residual can be aggregated later: the architecture's
// next frontier is whichever of these dominates. BEHAVIORAL_DELTA_UNPROVEN is the honest label for
// "the structural contract cannot tell this goal apart from a no-op" - those goals need regression
// proofs before any localized route may touch them.
export const FALLBACK = {
  BEHAVIORAL_DELTA_UNPROVEN: 'BEHAVIORAL_DELTA_UNPROVEN',
  AMBIGUOUS_OWNER: 'AMBIGUOUS_OWNER',
  DUPLICATE_OWNER: 'DUPLICATE_OWNER',
  NONLOCAL_EDIT: 'NONLOCAL_EDIT',
  MULTI_ARTIFACT: 'MULTI_ARTIFACT',
  MULTI_NAME_ABSENT: 'MULTI_NAME_ABSENT',
  LOCALIZATION_FAILED: 'LOCALIZATION_FAILED',
};

export function planOperation(contract, ws, goalText) {
  const path = join(ws, contract.lead);
  const exists = existsSync(path);
  const rawSrc = exists ? readFileSync(path, 'utf8') : '';
  // Everything below reasons about CODE. See stripNonCode above for why this matters.
  const src = stripNonCode(rawSrc, contract.lang);

  // A goal that creates its file is a whole-content generation, whatever else it says.
  if (!contract.isEdit || !exists || rawSrc.trim().length < 20) {
    return { op: 'create_file', reason: exists ? 'not an edit goal' : 'target does not exist yet' };
  }

  if (contract.lang === 'web' || contract.lang === 'md') {
    return { op: 'content_edit', fallbackReason: FALLBACK.NONLOCAL_EDIT, reason: 'markup goals have no member structure to localize' };
  }

  // Members grouped by owner, keeping only those genuinely missing from the current artifact.
  const byOwner = new Map();
  for (const m of contract.members) {
    if (memberPresent(src, m.name, contract.lang)) continue;
    if (!byOwner.has(m.owner)) byOwner.set(m.owner, []);
    byOwner.get(m.owner).push(m);
  }

  if (byOwner.size === 1) {
    const [owner, members] = [...byOwner.entries()][0];
    const st = ownerState(src, contract, owner, contract.lang);
    if (st.present) {
      return { op: 'add_method', owner, members, reason: members.length + ' member(s) absent from an existing ' + owner };
    }
    if (st.count > 1) {
      return { op: 'content_edit', fallbackReason: FALLBACK.DUPLICATE_OWNER, reason: owner + ' is declared ' + st.count + ' times - insertion point is ambiguous' };
    }
    return { op: 'content_edit', fallbackReason: FALLBACK.LOCALIZATION_FAILED, reason: owner + ' is not present in the artifact - nothing to insert into' };
  }
  if (byOwner.size > 1) {
    return { op: 'content_edit', fallbackReason: FALLBACK.AMBIGUOUS_OWNER, reason: 'members span ' + byOwner.size + ' owners - localization is ambiguous' };
  }

  // No members missing. A required MODULE-LEVEL name that is absent entirely is just as localizable
  // as a method - same principle, different insertion point (end of module rather than inside a
  // class body). Goals 28, 30, 32 and 40 are this shape, and under whole-file generation they
  // produced three of the invented dependencies.
  const missingExports = contract.moduleExports.filter((n) => {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return !new RegExp('\\b' + esc + '\\b').test(src);
  });
  if (missingExports.length === 1) {
    return { op: 'add_function', fn: missingExports[0],
      reason: 'module-level ' + missingExports[0] + ' is absent from an existing artifact' };
  }
  if (missingExports.length > 1) {
    return { op: 'content_edit', fallbackReason: FALLBACK.MULTI_NAME_ABSENT, reason: 'more than one module-level name absent: ' + missingExports.join(',') };
  }
  return { op: 'content_edit', fallbackReason: FALLBACK.BEHAVIORAL_DELTA_UNPROVEN, reason: 'contract already structurally satisfied - behaviour may still be wrong' };
}

// EDIT SURFACE. The core FIM-first hypothesis is that a smaller edit surface causes fewer
// integration failures, so the surface is measured directly rather than inferred from the outcome.
export function editSurface(before, after) {
  const b = String(before || '').split('\n');
  const a = String(after || '').split('\n');
  const bSet = new Map();
  for (const l of b) bSet.set(l, (bSet.get(l) || 0) + 1);
  let kept = 0;
  for (const l of a) {
    const n = bSet.get(l) || 0;
    if (n > 0) { kept++; bSet.set(l, n - 1); }
  }
  const linesAdded = a.length - kept;
  const linesRemoved = b.length - kept;
  return {
    bytes_before: String(before || '').length,
    bytes_after: String(after || '').length,
    bytes_delta: String(after || '').length - String(before || '').length,
    lines_before: b.length,
    lines_after: a.length,
    lines_added: linesAdded,
    lines_removed: linesRemoved,
    churn: linesAdded + linesRemoved,
    rewrote_whole_file: b.length > 0 && kept < Math.max(1, b.length) * 0.34,
  };
}
