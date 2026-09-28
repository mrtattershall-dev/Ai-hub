// GATE 13 — the conformance audit must say WHICH ORACLE it is judging against, and close the gap
// rather than report it as a failure.
//
// THE DEFECT, and it is the fifth occurrence of this project's most expensive class: reporting code
// that cannot express what it measures.
//
// P3 (`NO OVER-CONSTRAINT`) asks whether every position a rule removed genuinely fails. It answers by
// looking up `failing_positions` in the family's sealed ground truth. But `failing_positions` means
// two different things depending on when the family was authored:
//
//     V1 families   behavioural only    a position that loads and passes the probes is "passing"
//     V2 families   both channels       ... and must also preserve existing structure
//
// So on a V1 family, a position that executes fine while silently re-parenting existing statements is
// recorded as passing. A structural rule that correctly removes it is then scored as an
// OVER-CONSTRAINT. That is exactly what `scopecont/j01:op3` has been reporting: `ownership_boundary`
// removes a position where inserting a class-level `def` ends `resolve` early and re-parents the rest
// of its body - a real destruction the sealed probes never call.
//
// TWO THINGS THIS DELIBERATELY DOES NOT DO:
//
//   It does not edit sealed ground truth. History stays history, and `oracle_version` is DERIVED from
//   the row's shape rather than written back into artifacts that have already been scored.
//
//   It does not excuse the gap. "Undecidable" reported as a third bucket would be an audit admitting
//   it cannot judge, which is how a real over-constraint hides. Instead the missing channel is run
//   LIVE against that one position, and the verdict carries the witness it produced. An unjustified
//   removal still fails P3 - and the test beside this file proves it can, because an adjudicator that
//   only ever returns "justified" would make P3 unfailable and is the obvious way this fix goes wrong.
import { structurePreserved, NL } from './structure.mjs';

// V2 rows carry `oracle_version` because `proveTaskV2` writes it. V1 rows predate the field. Reading
// the shape means no sealed file is touched and no judgement call is recorded as data.
export function oracleVersion(row) {
  return row && row.oracle_version ? row.oracle_version : 'V1';
}

export function insertAfterLine(text, pos, code) {
  const lines = text.split(NL);
  return lines.slice(0, pos + 1).join(NL) + NL + code.replace(/\n$/, '') + NL
    + lines.slice(pos + 1).join(NL);
}

// Was this rule entitled to remove this position?
//
//   justified        the position genuinely fails - the seal said so, or the structural channel does
//   over_constraint  both channels say the position is fine, so the rule removed a legal option
//
// `channel` records how the verdict was reached, because a verdict from a live re-derivation and a
// verdict read out of a seal are not the same kind of evidence and must not be reported as if they
// were.
export function adjudicateRemoval({ base, code, position, row }) {
  const version = oracleVersion(row);
  const sealedFailing = new Set(row.failing_positions || []);

  if (sealedFailing.has(position)) {
    return { verdict: 'justified', channel: 'sealed', oracle: version,
      why: 'the sealed oracle records this position as failing' };
  }

  if (version === 'V2') {
    // A V2 seal already ran both channels, so its `failing_positions` is complete. Nothing left to ask.
    return { verdict: 'over_constraint', channel: 'sealed', oracle: version,
      why: 'the V2 oracle ran both channels and recorded this position as legal' };
  }

  // V1: the seal could not see structural destruction. Ask that channel now, about this position only.
  const count = (code.endsWith(NL) ? code.slice(0, -1) : code).split(NL).length;
  const after = insertAfterLine(base, position, code);
  const st = structurePreserved(base, after, { pos: position, count });
  if (st.preserved) {
    return { verdict: 'over_constraint', channel: 'structural_live', oracle: version,
      why: 'the V1 seal saw no behavioural failure and the structural channel finds no violation either' };
  }
  return { verdict: 'justified', channel: 'structural_live', oracle: version,
    why: 'behaviourally legal under the V1 seal, but the structural channel finds destruction the'
      + ' sealed probes never call',
    witness: st.violations.slice(0, 2) };
}

export { NL };
