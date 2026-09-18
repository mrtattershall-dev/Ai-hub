// CONTRACT vs BASELINE on Qwen2.5-Coder-1.5B.
//
// The model is the constant. Both arms get the identical source, model, temperature and token budget;
// only the framing of the request differs. Anything that differs between the arms therefore belongs to
// the apparatus.
//
// RULE 3 IS ENFORCED BEFORE ANY GENERATION: the endpoint must NAME the exact model. A run against an
// unverified model measures nothing, and this project has paid for that before.
//
// SCORING IS BY EXECUTION, NEVER BY COMPARISON TO A REFERENCE. Two structurally different correct
// answers must both count, which is the property GATE 12D established and the reason a reference
// comparison would silently reintroduce the oracle.
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assemble, leakageScan } from '../legacore/assemble.mjs';
import { existingBehaviours, requestedBehaviour } from '../legacore/predicates.mjs';
import { overlap } from '../legacore/overlap.mjs';
import { derivePrecedence } from '../legacore/precedence.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

const BASE = process.argv[2];                        // https://...modal.run
const MODEL = 'qwen2.5-coder:1.5b';
const SAMPLES = Number(process.argv[3] || 10);
const TEMPERATURE = 0.6;                             // identical across arms; it cannot bias a contrast
const NUM_PREDICT = 400;
const OUT = process.argv[4] || './RESULT.contract-1p5b.json';

const SRC = L(
  'def classify(n):',
  '    if n < 0:',
  '        return "negative"',
  '    if n == 0:',
  '        return "zero"',
  '    return "positive"',
);

// The two halves of the must-distinguish pair. Identical program, identical new predicate.
const CASES = {
  A: {
    goal: 'Update classify in classify.py so that values below 10 return "small". '
      + 'Preserve the existing special handling of zero. Keep negative handling unchanged.',
    delta: 'For other values below 10, return "small".',
    preservation: 'Preserve the existing special handling of zero.',
    contested_expected: 'zero',
  },
  B: {
    goal: 'Update classify in classify.py so that values below 10 return "small", '
      + 'including values that previously returned "zero". Keep negative handling unchanged.',
    delta: 'Values below 10 should now return "small", including values that previously returned "zero".',
    preservation: null,
    contested_expected: 'small',
  },
};

const zero = existingBehaviours(SRC, 'classify').find((b) => b.condition === 'n == 0');

function contractPrompt(c) {
  const req = requestedBehaviour(c.delta, 'n', { soleParameter: true });
  const ov = overlap(zero.domain, req.domain);
  const prec = derivePrecedence({ preservation_text: c.preservation, delta_text: c.delta,
    existing: { condition: zero.condition, result: zero.result },
    requested: { condition: req.condition, result: req.result } }, ov);
  const pkg = assemble({
    unit: 'classify',
    structural: { scope: 'the body of `classify`',
      must_not_change: ['the result for negative inputs', 'the result for inputs of 10 or more'] },
    transaction: { requirements: [] },
    semantic: {
      behaviors: { existing: { domain: zero.domain, result: zero.result },
        requested: { domain: req.domain, result: req.result } },
      overlap: ov.result === 'SATISFIABLE' ? { status: 'SATISFIABLE', witness: ov.witness }
        : { status: ov.result },
      precedence: prec.outcome === 'PRECEDENCE' ? { winner: prec.winner } : null,
    },
  });
  return { pkg, text: L(pkg, '', 'CURRENT CODE', '', SRC, '',
    'Reply with the complete updated function and nothing else.') };
}

const baselinePrompt = (c) => L(c.goal, '', 'CURRENT CODE', '', SRC, '',
  'Reply with the complete updated function and nothing else.');

async function generate(prompt) {
  const r = await fetch(BASE.replace(/\/$/, '') + '/api/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false,
      options: { temperature: TEMPERATURE, num_predict: NUM_PREDICT } }),
  });
  if (!r.ok) throw new Error('generate ' + r.status);
  return (await r.json()).response || '';
}

// Take the function out of whatever wrapping the model produced. No reference is consulted.
function extractFunction(text) {
  const fenced = text.match(/```(?:python)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const at = body.indexOf('def classify');
  if (at < 0) return null;
  const lines = body.slice(at).split(NL);
  const out = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() && !/^\s/.test(l)) break;
    out.push(l);
  }
  return out.join(NL).replace(/\s+$/, '');
}

// CONFORMANCE BY EXECUTION. The contested input must give the ruling's result; the uncontested inputs
// must give each domain's own result; the preserved behaviour must still hold.
function conforms(fn, expectedContested) {
  if (!fn) return { parsed: false, conforms: false };
  const ws = mkdtempSync(join(tmpdir(), 'c1p5b-'));
  writeFileSync(join(ws, 'impl.py'), fn + NL, 'utf8');
  const probe = L('import impl',
    'print("C=" + str(impl.classify(0)))',
    'print("S=" + str(impl.classify(5)))',
    'print("N=" + str(impl.classify(-3)))',
    'print("P=" + str(impl.classify(50)))');
  writeFileSync(join(ws, 'p.py'), probe, 'utf8');
  try {
    const out = execFileSync('python', ['p.py'], { cwd: ws, encoding: 'utf8', timeout: 15000 });
    const g = (k) => (out.match(new RegExp(k + '=(.*)')) || [])[1].trim();
    const res = { parsed: true, contested: g('C'), small: g('S'), neg: g('N'), pos: g('P') };
    res.conforms = res.contested === expectedContested && res.small === 'small'
      && res.neg === 'negative' && res.pos === 'positive';
    return res;
  } catch (e) { return { parsed: true, conforms: false, error: String(e.message).slice(0, 80) }; }
}

// ---- Rule 3 first, then anything else.
const tags = await (await fetch(BASE.replace(/\/$/, '') + '/api/tags')).json();
const names = (tags.models || []).map((m) => m.name);
if (!names.includes(MODEL)) {
  console.log('  RULE 3 FAILED: endpoint does not name ' + MODEL + '. Present: ' + JSON.stringify(names));
  process.exit(1);
}
console.log('  RULE 3 ok: endpoint names ' + MODEL);
console.log('  samples ' + SAMPLES + ' per arm per case, temperature ' + TEMPERATURE);

// ---- leakage guard over every CONTRACT prompt, BEFORE generating
for (const [id, c] of Object.entries(CASES)) {
  const hits = leakageScan(contractPrompt(c).pkg);
  if (hits.length) {
    console.log('  LEAKAGE in case ' + id + ': ' + hits.join('; ') + ' - VOID, refusing to run');
    process.exit(1);
  }
}
console.log('  leakage scan clean on both contract prompts');
console.log('');

const results = { model: MODEL, temperature: TEMPERATURE, samples: SAMPLES, arms: {} };
for (const arm of ['BASELINE', 'CONTRACT']) {
  results.arms[arm] = {};
  for (const [id, c] of Object.entries(CASES)) {
    const prompt = arm === 'CONTRACT' ? contractPrompt(c).text : baselinePrompt(c);
    const rows = [];
    for (let i = 0; i < SAMPLES; i++) {
      let raw = '';
      try { raw = await generate(prompt); } catch (e) { rows.push({ error: String(e.message) }); continue; }
      const fn = extractFunction(raw);
      const r = conforms(fn, c.contested_expected);
      rows.push({ ...r, shape: fn ? fn.replace(/\s+/g, ' ').trim() : null });
    }
    const ok = rows.filter((r) => r.conforms).length;
    const parsed = rows.filter((r) => r.parsed).length;
    const shapes = new Set(rows.filter((r) => r.conforms).map((r) => r.shape));
    results.arms[arm][id] = { conforms: ok, parsed, of: SAMPLES, distinct_conforming_shapes: shapes.size, rows };
    console.log('  ' + arm.padEnd(9) + ' case ' + id + '   conforms ' + ok + '/' + SAMPLES
      + '   parsed ' + parsed + '/' + SAMPLES + '   distinct shapes ' + shapes.size);
  }
}

writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8');
console.log('');
console.log('  CASE B is the discriminating one: appending after the zero check gives case A semantics.');
console.log('  written -> ' + OUT);
