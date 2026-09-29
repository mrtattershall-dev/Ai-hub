#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// rescore.mjs — partial credit proven by OBSERVABLE STATE, not by text that describes the work.
//
// FROZEN before any PRESENTATION-1 output was inspected. Validated against two controls that existed
// already: a real comments-only completion from FARMEXT-1, and a hand-written working candidate.
//
// WHY THIS EXISTS. The live scorer in `presentationRun.mjs` is a regex over the raw completion, so
//
//     // I would createElement a button with id="clear-filter"
//     // then addEventListener on it
//
// scores `featureBuilt: true`. FARMEXT-1 produced comments-only completions five times out of five, so
// that is a live inflation path, not a hypothetical one. Partial credit that can be earned by talking
// about the work is another fake success label.
//
// THE THREE FIELDS, and what each can prove:
//
//   parsedLocalReferences  EXECUTABLE code - comments and strings removed - refers to page-local
//                          symbols. Proves syntactic local reference. NOT that the logic is useful:
//                          `const x = field;` refers locally and does nothing.
//   featureConstructed     the control EXISTS in the candidate's DOM and, run through the spec's own
//                          prerequisite sequence, EVERY declared addition effect holds. Two separate
//                          fresh loads, so neither run contaminates the other.
//   accepted              the full new-feature and preservation gate passes. Unchanged.
//
// THE ORIGINAL TALLY IS NOT REPLACED. Both numbers are reported. If they disagree, the disagreement is
// the finding: this model generated language describing the feature more often than it generated
// executable feature construction under that representation.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const NL = String.fromCharCode(10);

/** Comments and string literals blanked, so a mention inside them cannot count as a reference. */
export function executableOnly(text) {
  return String(text)
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split(NL).map((l) => l.replace(/\/\/.*$/, (m) => ' '.repeat(m.length))).join(NL)
    .replace(/`(?:\\.|[^`\\])*`/g, (m) => ' '.repeat(m.length))
    .replace(/'(?:\\.|[^'\\])*'/g, (m) => ' '.repeat(m.length))
    .replace(/"(?:\\.|[^"\\])*"/g, (m) => ' '.repeat(m.length));
}

/**
 * Does EXECUTABLE code refer to the page's own top-level symbols?
 * Proves syntactic local reference and nothing about whether the reference is useful.
 */
export function parsedLocalReferences(completion, pageSymbols) {
  const code = executableOnly(completion);
  const used = pageSymbols.filter((n) => new RegExp(`(?:^|[^.\\w$])${n}(?:[^\\w$]|$)`).test(code));
  return { used, ok: used.length > 0 };
}

/**
 * Does the control EXIST in the candidate's DOM, and does clicking it produce a declared effect?
 * Run, not read. `deps.playCheck` is the same checker every other experiment uses.
 */
export async function featureConstructed(candidate, { task, spec, control, deps }) {
  const ws = mkdtempSync(join(tmpdir(), 'rescore-'));
  try {
    writeFileSync(join(ws, spec.entry || 'index.html'), candidate.endsWith(NL) ? candidate : candidate + NL, 'utf8');
    const addition = task.provenance.additionSteps || [];
    // TWO SEPARATE RUNS, each from a fresh load. The first version used ONE spec holding only the
    // addition steps, which clicked "clear" on a page that had never been filtered - so "everything
    // is visible again" was trivially true and an INERT control scored as constructed. That is the
    // prerequisite-closure defect already found and fixed in obligationMutants, reintroduced here.
    const upToAddition = Math.max(...addition);
    const effectsSpec = { ...spec, contract: 'rescore effects', steps: spec.steps.filter((x) => x.n <= upToAddition) };
    const rEffects = await deps.playCheck(ws, effectsSpec);
    const effects = addition.filter((n) => [...(rEffects.passing || [])].includes(n));

    const probe = {
      ...spec,
      contract: 'rescore: does the control exist at all?',
      steps: [
        // EXISTENCE IS TESTED BY CLICKING IT. An expectation string is evaluated in Node, where
        // `document` does not exist - the first version of this probe used document.querySelector and
        // failed the POSITIVE control while its effects passed, which is how the mistake surfaced.
        // `perform` throws "No element found for selector" when the control is absent, so a click step
        // IS the existence test, run in the real browser.
        { n: 9001, name: 'the control exists (clicking it does not error)', do: [{ kind: 'click', selector: control }], expect: 'true' },
      ],
    };
    const rExists = await deps.playCheck(ws, probe);
    const exists = [...(rExists.passing || [])].includes(9001);
    return { exists, effectsPassed: effects, allAddition: addition, ok: exists && effects.length === addition.length };
  } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
}

/** The page's own top-level symbols, for the reference test. */
export function pageSymbolsOf(page, topLevelFunctions) {
  const fns = topLevelFunctions(page).map((f) => f.name);
  const vars = [...page.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1]);
  return [...new Set([...fns, ...vars])].filter((n) => n.length > 2);
}
