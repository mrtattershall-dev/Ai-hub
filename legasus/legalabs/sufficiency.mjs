// PROMPT SUFFICIENCY — a control that proves the assembler works does not prove the prompt is enough.
//
// THE DEFECT THIS EXISTS FOR, found by the visibility ladder's own W0 rung. Every arm passed its
// apparatus control: feed a perfect fragment, it assembles, it verifies, so the arm can reach 10/10 if
// the model cooperates. W0 then scored 0/20 — and the reason was not the model. With no source line
// visible, W0's prompt never says the parameter is called `n`, so the model wrote `value < 10`,
// `size < 10`, and whole functions named `get_size`. It could not have produced the perfect fragment
// from what it was given.
//
//     an apparatus control proves the ASSEMBLER works
//     it says nothing about whether the PROMPT is sufficient
//
// Those are different questions and the project had a mechanism for only one of them. This is the
// other: every identifier the expected output depends on must be obtainable from the prompt. The
// parameter name is a CURRENT PROGRAM FACT that Legasus holds and simply failed to render — the same
// shape as every other finding here, where the apparatus rather than the model is the variable.
const NL = String.fromCharCode(10);

// Names that need no source: Python's own vocabulary, and the builtins a guard might reach for.
const FREE = new Set(['if', 'elif', 'else', 'return', 'and', 'or', 'not', 'in', 'is', 'None', 'True',
  'False', 'def', 'class', 'for', 'while', 'pass', 'break', 'continue', 'raise', 'lambda', 'yield',
  'len', 'str', 'int', 'float', 'bool', 'abs', 'min', 'max', 'sum', 'round', 'sorted', 'print']);

// String contents are values, not identifiers: `"small"` comes from the delta, never from the source.
function stripStrings(code) {
  return code.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
}

export function identifiersIn(code) {
  const out = new Set();
  for (const m of stripStrings(code).matchAll(/[A-Za-z_]\w*/g)) {
    if (!FREE.has(m[0])) out.add(m[0]);
  }
  return [...out];
}

// Is every identifier the expected output depends on present in the prompt as a word?
//
// Deliberately crude: a whole-word appearance is enough. The question is whether the fact is
// OBTAINABLE, not whether the model will read it correctly - conflating those two would make this
// guard a capability claim instead of an information one.
export function promptSufficiency(prompt, expectedOutput) {
  const needed = identifiersIn(expectedOutput);
  const missing = needed.filter((id) => !new RegExp('(?:^|[^A-Za-z0-9_])' + id + '(?:[^A-Za-z0-9_]|$)').test(prompt));
  return { sufficient: missing.length === 0, needed, missing };
}

export { NL };
