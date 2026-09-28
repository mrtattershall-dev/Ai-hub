// LEGARENDER — NONINTERFERENCE. The mirror of sufficiency.
//
// `sufficiency.mjs` exists because the W0 rung was void: the prompt never named a fact the operation
// needed, and the model was scored for failing to use information it did not have.
//
//     SUFFICIENCY      does the prompt contain every fact required for the authorized operation?
//
// This module exists because the opposite defect was then measured, and it is worse. Naming another
// operation's semantic domain caused CROSS-OBLIGATION CAPTURE: an operation shown a sibling's domain
// began implementing the sibling's domain. `low`, asked for n < 10, wrote n < 0 in 31.6% of the guards
// that had a same-shape narrower sibling in view. Being told other operations merely EXIST was harmless
// (0 of 240). It is the foreign semantic content that does the damage.
//
//     NONINTERFERENCE  does the prompt OMIT semantic facts belonging to other operations?
//
// Not too little, and NOT TOO MUCH.
//
// WHAT COUNTS AS THE OPERATION'S OWN, and this distinction is the whole design:
//
//     its own requested domain and result          REQUIRED - sufficiency demands it
//     the PRESERVED behaviour it must not break     REQUIRED - it is part of this operation's contract
//     the fixed source it is editing                REQUIRED - it is the thing being changed
//     a SIBLING operation's domain or result        FOREIGN - this is what must not appear
//
// The preserved behaviour is the case that makes this subtle. `n != 3` appears in 167 guards and is
// correct: every prompt names the preserved fact because the operation is obliged not to break it. A
// checker that flagged it would reject every legitimate prompt in the corpus.
//
// AND THE LAW APPLIES HERE TOO. A stage with the authority to reject must prove it can admit legitimate
// alternatives, so the tests beside this module include real prompts from the measured corpus that must
// pass, and both negative controls.
const NL = String.fromCharCode(10);

// A domain expression, in the forms the renderer and the models actually produce. Written as explicit
// character classes rather than the word-boundary escape, per hazard 1.
const COMPARISON = /(^|[^A-Za-z0-9_])([A-Za-z_][A-Za-z0-9_]*)\s*(<=|>=|==|!=|<|>)\s*(-?[0-9]+)/g;

// Every (variable, operator, literal) triple a piece of text asserts.
export function domainClaims(text) {
  const out = [];
  const s = String(text || '');
  COMPARISON.lastIndex = 0;
  let m = COMPARISON.exec(s);
  while (m) {
    out.push({ variable: m[2], op: m[3], value: Number(m[4]) });
    m = COMPARISON.exec(s);
  }
  return out;
}

const sameClaim = (a, b) => a.variable === b.variable && a.op === b.op && a.value === b.value;

// Natural-language bounds the renderer emits, e.g. "below 10", "above 100", "exactly 5".
const PHRASE = /(below|under|less than|above|over|greater than|exactly|equal to)\s+(-?[0-9]+)/gi;

export function phraseClaims(text) {
  const out = [];
  const s = String(text || '');
  PHRASE.lastIndex = 0;
  let m = PHRASE.exec(s);
  while (m) {
    out.push({ phrase: m[1].toLowerCase(), value: Number(m[2]) });
    m = PHRASE.exec(s);
  }
  return out;
}

// Does the rendered prompt leak semantic content belonging to another operation?
//
//   prompt    the rendered text handed to the model
//   own       { domainText, result }        this operation's own contract, which MUST appear
//   context   { domainText, result }[]      facts that legitimately belong to this operation:
//                                           the preserved behaviour, the existing source
//   foreign   { id, domainText, condition, result }[]   the other operations' contracts, which must
//                                           NOT appear. `domainText` is the prose the renderer would
//                                           emit; `condition` is the planner's canonical form (n < 0).
//                                           Both are checked, because a leak can arrive as prose OR as
//                                           code, and the corpus contains both.
//
// A foreign fact is reported when the prompt asserts a bound or a result label that belongs to a
// sibling and is not also part of this operation's own contract or its legitimate context. An operation
// whose own domain coincides with a sibling's is not a leak - it is a specification the planner should
// never have produced, and `ordering.mjs` refuses it upstream.
export function noninterference({ prompt, own, context = [], foreign = [] }) {
  const text = String(prompt || '');
  const mine = [...domainClaims(own && own.domainText), ...context.flatMap((c) => domainClaims(c.domainText))];
  const myPhrases = [...phraseClaims(own && own.domainText),
    ...context.flatMap((c) => phraseClaims(c.domainText))];
  const myResults = new Set([own && own.result, ...context.map((c) => c.result)].filter(Boolean));

  const inPrompt = domainClaims(text);
  const phrasesInPrompt = phraseClaims(text);
  const leaks = [];

  for (const f of foreign) {
    const foreignClaims = [...domainClaims(f.domainText), ...domainClaims(f.condition)];
    for (const claim of foreignClaims) {
      if (mine.some((x) => sameClaim(x, claim))) continue;
      if (inPrompt.some((x) => sameClaim(x, claim))) {
        leaks.push({ operation: f.id, kind: 'domain',
          detail: claim.variable + ' ' + claim.op + ' ' + claim.value });
      }
    }
    for (const ph of phraseClaims(f.domainText)) {
      if (myPhrases.some((x) => x.phrase === ph.phrase && x.value === ph.value)) continue;
      if (phrasesInPrompt.some((x) => x.phrase === ph.phrase && x.value === ph.value)) {
        leaks.push({ operation: f.id, kind: 'domain_phrase', detail: ph.phrase + ' ' + ph.value });
      }
    }
    if (f.result && !myResults.has(f.result) && text.includes(f.result)) {
      leaks.push({ operation: f.id, kind: 'result', detail: f.result });
    }
  }

  // Deduplicate: the same fact rendered twice is one leak, not two.
  const seen = new Set();
  const unique = leaks.filter((l) => {
    const k = l.operation + '|' + l.kind + '|' + l.detail;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { ok: unique.length === 0, leaks: unique };
}

// The two obligations together. A renderer that satisfies one and not the other is not correct.
export function checkProjection({ prompt, own, context, foreign, requiredFacts = [] }) {
  const missing = requiredFacts.filter((f) => !String(prompt || '').includes(f));
  const ni = noninterference({ prompt, own, context, foreign });
  return { ok: missing.length === 0 && ni.ok, missing, leaks: ni.leaks };
}

export { NL };
