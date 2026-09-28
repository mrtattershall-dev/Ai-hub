// LegaParse v5 STAGE 1 — CLAUSE PROVENANCE.
//
// The v2 baseline resolved `state:_hits` instead of `state:_names`, and `state:SCALE` on a task with
// no analogue at all, using tokens that appeared ONLY in a preservation clause. That is not a tie it
// failed to break; it is EVIDENCE LAUNDERING - text acquiring an authority it was never granted, by
// passing through a representation that does not record where it came from.
//
// THE AUTHORITY TABLE, which this file exists to make mechanical:
//
//   RELATION      nominate a concern; disambiguate rivals
//   DELTA         say what new behaviour must exist; derive which roles must change
//   PRESERVATION  constrain changes; name behaviour that must remain.  NEVER nominates
//   INCIDENTAL    nothing
//
// A preservation clause names things PRECISELY BECAUSE THEY ARE NOT THE TARGET. Counting a mention
// there as evidence FOR a concern inverts its meaning, which is why this is an exclusion and not a
// weight. A weight is a threshold in disguise, and thresholds become things to tune against a holdout.
//
// GENERALITY, stated honestly rather than claimed. Classification is by PREDICATE, not by subject: it
// asks what a sentence DOES (requests / preserves / instructs), never which nouns it mentions. A rule
// keyed to "the click and key event types" would be an anchor; a rule keyed to "keep ... working" is a
// fact about English. But it IS a lexicon, and a lexicon has a coverage limit. The families used so
// far phrase preservation fairly uniformly, so this file's segmentation is NOT established as general
// by them - it is established as not-anchored-to-subject-matter, which is a weaker claim and the one
// actually earned.
const NL = String.fromCharCode(10);

// Predicates of PRESERVATION: the sentence's job is to say something must not change.
const PRESERVE = [
  /\bkeep(s|ing)?\b[^.]*\bwork(s|ing)?\b/i,
  /\bkeep(s|ing)?\b[^.]*\bunchanged\b/i,
  /\bmust (still|continue to)\b/i,
  /\bmust keep\b/i,
  /\bstill work(s|ing)?\b/i,
  /\bunchanged\b/i,
  /\bpreserv(e|es|ing)\b/i,
  /\bremain(s|ing)? (the same|unchanged|intact)\b/i,
  /\bcontinue(s)? to\b/i,
  /\bwithout (changing|altering|breaking)\b/i,
  /\bas (they|it) (do|does|did)\b/i,
  /\bexactly as\b/i,
];

// Predicates of INCIDENTAL: execution or environment instructions, carrying no design content.
const INCIDENTAL = [
  /^\s*run\b/i,
  /^\s*use\b[^.]*\bto run\b/i,
  /^\s*do not\b[^.]*\binstall\b/i,
];

// Phrases that NAME a relation. The span they match is the relation clause; the rest of the sentence
// they sit in keeps its own classification.
const RELATION_PHRASE = [
  /\b(?:the\s+)?[\w ]*\bthe same way as\b[^.]*/i,
  /\b(?:the\s+)?[\w ]*\bwritten like\b[^.]*/i,
  /\b(?:the\s+)?[\w ]*\banalogous to\b[^.]*/i,
  /\b(?:the\s+)?[\w ]*\bjust like\b[^.]*/i,
];

// Sentences, keeping the terminator so a trailing fragment is not silently merged into its neighbour.
function sentences(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// THE SEGMENTATION. Returns every clause with its kind and the span of text it covers, so that any
// later claim can name the clause that authorised it.
export function segment(task) {
  const out = [];
  // An explicit analogy field IS the relation clause; nothing has to be inferred from phrasing.
  if (task && task.analogy && String(task.analogy).trim()) {
    out.push({ kind: 'RELATION', text: String(task.analogy).trim(), from: 'analogy field' });
  }
  for (const s of sentences(task && task.goal)) {
    if (INCIDENTAL.some((re) => re.test(s))) { out.push({ kind: 'INCIDENTAL', text: s, from: 'goal' }); continue; }
    // A relation phrase inside the goal is lifted out as its own RELATION clause. The remainder of
    // the sentence is still classified normally - a sentence can both name a relation and request a
    // behaviour, and flattening the two is the defect this file exists to remove.
    let rest = s;
    for (const re of RELATION_PHRASE) {
      const m = s.match(re);
      if (!m) continue;
      out.push({ kind: 'RELATION', text: m[0].trim(), from: 'relation phrase in the goal' });
      rest = s.replace(m[0], ' ').trim();
      break;
    }
    if (!rest) continue;
    out.push({ kind: PRESERVE.some((re) => re.test(rest)) ? 'PRESERVATION' : 'DELTA', text: rest, from: 'goal' });
  }
  return out;
}

// Text of one authority tier. Never call this with two kinds joined - that is the merged haystack.
export function textOf(clauses, kind) {
  return clauses.filter((c) => c.kind === kind).map((c) => c.text).join(' ').toLowerCase();
}

// A convenience view used by the audit record, so a reader can see what each tier was allowed to say.
export function provenanceReport(clauses) {
  const by = {};
  for (const c of clauses) (by[c.kind] = by[c.kind] || []).push(c.text);
  return {
    RELATION: by.RELATION || [], DELTA: by.DELTA || [],
    PRESERVATION: by.PRESERVATION || [], INCIDENTAL: by.INCIDENTAL || [],
    authority: {
      RELATION: 'may nominate and disambiguate concerns',
      DELTA: 'may determine required behaviour and which roles must change; may NOT nominate',
      PRESERVATION: 'may constrain changes; may NEVER nominate the target concern',
      INCIDENTAL: 'no authority',
    },
  };
}

export { NL };
