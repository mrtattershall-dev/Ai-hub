// LEGASCREEN — THE PROBES. One harness, several invariants, each stated as a GENERAL PROPERTY.
//
// The bar this is written against: a probe that needs the defect's file, function, field or commit
// named in it is a special case wearing a scanner's clothes. Each probe below states a property and
// is run over an enumerated or generated space; the historical defects are things those spaces happen
// to contain, not things the probes were pointed at.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUTHORITY_FIELDS } from './erasure.mjs';

const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// ---------------------------------------------------------------------------------------------
// P-ALIAS — a state word owned by more than one module is a POTENTIAL SEMANTIC ALIAS.
//
// Generalized from the frozen inventory of Entry 18: that test asserts a known set, which catches a
// CHANGE. This reports the set itself, for any tree, so it can be asked of a commit that predates the
// inventory. It CLASSIFIES NOTHING - `ledger.CONTESTED` and `provenance.CONTESTED` being the same
// string is a suspicion, and whether an obligation travels is the diagnostic's question.
export function probeAlias({ target, dir = 'legasus/legaknow' }) {
  const owner = new Map();
  const add = (word, file) => {
    const s = owner.get(word) || owner.set(word, new Set()).get(word);
    s.add(file);
  };
  let files = [];
  try { files = readdirSync(join(target, dir)).filter((f) => f.endsWith('.mjs') && !f.includes('.test.')); }
  catch (e) { return { positives: [], unscreened: [{ fn: dir, why: 'not present in this tree' }], examined: 0 }; }
  for (const f of files) {
    const src = readFileSync(join(target, dir, f), 'utf8');
    for (const m of src.matchAll(/export const \w+ = '([^']+)'/g)) add(m[1], f);
    for (const m of src.matchAll(/export const \w+ = \{([^}]*)\}/g)) {
      for (const k of m[1].matchAll(/\w+: '([^']+)'/g)) add(k[1], f);
    }
  }
  const positives = [...owner.entries()].filter(([, v]) => v.size > 1)
    .map(([word, v]) => ({ probe: 'ALIAS', subject: word, owners: [...v].sort(),
      why: 'the state word "' + word + '" is owned by ' + v.size + ' modules (' + [...v].sort().join(', ')
        + '). If either owner attaches an obligation to it, the obligation can travel on a string'
        + ' match. SUSPICION ONLY - a diagnostic decides whether the semantics actually differ.' }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
  return { positives, unscreened: [], examined: owner.size, files: files.length };
}

// ---------------------------------------------------------------------------------------------
// P-COMPOSITION — LENGTHENING A JUSTIFICATION PATH MUST NOT GRANT WHAT THE DIRECT PATH REFUSES.
//
// Metamorphic, and the probe knows nothing about which dimension, which value, or that `null` is
// special. It builds every three-node chain over a small scope domain, builds the two-node graph
// with the SAME endpoints, and asks entitlement of both. A refusal that becomes an admission when a
// node is INSERTED is authority appearing between the edges - law 5's own sentence, tested rather
// than trusted.
//
// INSERTION CANNOT ADD EVIDENCE. The intermediate carries no evidence of its own; it only relays. So
// any entitlement the chain has and the direct edge lacks came from the relay, which is the defect
// shape regardless of what produced it.
export async function probeComposition({ target, values = [null, 'ANY', 'S1', 'S2'],
  dimension = 'repository' }) {
  const url = new URL('file://' + join(target, 'legasus/legaknow/justification.mjs').replace(/\\/g, '/')).href;
  let J;
  try { J = await import(url); } catch (e) {
    return { positives: [], unscreened: [{ fn: 'justification.mjs', why: 'not importable: ' + e.message }],
      examined: 0 };
  }
  const { graph, add, node, entitled, scope, NODE, ANY } = J;
  const resolve = (v) => (v === 'ANY' ? ANY : v);
  const sc = (v) => scope({ [dimension]: resolve(v) });

  const positives = [];
  let examined = 0;
  for (const a of values) {
    for (const c of values) {
      // THE DIRECT GRAPH: A supports C.
      const g1 = graph();
      const a1 = node({ kind: NODE.OBSERVATION, proposition: 'A', scope: sc(a), basis: 'W' });
      const c1 = node({ kind: NODE.CLAIM, proposition: 'C', scope: sc(c), basis: 'D', supports: [a1.id] });
      add(g1, a1); add(g1, c1);
      let direct;
      try { direct = entitled(g1, c1.id, scope({})).ok; } catch (e) { continue; }

      for (const m of values) {
        // THE CHAINED GRAPH: same endpoints, one relay inserted.
        const g2 = graph();
        const a2 = node({ kind: NODE.OBSERVATION, proposition: 'A', scope: sc(a), basis: 'W' });
        const m2 = node({ kind: NODE.INTERPRETATION, proposition: 'M', scope: sc(m), basis: 'D',
          supports: [a2.id] });
        const c2 = node({ kind: NODE.CLAIM, proposition: 'C', scope: sc(c), basis: 'D',
          supports: [m2.id] });
        add(g2, a2); add(g2, m2); add(g2, c2);
        let chained;
        try { chained = entitled(g2, c2.id, scope({})).ok; } catch (e) { continue; }
        examined++;
        if (!direct && chained) {
          positives.push({ probe: 'COMPOSITION',
            subject: dimension + ': A=' + String(a) + ' -> M=' + String(m) + ' -> C=' + String(c),
            why: 'the direct edge A -> C is REFUSED at these scopes and the chain A -> M -> C is'
              + ' ADMITTED. The inserted node carries no evidence of its own, so the entitlement came'
              + ' from the relay: authority appearing between the edges.' });
        }
      }
    }
  }
  return { positives, unscreened: [], examined };
}

// ---------------------------------------------------------------------------------------------
// P-ERASURE — v0's invariant, re-expressed as a probe over a supplied corpus so the harness can run
// all three the same way. Unchanged in substance: an object -> object transformation must not drop a
// field the laws turn on.
export function probeErasureOver({ exports: mod, seeds, moduleName }) {
  const positives = [];
  const unscreened = [];
  let examined = 0;
  for (const [name, value] of Object.entries(mod)) {
    if (typeof value !== 'function') continue;
    const fnName = moduleName + '.' + name;
    let reached = false;
    for (const [seedName, make] of Object.entries(seeds)) {
      let input; let output;
      try { input = make(); } catch (e) { continue; }
      try { output = value(input); } catch (e) { continue; }
      if (!isPlain(input) || !isPlain(output)) continue;
      reached = true;
      examined++;
      const lost = [...AUTHORITY_FIELDS].filter((f) => Object.hasOwn(input, f) && !Object.hasOwn(output, f));
      if (lost.length) {
        positives.push({ probe: 'ERASURE', subject: fnName, lost, seed: seedName,
          why: fnName + ' received ' + lost.join(', ') + ' and returned an object without them.' });
      }
    }
    if (!reached) {
      unscreened.push({ fn: fnName,
        why: 'no seed produced a call this function accepted. NOT FLAGGED means NOT EXAMINED.' });
    }
  }
  // one finding per (function, lost-set)
  const seen = new Map();
  for (const p of positives) {
    const k = p.subject + '|' + p.lost.join(',');
    if (!seen.has(k)) seen.set(k, { ...p, seeds: [p.seed] }); else seen.get(k).seeds.push(p.seed);
  }
  return { positives: [...seen.values()], unscreened, examined };
}
