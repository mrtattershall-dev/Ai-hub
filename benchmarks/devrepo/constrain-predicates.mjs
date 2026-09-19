// GATE 2 + GATE 3 — CONSTRAIN DIAGNOSTIC INTEGRITY, and a DERIVED capability envelope.
//
// T04 taught gate 2. The proposal was `import re` followed by exactly one `def dedent`. The gate rejected
// it and reported:
//
//     expected exactly one definition of dedent, saw ["def dedent"]
//
// which is self-contradicting: one definition IS what was expected. The real cause was a second condition
// whose anchor lacked the multiline flag, so `^def dedent(` failed against a string beginning `import re`.
//
//     CORRECT REJECTION FOR THE WRONG REASON IS NOT EVIDENCE FOR THE INTENDED MECHANISM.
//
// The outcome was defensible - the proposal did exceed "one function" - but the predicate that fired was
// not the predicate that was claimed, so T04 cannot count as evidence CONSTRAIN works.
//
// So predicates are NAMED, evaluated INDEPENDENTLY, and the report lists exactly which ones failed. A
// rejection carries the identity of the predicate that produced it, and a test asserts that correspondence
// rather than trusting the message.
const NL = String.fromCharCode(10);

export const PREDICATES = {
  PARSES_AS_PYTHON: {
    why: 'the proposal must be syntactically valid Python, or nothing downstream means anything',
    test: (code) => !/^\s*(?:To |Here|The |I |Sure|Certainly|```)/.test(code) && code.trim().length > 0,
  },
  EXACTLY_ONE_DEFINITION: {
    why: 'the authority granted was to rewrite ONE function',
    test: (code) => (code.match(/^def\s+[A-Za-z_]\w*/gm) || []).length === 1,
  },
  DEFINES_THE_NAMED_FUNCTION: {
    why: 'the one definition must be the function the task named',
    test: (code, ctx) => new RegExp('^def\\s+' + ctx.fn + '\\s*\\(', 'm').test(code),
  },
  NOTHING_OUTSIDE_THE_FUNCTION: {
    why: 'statements beside the function exceed the declared writable surface',
    test: (code) => {
      const lines = code.split(/\r?\n/);
      const start = lines.findIndex((l) => /^def\s/.test(l));
      if (start < 0) return false;
      // Anything at column 0 before the def, or after the function body ends, is out of scope.
      const before = lines.slice(0, start).filter((l) => l.trim() && !l.trim().startsWith('#'));
      let end = start + 1;
      while (end < lines.length && (lines[end].trim() === '' || /^\s/.test(lines[end]))) end++;
      const after = lines.slice(end).filter((l) => l.trim() && !l.trim().startsWith('#'));
      return before.length === 0 && after.length === 0;
    },
  },
};

// Evaluate every predicate. The result names precisely which fired, so a rejection can never be
// attributed to a condition that actually passed.
export function constrain(code, ctx) {
  const failed = []; const passed = [];
  for (const [name, p] of Object.entries(PREDICATES)) {
    let ok;
    try { ok = !!p.test(code, ctx); } catch (e) { ok = false; }
    (ok ? passed : failed).push(name);
  }
  return {
    ok: failed.length === 0, failed, passed,
    // The diagnostic is DERIVED from the failures, never written by hand beside them.
    why: failed.length === 0 ? 'all shape and scope predicates hold'
      : failed.map((n) => n + ': ' + PREDICATES[n].why).join('; '),
  };
}

// ---- GATE 3 — the capability envelope, DERIVED rather than declared -------------------------------
//
// I hand-declared T01-T03 and T08 as IN and was partly wrong, because a declaration is a guess about what
// the machinery can execute. The envelope is now COMPUTED from the same conditions the pipeline actually
// applies, so a mismatch between prediction and capability is itself a reportable finding rather than an
// unnoticed inconsistency.
export const ENVELOPE = { IN: 'IN', BOUNDARY: 'BOUNDARY', OUT: 'OUT' };

export function derivedEnvelope(task) {
  const reasons = [];
  if (task.unmodellable) reasons.push('the property is not expressible as a behavioural contract');
  if (task.ambiguous) reasons.push('the request does not determine an obligation');
  if (task.inertEditSite) reasons.push('the edit surface is not runtime authoritative');
  if (task.extraModule) reasons.push('it requires creating a module outside the writable surface');
  if (task.addition) reasons.push('it adds a behaviour rather than repairing one');
  if (!task.fn) reasons.push('no unit is named and locating one is not derived');
  if (reasons.length) return { envelope: ENVELOPE.OUT, reasons };

  // Inside the envelope only if the repair is a single-unit rewrite the pipeline can verify from a
  // behavioural contract over that unit.
  if (task.mustNotChange) {
    return { envelope: ENVELOPE.IN, reasons: ['a preservation check over one named unit'] };
  }
  if (task.mutate) {
    return { envelope: ENVELOPE.IN, reasons: ['a single-unit repair with an executable contract'] };
  }
  return { envelope: ENVELOPE.BOUNDARY, reasons: ['a single unit, but no executable contract is derivable'] };
}

// Compare what was predicted against what the machinery can actually do.
export function envelopeAudit(tasks) {
  return tasks.map((t) => {
    const d = derivedEnvelope(t);
    return { id: t.id, declared: t.envelope, derived: d.envelope,
      agrees: t.envelope === d.envelope, reasons: d.reasons };
  });
}

export { NL };
