// APPLICABILITY DETECTOR — does LegaParse have a structural basis to nominate sites at all?
//
// Frozen BEFORE it sees the sealed substrate. Endpoint preregistered in LEGASUS_V4.md:
//
//     APPLICABILITY        true-apply rate, FALSE-apply rate, abstention rate
//     SITE QUALITY | apply recall, precision, exact set match, inflation ratio
//     SYSTEM COVERAGE      proportion of ALL tasks with an acceptable derived site set
//
// System coverage exists to block the obvious cheat: a detector with beautiful conditional precision
// that refuses nearly everything.
//
// THE DERIVATION PRINCIPLE, unchanged from the 64/74 development work: a feature added "like an existing
// one" occupies the positions the existing one occupies. The detector adds exactly one thing to that -
// the refusal that goal 74 showed was missing:
//
//     the task must NAME a relation, AND that relation must resolve to a feature group in the source
//     otherwise ABSTAIN
//
// deriveSites' fallback to "the richest group when no analogue is named" is deliberately NOT used here.
// That fallback is what made it overreach on goal 74, producing confident wrong sites. Abstention
// replaces it.
//
// NO SECOND HEURISTIC. No special case for any task class. If the principle fails on a class, that is
// evidence about its limits, not a prompt to add another rule.
//
// INPUTS: task.json and source/ ONLY. This module never reads evidence/.
import { featureGroups, deriveSites } from './siteselect.mjs';

// Does the task name a relation to an existing feature? Either an explicit `analogy` field, or
// analogy language in the goal itself ("like the ...", "the same way as ...").
export function namedRelation(task) {
  if (task.analogy && String(task.analogy).trim()) return { named: true, text: String(task.analogy) };
  const g = String(task.goal || '');
  const m = g.match(/\b(?:like|the same way as|written like|same as)\b([^.]*)/i);
  if (m) return { named: true, text: m[0] };
  return { named: false, text: null };
}

export function applicability(task, sourceText, fnName) {
  const rel = namedRelation(task);
  if (!rel.named) {
    return { verdict: 'ABSTAIN', reason: 'the task names no relation to an existing feature', sites: [] };
  }
  const groups = fnName ? featureGroups(sourceText, fnName) : [];
  if (!groups.length) {
    return { verdict: 'ABSTAIN',
      reason: 'no feature group could be resolved in the source, so the named relation has no referent',
      sites: [] };
  }
  // Resolve the named relation to a group by its own symbols. No richest-group fallback.
  const resolved = groups.find((g) => {
    const names = [g.accumulator && g.accumulator.name, g.drain && g.drain.name].filter(Boolean);
    return names.some((n) => new RegExp('\\b' + n.replace(/^_+/, '') + '\\b', 'i')
      .test(rel.text + ' ' + String(task.goal || '')));
  });
  if (!resolved) {
    return { verdict: 'ABSTAIN',
      reason: 'the named relation does not resolve to any feature group in the source',
      sites: [] };
  }
  const d = deriveSites(sourceText, fnName, rel.text + ' ' + String(task.goal || ''));
  if (!d.ok || !d.sites.length) {
    return { verdict: 'ABSTAIN', reason: 'the resolved group yielded no candidate positions', sites: [] };
  }
  return { verdict: 'APPLICABLE', reason: null, sites: d.sites, analogue: d.analogue };
}
