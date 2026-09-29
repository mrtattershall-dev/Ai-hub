#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// presentationAudit.mjs — the three presentation conditions, serialized to bytes and compared.
//
//   node server/presentationAudit.mjs --page legasus/bench/suppression1/s01
//
// A confound hid in a "minor" wrapper difference once already: a feasibility probe compared a native
// FIM request against a hand-built wrapper carrying a separately placed instruction, and moved TWO
// things at once. This asserts, byte for byte, that the code prefix, the suffix, the hole, the
// decoding settings and the token cap are identical across all three conditions, and that the ONLY
// difference is the declared representation.
//
// THE THREE CONDITIONS, named honestly. None of them is "IFIM": that paper's result comes from
// TRAINING on (prefix, instruction, suffix) examples. This package's native template has prefix and
// suffix only, so a hand-built section is an INFERENCE-TIME SURROGATE whose behaviour must be measured,
// never assumed equivalent.
//
//   N  native-FIM / comment intent      the template's own FIM branch; intent in a comment at the hole
//   H  hybrid-wrapper / comment intent  a hand-built ChatML-like wrapper; intent still in that comment
//   S  hybrid-wrapper / separated intent  the same wrapper; intent moved to its own section
//
// AND WHAT EACH COMPARISON MEANS:
//   N vs H   the wrapper / role / token-regime effect, instruction placement held
//   H vs S   the instruction-location effect, wrapper held  <- the diagnostic one
//   N vs S   the whole presentation package; NOT one cause
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const PAGE = opt('page', 'legasus/bench/suppression1/s01');
const NAME = opt('name', 'baseline-as-delivered.html');
const NL = String.fromCharCode(10);
const sha = (t) => createHash('sha256').update(t).digest('hex').slice(0, 16);

const page = readFileSync(join(PAGE, NAME), 'utf8');
const task = JSON.parse(readFileSync(join(PAGE, 'task.json'), 'utf8'));
const r = task.requirement;
const INTENT = `Add a control ${r.trigger.selector}. Clicking it: ${r.effects.join('; ')}. ${(r.invariants || []).join('. ')}.`;

// ── THE CODE HOLE, identical in all three. The top-level statement list ends here. ──
const at = page.lastIndexOf('</script>');
const CODE_PREFIX = page.slice(0, at).replace(/\s+$/, '') + NL;
const SUFFIX = NL + page.slice(at);
const COMMENT_BLOCK = `        // ${INTENT}${NL}        // Continue here:${NL}`;

// Tokens the package's own template uses. Read from it, not invented.
const FIM_PRE = '<|fim_prefix|>', FIM_SUF = '<|fim_suffix|>', FIM_MID = '<|fim_middle|>';
const IM_S = '<|im_start|>', IM_E = '<|im_end|>';

const DECODING = Object.freeze({ temperature: 0.2, num_predict: 400, seed: 1 });

const conditions = {
  N: {
    name: 'native-FIM / comment intent',
    // The template's FIM branch, which an earlier ledger established byte-equivalent to this by hand.
    wire: FIM_PRE + CODE_PREFIX + COMMENT_BLOCK + FIM_SUF + SUFFIX + FIM_MID,
    intentIn: 'comment at the hole', wrapper: 'none (native FIM branch)',
  },
  H: {
    name: 'hybrid-wrapper / comment intent',
    // The SAME comment block, with the wrapper added and nothing else changed. This is the cell the
    // feasibility probe never built, and without it N vs S cannot be attributed.
    wire: IM_S + 'system' + NL + 'You are completing code.' + IM_E + NL
      + FIM_PRE + CODE_PREFIX + COMMENT_BLOCK + FIM_SUF + SUFFIX + FIM_MID,
    intentIn: 'comment at the hole', wrapper: 'ChatML-like system section',
  },
  S: {
    name: 'hybrid-wrapper / separated intent',
    wire: IM_S + 'system' + NL + INTENT + IM_E + NL
      + FIM_PRE + CODE_PREFIX + FIM_SUF + SUFFIX + FIM_MID,
    intentIn: 'its own section', wrapper: 'ChatML-like system section',
  },
};

let problems = 0;
const note = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'BAD '} ${m}`); if (!ok) problems++; };

console.log(`page ${PAGE}${NL}`);
console.log('condition                          intent in            wrapper                      bytes  sha');
for (const [k, c] of Object.entries(conditions)) {
  console.log(`  ${k} ${c.name.padEnd(32)} ${c.intentIn.padEnd(20)} ${c.wrapper.padEnd(28)} ${String(c.wire.length).padStart(5)}  ${sha(c.wire)}`);
}

console.log(`${NL}invariants that must hold across all three`);
// The CODE is the same code in every condition. Extracted back out of each wire form.
const codeOf = (w) => w.slice(w.indexOf(FIM_PRE) + FIM_PRE.length, w.indexOf(FIM_SUF));
const sufOf = (w) => w.slice(w.indexOf(FIM_SUF) + FIM_SUF.length, w.lastIndexOf(FIM_MID));
note(sha(sufOf(conditions.N.wire)) === sha(sufOf(conditions.H.wire))
  && sha(sufOf(conditions.H.wire)) === sha(sufOf(conditions.S.wire)),
  `the SUFFIX is byte-identical in all three (${sha(sufOf(conditions.N.wire))})`);
note(codeOf(conditions.N.wire).startsWith(CODE_PREFIX) && codeOf(conditions.H.wire).startsWith(CODE_PREFIX)
  && codeOf(conditions.S.wire).startsWith(CODE_PREFIX),
  `every condition's prefix begins with the same ${CODE_PREFIX.length} bytes of page code`);
note(sha(codeOf(conditions.N.wire)) === sha(codeOf(conditions.H.wire)),
  'N and H carry an IDENTICAL prefix - so N vs H isolates the wrapper');
note(codeOf(conditions.S.wire) === CODE_PREFIX,
  'S carries the page code with NO comment block - so H vs S isolates instruction location');
note(conditions.H.wire.includes(INTENT) && conditions.S.wire.includes(INTENT) && conditions.N.wire.includes(INTENT),
  'the intent text is present in ALL three - "no comment" never means "no instruction"');
note(conditions.H.wire.slice(0, conditions.H.wire.indexOf(FIM_PRE)) === conditions.S.wire.slice(0, conditions.S.wire.indexOf(FIM_PRE)).replace(INTENT, 'You are completing code.'),
  'H and S differ in their system section ONLY by the text placed in it');

console.log(`${NL}decoding, identical by construction: ${JSON.stringify(DECODING)}`);
console.log(`${NL}what each comparison licenses`);
console.log('  N vs H   the wrapper / role / token-regime effect, instruction placement held');
console.log('  H vs S   the INSTRUCTION-LOCATION effect, wrapper held   <- the diagnostic comparison');
console.log('  N vs S   the whole presentation package. NOT one cause. The feasibility probe ran only this.');
// ── A PRE-REGISTERED PREDICTION, recorded because the evidence points BOTH WAYS ────────────────
// Published work reports that Qwen2.5-Coder, given an alternate instruction-aware format it had
// NO instruction-formatted training for, collapsed on a real-repository benchmark - roughly 0.4%
// against 18.4% in its ordinary FIM mode, recovering only after training. That predicts S < N.
//
// A single local probe pointed the other way: S emitted relevant handler code where N closed the
// document. One page, one seed - not a result.
//
// A possible reconciliation, and it is a HYPOTHESIS: the failing case used a NOVEL delimiter with
// zero training. Condition S introduces no new token. Both `<|im_start|>system` and the FIM markers
// are NATIVE to this package's own template - verified by reading it. So S composes two TRAINED
// formats in an UNTRAINED ARRANGEMENT, which is a different thing from an untrained delimiter. It
// may still be out of distribution; composition is not the same as familiarity.
//
// Declared now so neither outcome can be narrated after the fact:
//   S < N   consistent with the published warning; the arrangement is out of distribution too
//   S > N   composing native formats survives where a novel delimiter did not, and the probe holds
//   S = N   instruction location is not the binding variable for this package on this task
console.log(`${NL}PRE-REGISTERED: published work predicts S < N for an untrained instruction format;`);
console.log('a single local probe pointed the other way. S introduces no novel token - both the ChatML');
console.log('and FIM markers are native here - so it tests an untrained ARRANGEMENT of trained formats.');
console.log('All three outcomes are written down in this file before the run.');

console.log(`${NL}NOT claimed: that S is IFIM. That paper's result comes from TRAINING on (prefix, instruction,`);
console.log('suffix) examples. S is an inference-time surrogate on an off-the-shelf package; if S fails it');
console.log('does not refute that work - the model may never have seen this delimiter or layout.');

console.log(`${NL}${problems === 0 ? 'the three conditions differ ONLY in the declared representation' : `${problems} PROBLEM(S) - do not freeze`}`);
process.exit(problems ? 1 : 0);
