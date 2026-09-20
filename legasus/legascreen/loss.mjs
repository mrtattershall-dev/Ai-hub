// H-LOSS — the three criteria, enforced rather than promised.
//
//     1  UPSTREAM DISTINCTION      the information demonstrably existed before boundary B
//     2  LOSSY BOUNDARY            B maps two distinguishable upstream states onto one representation
//     3  DOWNSTREAM RECONSTRUCTION an authority-bearing operation infers, defaults, or substitutes it
//
// ALL THREE, NAMED SEPARATELY AND CONCRETELY, OR NOT_H_LOSS. There is no interpretive rescue, and
// `classify` throws on an entry that claims the verdict without naming all three - so "the criteria
// were not relaxed" is a measurement.
//
// AND THE OBVIOUS FAILURE MODE OF THIS HYPOTHESIS IS THAT EVERYTHING QUALIFIES. Almost any defect
// can be narrated as information that was once available and later wanted. The guard against that is
// not the classifier; it is the prediction that a real discriminating set exists - entries where a
// criterion genuinely fails - and that set being small is a warning about the hypothesis, not a
// success.
export const CRITERION = { UPSTREAM: 'upstream', BOUNDARY: 'boundary', DOWNSTREAM: 'downstream' };

export const VERDICT = {
  H_LOSS: 'H_LOSS',
  NOT_H_LOSS: 'NOT_H_LOSS',
};

export function classify(entry) {
  const { id, verdict } = entry;
  if (!Object.values(VERDICT).includes(verdict)) throw new Error(id + ': unknown verdict ' + verdict);

  if (verdict === VERDICT.NOT_H_LOSS) {
    if (!entry.fails || !Object.values(CRITERION).includes(entry.fails)) {
      throw new Error(id + ': NOT_H_LOSS must name WHICH criterion fails, or it is an opinion');
    }
    if (!entry.why) throw new Error(id + ': NOT_H_LOSS must say why the criterion fails');
    return { ...entry, criteria: 0 };
  }

  for (const c of Object.values(CRITERION)) {
    const v = entry[c];
    if (typeof v !== 'string' || v.trim().length < 12) {
      throw new Error(id + ': H_LOSS requires the ' + c.toUpperCase() + ' criterion named concretely.'
        + ' An entry that cannot state it is NOT_H_LOSS, not a near miss.');
    }
  }
  return { ...entry, criteria: 3 };
}

// The overlap with H-DEFAULT, which is what decides whether this is a different hypothesis or a
// bigger word for the same one.
export function compareWith(lossRows, defaultRows) {
  const lossIds = new Set(lossRows.filter((r) => r.verdict === VERDICT.H_LOSS).map((r) => r.id));
  const defIds = new Set(defaultRows.filter((r) => r.verdict === 'EXPLAINED').map((r) => r.id));
  const both = [...lossIds].filter((i) => defIds.has(i));
  return {
    lossOnly: [...lossIds].filter((i) => !defIds.has(i)),
    defaultOnly: [...defIds].filter((i) => !lossIds.has(i)),
    both,
    coincide: lossIds.size === defIds.size && both.length === lossIds.size,
  };
}
