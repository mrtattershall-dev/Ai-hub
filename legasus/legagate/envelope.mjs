// LEGAGATE — THE AUTHORITY ENVELOPE, extracted into one place and given the control it never had.
//
// THE DEFECT THIS EXISTS FOR. The 14B writes `elif n < 10:` where the smaller models write `if`. Placed
// after a branch that returns, an elif chain is valid Python and semantically identical - a LEGAL
// realization of the same contract. The envelope accepted only `if`, so it refused 54 of 60 outputs on
// one shape and the result read as "the 14B is catastrophically bad at S_STRADDLE", p = 2.7e-15 against
// the 7B. It was the apparatus.
//
//     PROVE has had an anti-oracle control since window 10: two legal realizations must both pass.
//     CONSTRAIN never did, and the first model with a different STYLE preference exposed it.
//
// A gate that refuses a correct answer is not being strict. It is measuring itself, and it does so
// invisibly until a model happens to prefer the style it rejects.
//
// THE DEFECT WAS ALSO AN INCONSISTENCY, which is how it survived: the normalizer split one-line `if`
// AND `elif`, the condition extractor read `(?:el)?if`, and only the acceptor insisted on `if`. Three
// functions, two opinions. One module now, one opinion.
//
// WHAT THE ENVELOPE IS FOR, stated so it is not quietly widened later: it bounds the KIND of attempt -
// shape, scope and surface - and nothing else. It must never reason about whether the fragment is
// semantically right. That is PROVE's job, and a leak through this gate is expected and is caught
// downstream; 1116 of 1130 across eight families, with every leak rejected by execution.
const NL = String.fromCharCode(10);

// Surface normalization only: unwrap a fence, drop blank and comment-only lines, and split a one-line
// guard into its two lines. Reshapes whitespace, never meaning.
export function normalizeFragment(text) {
  const fence = String(text).match(/```(?:python)?\s*([\s\S]*?)```/);
  const body = (fence ? fence[1] : String(text)).split(NL);
  const out = [];
  for (const raw of body) {
    if (!raw.trim()) continue;
    if (/^\s*#/.test(raw)) continue;
    const one = raw.match(/^(\s*)((?:if|elif)\b[^:]*:|else\s*:)\s*(\S.*)$/);
    if (one) { out.push(one[1] + one[2]); out.push(one[1] + '    ' + one[3]); continue; }
    out.push(raw);
  }
  return out;
}

// The guard keyword. `elif` is admitted because after a returning branch it is EQUIVALENT, not merely
// tolerable - and the envelope's job is to bound the kind of attempt, not to have a style opinion.
const GUARD = /^\s*(?:if|elif)\s.*:\s*$/;
const RETURN = /^\s*return\s/;

export function guardConditionOf(text) {
  for (const line of normalizeFragment(text)) {
    const m = line.match(/^\s*(?:el)?if\s+(.+?)\s*:\s*$/);
    if (m) return m[1].trim();
  }
  return null;
}

// Authorize exactly one guard and its return, touching nothing that already exists.
//
// `fixedLines` is the set of lines the model was told are fixed. Repeating one is refused here rather
// than repaired, because repairing it would move authority back to the apparatus and make the
// measurement unreadable.
export function authorize(text, fixedLines) {
  const fixed = fixedLines instanceof Set ? fixedLines : new Set(fixedLines || []);
  const body = normalizeFragment(text);
  const got = [];
  for (const raw of body) {
    if (/^\s*def\s/.test(raw)) return { ok: false, reason: 'returned a function' };
    if (fixed.has(raw.trim())) return { ok: false, reason: 'repeated a fixed line' };
    if (GUARD.test(raw) && got.length === 0) { got.push(raw.trim()); continue; }
    if (RETURN.test(raw) && got.length === 1) { got.push(raw.trim()); break; }
  }
  if (got.length !== 2) return { ok: false, reason: 'not exactly one guard and one return' };
  // The guard is re-emitted as `if`: an elif is equivalent only because the preceding branch returns,
  // and normalizing it here means the assembled program does not depend on that remaining true.
  const guard = got[0].replace(/^elif\b/, 'if');
  return { ok: true, code: '    ' + guard + NL + '        ' + got[1], keyword: got[0].split(/\s/)[0] };
}

export { NL };
