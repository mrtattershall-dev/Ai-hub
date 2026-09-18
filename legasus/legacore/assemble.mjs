// GATE 12E — ASSEMBLE. The composition point, and the only thing the model ever sees.
//
//     WHERE CAN I ACT?          structural contract    legal region, from LegaParse
//     WHAT MUST EXIST FIRST?    transaction contract   requirements and ordering, from LegaCore
//     WHAT MUST THE CODE MEAN?  semantic contract      behaviours, overlap, precedence
//
// THE RULE THAT MAKES THIS WORTH MEASURING: the package states obligations and boundaries, never an
// implementation. No site line, no ordering of statements, no branch shape, no reference identifier,
// no prose paraphrase of the patch. If any of that leaks in, a good score means the apparatus wrote
// the answer and handed it to the model to transcribe.
//
// Every earlier run of the 1.5B predates all three contracts. So the comparison is not "is the model
// better" - the model is byte-identical. The apparatus is the variable.
const NL = String.fromCharCode(10);

// Words that would turn an obligation into an instruction. Checked over the WHOLE rendered package,
// because leakage in a prose sentence is exactly as damaging as leakage in a field.
const IMPLEMENTATION_WORDS = [
  [/\bline\s*\d+/i, 'names a line number'],
  [/\binsert(ing|ion)?\s+(after|before|at)\b/i, 'names an insertion point'],
  [/\belif\b/i, 'names a branch keyword'],
  [/\bplace\s+(it|this|the)?\s*(after|before)\b/i, 'tells the model where to place code'],
  [/\bfirst\s+check\b|\bcheck\s+(it\s+)?first\b/i, 'prescribes an ordering of checks'],
  [/\bop\d+\b/i, 'names an operation id'],
  [/\breference\s+(patch|implementation|solution)\b/i, 'names the reference'],
  [/\bthe\s+patch\b/i, 'names the patch'],
  [/\bcopy\b|\bexactly as (written|shown)\b/i, 'invites transcription'],
];

export function leakageScan(text) {
  return IMPLEMENTATION_WORDS.filter(([re]) => re.test(text)).map(([, why]) => why);
}

// Render a domain as a CONDITION the model can read, without prescribing how to test it.
function renderDomain(d) {
  if (!d) return 'unspecified';
  switch (d.kind) {
    case 'point': return d.variable + ' is exactly ' + d.value;
    case 'complement_point': return d.variable + ' is anything other than ' + d.value;
    case 'universe': return 'any input';
    case 'interval': {
      const parts = [];
      if (d.lo !== -Infinity) parts.push(d.variable + (d.loOpen ? ' > ' : ' >= ') + d.lo);
      if (d.hi !== Infinity) parts.push(d.variable + (d.hiOpen ? ' < ' : ' <= ') + d.hi);
      return parts.length ? parts.join(' and ') : 'any input';
    }
    default: return 'a condition this system could not model';
  }
}

// The package. `structural` and `transaction` are optional so a task with neither still assembles -
// a semantic contract alone is a legitimate bounded problem.
export function assemble({ unit, structural, transaction, semantic }) {
  const L = [];
  L.push('OBLIGATIONS FOR THIS CHANGE');
  L.push('');
  L.push('You are modifying `' + unit + '`.');
  L.push('');

  if (structural) {
    L.push('WHERE YOU MAY ACT');
    L.push('  You may only change ' + structural.scope + '.');
    if (structural.must_not_change && structural.must_not_change.length) {
      L.push('  These must keep their current structure and behaviour:');
      for (const m of structural.must_not_change) L.push('    - ' + m);
    }
    L.push('');
  }

  if (transaction && transaction.requirements && transaction.requirements.length) {
    L.push('WHAT MUST ALREADY EXIST');
    for (const r of transaction.requirements) {
      L.push('  - `' + r.symbol + '` must be available when your code runs'
        + (r.phase === 'deferred' ? ' (only when the function is called)' : ' (as the module loads)'));
    }
    if (transaction.unresolved && transaction.unresolved.length) {
      L.push('  NOT ACCOUNTED FOR by this system, so treat with care:');
      for (const u of transaction.unresolved) L.push('    - `' + u + '`');
    }
    L.push('');
  }

  if (semantic) {
    L.push('WHAT THE CODE MUST MEAN');
    const ex = semantic.behaviors.existing;
    const rq = semantic.behaviors.requested;
    L.push('  Existing behaviour:  when ' + renderDomain(ex.domainDecoded || ex.domain)
      + ', the result is ' + ex.result);
    L.push('  Requested behaviour: when ' + renderDomain(rq.domainDecoded || rq.domain)
      + ', the result is ' + rq.result);
    if (semantic.overlap.status === 'SATISFIABLE') {
      L.push('  These two can both apply - for example when the input is '
        + semantic.overlap.witness + '.');
      if (semantic.precedence && semantic.precedence.winner) {
        const w = semantic.precedence.winner === 'existing' ? ex : rq;
        L.push('  On inputs where both apply, the result must be ' + w.result + '.');
      } else {
        L.push('  The specification does not say which wins where both apply, so this change is not'
          + ' fully determined.');
      }
    } else if (semantic.overlap.status === 'DISJOINT') {
      L.push('  These two can never both apply, so neither interferes with the other.');
    } else {
      L.push('  Whether these can both apply could not be determined by this system.');
    }
    L.push('');
  }

  L.push('HOW YOU WRITE THIS IS YOUR CHOICE. Any implementation satisfying every statement above is');
  L.push('correct. Nothing here tells you the shape of the code.');
  return L.join(NL);
}

export { NL, renderDomain };
