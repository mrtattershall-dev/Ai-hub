// Shared harness for the ABSENCE-ASSERTION experiment. Frozen per ABSENCE-ASSERTION_PREREG.md
// (71969bb + amendments 1 and 2). Both arms and the declared non-arm checker use THIS file and
// nothing else to touch the corpus, so evidence and charging are identical by construction.
//
// SPEC NOTE (recorded, pre-implementation): the prereg's naive-scope rule reads "the enclosing
// function, plus or minus 170 lines". "Enclosing function" is not deterministic in a 40,926-line
// HTML file with inline script and monkey-patch wrappers, so the implemented rule is the
// deterministic half: anchor +/- 170 lines. On the development case this reproduces the real
// region defect (25560-25900) exactly. The vaguer half is dropped rather than guessed at.

import { readFileSync } from 'node:fs';

/** Permitted analyses and their unit costs. Amendment 2, A2.1. */
export const COSTS = {
  grep: { analysis: 1, annotation: 0 },
  identifierSet: { analysis: 1, annotation: 0 },
  computedAccessSites: { analysis: 1, annotation: 0 },
  readRange: { analysis: 1, annotation: 0 },
  askHuman: { analysis: 1, annotation: 1 },
};

/** Per claim, identical for both arms. Exhaustion is a legitimate stopping point, not a failure. */
export const BUDGET = { analysis: 12, annotation: 2 };

export const DECISION = {
  ACCEPT: 'ACCEPT',
  REFUSE: 'REFUSE',
  UNRESOLVED: 'UNRESOLVED_UNDER_FROZEN_ANALYSIS',
};

/** Claim meanings (A2.2). The answer key is built under the SAME meaning the claim carries. */
export const MEANING = {
  LITERAL: 'LITERAL',        // no literal occurrence of the token in the asserted scope
  DIRECT_REF: 'DIRECT_REF',  // no direct syntactic reference to the binding
  RUNTIME: 'RUNTIME',        // the access never occurs at run time
};

export class Ledger {
  constructor(budget = BUDGET) {
    this.budget = budget;
    this.spent = { analysis: 0, annotation: 0 };
    this.log = [];
  }
  /** @returns {boolean} true if the analysis was affordable and has been charged. */
  afford(kind) {
    const c = COSTS[kind];
    if (this.spent.analysis + c.analysis > this.budget.analysis) return false;
    if (this.spent.annotation + c.annotation > this.budget.annotation) return false;
    this.spent.analysis += c.analysis;
    this.spent.annotation += c.annotation;
    this.log.push(kind);
    return true;
  }
  get exhausted() {
    return this.spent.analysis >= this.budget.analysis;
  }
  get cost() {
    return { ...this.spent, total: this.spent.analysis + this.spent.annotation };
  }
}

export function loadCorpus(path) {
  const text = readFileSync(path, 'utf8');
  return { path, text, lines: text.split('\n') };
}

const IDENT = /[A-Za-z_$][A-Za-z0-9_$]*/g;

/** Sentinel returned when the budget refuses an analysis. Arms must handle it, not ignore it. */
export const DENIED = Symbol('budget-denied');

export function grep(corpus, ledger, query, { ci = false, from = 1, to = Infinity } = {}) {
  if (!ledger.afford('grep')) return DENIED;
  const hi = Math.min(to, corpus.lines.length);
  const needle = ci ? query.toLowerCase() : query;
  const hits = [];
  for (let i = Math.max(1, from); i <= hi; i++) {
    const line = ci ? corpus.lines[i - 1].toLowerCase() : corpus.lines[i - 1];
    if (line.includes(needle)) hits.push(i);
  }
  return { query, ci, from: Math.max(1, from), to: hi, hit_count: hits.length, hit_lines: hits };
}

/** Every identifier occurring in a line range. This is what makes a query's adequacy checkable
 *  against the code rather than against the searcher's belief about the code. */
export function identifierSet(corpus, ledger, from = 1, to = Infinity) {
  if (!ledger.afford('identifierSet')) return DENIED;
  const hi = Math.min(to, corpus.lines.length);
  const set = new Set();
  for (let i = Math.max(1, from); i <= hi; i++) {
    const m = corpus.lines[i - 1].match(IDENT);
    if (m) for (const id of m) set.add(id);
  }
  return set;
}

/** Sites where a name could be reached without appearing literally. A2.2: lexical evidence is
 *  insufficient for RUNTIME meaning, and these are why. */
export function computedAccessSites(corpus, ledger, from = 1, to = Infinity) {
  if (!ledger.afford('computedAccessSites')) return DENIED;
  const hi = Math.min(to, corpus.lines.length);
  const sites = [];
  for (let i = Math.max(1, from); i <= hi; i++) {
    const l = corpus.lines[i - 1];
    if (/\beval\s*\(/.test(l)) sites.push({ line: i, kind: 'eval' });
    else if (/\[\s*(['"`]?\s*\w*\s*['"`]?\s*\+|\w+\s*\+)/.test(l)) sites.push({ line: i, kind: 'computed-concat' });
    else if (/\[\s*[a-z_$][\w$]*\s*\]\s*=/.test(l)) sites.push({ line: i, kind: 'computed-var' });
  }
  return sites;
}

export function readRange(corpus, ledger, from, to) {
  if (!ledger.afford('readRange')) return DENIED;
  return corpus.lines.slice(Math.max(0, from - 1), to).join('\n');
}

/** The ONLY channel through which a human fact enters an arm. Charged to both arms identically
 *  (A2.3): charging Legasus for human input while the baseline gets it free would rig it. */
export function askHuman(ledger, question, oracle) {
  if (!ledger.afford('askHuman')) return DENIED;
  return oracle(question);
}

/** The frozen naive searcher. Produces the INITIAL record only (A1.1). Its two defects - a
 *  case-sensitive core-token query, and a window around the anchor - arise from the rule, not
 *  from my choosing where to put them. */
export function naiveRecord(corpus, claim) {
  const core = (claim.subject.match(/[A-Za-z]+/g) || [''])
    .reduce((a, b) => (b.length > a.length ? b : a), '');
  const from = Math.max(1, claim.anchor - 170);
  const to = Math.min(corpus.lines.length, claim.anchor + 170);
  const free = new Ledger({ analysis: Infinity, annotation: Infinity });
  const r = grep(corpus, free, core, { ci: false, from, to });
  return { query: core, ci: false, from, to, hit_count: r.hit_count, hit_lines: r.hit_lines,
    generator: 'naive: longest alphabetic run of the subject, original case; anchor +/- 170' };
}

/** Does the union of searched ranges contain the scope the claim asserts? Pure geometry - it is
 *  NOT the answer key, and neither arm's own judgement substitutes for the key (A1.3). */
export function scopeContained(asserted, searched) {
  const merged = [...searched].sort((a, b) => a.from - b.from).reduce((acc, s) => {
    const last = acc[acc.length - 1];
    if (last && s.from <= last.to + 1) last.to = Math.max(last.to, s.to);
    else acc.push({ from: s.from, to: s.to });
    return acc;
  }, []);
  return merged.some((m) => m.from <= asserted.from && m.to >= asserted.to);
}

/** G2 (Amendment 3.2): the subject with its leading camelCase segment removed, original case.
 *  `_bondForeclosureFired` -> `foreclosureFired`. This is the query I actually used, stated as a
 *  rule, because G1 yields the whole camelCase name and so never produces a spelling mismatch.
 *  Assignment between G1 and G2 is fixed by the case's axis-2 value, never chosen per claim. */
export function naiveRecordG2(corpus, claim) {
  const bare = claim.subject.replace(/^[_$]+/, '');
  const segs = bare.split(/(?=[A-Z])/);
  const tail = segs.length > 1 ? segs.slice(1).join('') : bare;
  // lowercase the new leading letter: a dropped prefix leaves an ordinary camelCase word.
  // Without this the query keeps the capital F and still matches - i.e. it does NOT
  // reproduce the defect. Verified against the corpus, not assumed.
  const query = tail.charAt(0).toLowerCase() + tail.slice(1);
  const from = Math.max(1, claim.anchor - 170);
  const to = Math.min(corpus.lines.length, claim.anchor + 170);
  const free = new Ledger({ analysis: Infinity, annotation: Infinity });
  const r = grep(corpus, free, query, { ci: false, from, to });
  return { query, ci: false, from, to, hit_count: r.hit_count, hit_lines: r.hit_lines,
    generator: 'G2: subject minus leading camelCase segment, original case; anchor +/- 170' };
}
