// LEGASCREEN v0 — SCREENING, NOT DIAGNOSIS.
//
// Every authority instrument in this project has been POINTED BY HAND. informationMonotonicity can
// prove that an erasure gained a permission, and it only ever proves it about a transformation
// somebody already suspected. That is how objectivesFromContest dropped an epistemic bound for
// twenty commits and seven green suites while the instrument that describes the defect sat in the
// same directory.
//
// So this does not ask "is this function correct". It enumerates the module surface, applies a
// DECLARED invariant to every transformation it can reach, and reports what looks wrong for someone
// else to judge. A screen that decided would be a verifier with no coverage argument; a screen with
// no false positives would be a screen with no sensitivity.
//
//     SCREEN POSITIVE  ->  a suspicious transformation, for a diagnostic to confirm or dismiss
//     NOT FLAGGED      ->  says nothing. See `unscreened`: a function the seeds could not reach was
//                          never looked at, and that is DIFFERENT from looking and finding nothing.
//
// THE INVARIANT, declared from the laws and not from any defect: a transformation from an object to
// an object must not DROP a field the laws turn on. Evidence, provenance, scope, witness, ancestry,
// grant, context, validity and an epistemic bound are authority-relevant because the laws are about
// them - not because a defect was once found in one.
export const AUTHORITY_FIELDS = new Set([
  'establishes', 'doesNotEstablish',     // an epistemic bound (law 7's own scope)
  'scope', 'context',                    // the world a claim was established in (law 5)
  'provenance', 'producedBy', 'bindings', 'ancestry', 'attribution', 'producer',  // where it came from
  'evidence', 'witness', 'witnesses',    // what supports it (law 1)
  'validity', 'lifecycle', 'state',      // whether it may be relied on
  'grant',                               // what it permits (law 3 / L6)
  'UNADMITTED',                          // recorded-but-not-authoritative (the Entry 11 contract)
  'why',                                 // the reason, which Entry 17 established is not decoration
]);

const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// One screened transformation. `lost` is the finding; everything else is what a diagnostic needs.
function screenCall(fnName, seedName, input, output) {
  if (!isPlain(input) || !isPlain(output)) return null;
  const lost = [...AUTHORITY_FIELDS].filter((f) => Object.hasOwn(input, f) && !Object.hasOwn(output, f));
  if (!lost.length) return null;
  return { fn: fnName, seed: seedName, lost,
    why: fnName + ' received ' + lost.join(', ') + ' and returned an object without '
      + (lost.length > 1 ? 'them' : 'it') + '. A projection may be legitimate; a projection that drops'
      + ' what the laws turn on is where authority gets manufactured out of information loss.' };
}

// THE SEEDS ARE AN INPUT CORPUS, NOT A TARGET LIST. Which functions get screened is mechanical - every
// export of every scanned module. The corpus only decides which of them can be REACHED, and every
// unreached one is reported rather than counted as clean.
export async function screen({ modules, seeds }) {
  const positives = [];
  const unscreened = [];
  let exercised = 0;
  let fnCount = 0;

  for (const spec of modules) {
    let mod;
    if (spec.exports) mod = spec.exports;              // in-memory, so the screen can be tested
    else {
      try { mod = await import(spec.url); } catch (e) {
        unscreened.push({ fn: spec.name + ' (whole module)', why: 'could not be imported: ' + e.message });
        continue;
      }
    }
    for (const [name, value] of Object.entries(mod)) {
      if (typeof value !== 'function') continue;
      fnCount++;
      const fnName = spec.name + '.' + name;
      let reached = false;
      for (const [seedName, make] of Object.entries(seeds)) {
        let input; let output;
        try { input = make(); } catch (e) { continue; }
        try { output = value(input); } catch (e) { continue; }   // wrong shape for this function
        if (output === undefined || output === null) continue;
        reached = true;
        exercised++;
        const hit = screenCall(fnName, seedName, input, output);
        if (hit) positives.push(hit);
      }
      if (!reached) {
        unscreened.push({ fn: fnName,
          why: 'no seed in the corpus produced a call this function accepted, so it was never looked'
            + ' at. NOT FLAGGED here means NOT EXAMINED.' });
      }
    }
  }

  // De-duplicate by (fn, lost): the same erasure found through several seeds is one finding.
  const seen = new Map();
  for (const p of positives) {
    const k = p.fn + '|' + p.lost.join(',');
    if (!seen.has(k)) seen.set(k, { ...p, seeds: [p.seed] });
    else seen.get(k).seeds.push(p.seed);
  }
  return {
    positives: [...seen.values()].sort((a, b) => a.fn.localeCompare(b.fn)),
    unscreened,
    coverage: { functions: fnCount, exercisedCalls: exercised,
      screened: fnCount - unscreened.filter((u) => !u.fn.includes('whole module')).length,
      neverCalled: unscreened.length },
    // A SCREEN THAT CANNOT SAY WHAT IT DID NOT LOOK AT IS THE 452/452 DEFECT WEARING A LAB COAT.
    why: 'positives are SUSPICIONS for a diagnostic, never verdicts; `unscreened` is the part of the'
      + ' surface this run never examined, and a clean positives list says nothing about it.',
  };
}
