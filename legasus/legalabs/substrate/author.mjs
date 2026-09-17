// SUBSTRATE AUTHORING TOOL.
//
// Produces a task's evidence package and REFUSES to write it unless every witness the construction rules
// demand is actually proven by execution:
//
//     reference passes the delta probe                        rule 4
//     reference preserves accumulated behaviour               rule 4
//     the no-op FAILS the delta probe                         rule 5
//     EACH single-operation-omitted variant FAILS the delta   rules 3 and 5
//
// The last one is the rule that would have caught the goal-64 dead insertion site at authoring time
// instead of two experiments later. An operation whose removal does not break the delta is either
// unnecessary (rule 3) or unreachable (the goal-64 defect), and either way the task is not admissible.
//
// The tool writes task.json from an explicit allow-list of fields, so construction metadata cannot reach
// the prompt-visible contract by accident. validate-task.mjs then checks the result independently,
// including the introduced-identifier leakage check.
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateTask } from './validate-task.mjs';

const NL = String.fromCharCode(10);
const sha = (s) => createHash('sha256').update(s).digest('hex');

// Anchored insertion, re-anchored against the CURRENT text at every step - never a precomputed offset.
// The same discipline the transaction harness uses, for the same reason.
function applyOps(src, ops) {
  let cur = src;
  for (const op of ops) {
    const n = cur.split(op.anchor).length - 1;
    if (n !== 1) return { ok: false, why: 'op ' + op.id + ': anchor occurs ' + n + ' times (must be 1)' };
    const at = cur.indexOf(op.anchor) + op.anchor.length;
    cur = cur.slice(0, at) + op.code + cur.slice(at);
  }
  return { ok: true, src: cur };
}

function runProbe(lang, sourceName, sourceText, probeText) {
  const ws = mkdtempSync(join(tmpdir(), 'author-'));
  writeFileSync(join(ws, sourceName), sourceText, 'utf8');
  const probeName = lang === 'py' ? '_probe.py' : '_probe.js';
  writeFileSync(join(ws, probeName), probeText, 'utf8');
  try {
    const out = execFileSync(lang === 'py' ? 'python' : 'node', [probeName],
      { cwd: ws, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
    return { pass: /\bOK\b/.test(out), out: String(out).trim().slice(0, 200) };
  } catch (e) {
    return { pass: false, out: String((e.stdout || '') + (e.stderr || '')).trim().slice(0, 200) };
  }
}

export function authorTask(def, outDir) {
  const problems = [];
  const ref = applyOps(def.source, def.operations);
  if (!ref.ok) return { ok: false, problems: [{ kind: 'anchor', detail: ref.why }] };

  // rule 4 - the reference must both work and preserve
  const refDelta = runProbe(def.language, def.lead, ref.src, def.delta_probe);
  const refPres = runProbe(def.language, def.lead, ref.src, def.preservation_probe);
  if (!refDelta.pass) problems.push({ kind: 'rule4', detail: 'reference FAILS its own delta probe: ' + refDelta.out });
  if (!refPres.pass) problems.push({ kind: 'rule4', detail: 'reference breaks accumulated behaviour: ' + refPres.out });

  // rule 5 - the no-op must fail the delta
  const noop = runProbe(def.language, def.lead, def.source, def.delta_probe);
  if (noop.pass) problems.push({ kind: 'rule5', detail: 'the unmodified source PASSES the delta probe - the probe does not test the requested change' });

  // rules 3 and 5 - every operation must be load-bearing
  const omitted = [];
  for (let i = 0; i < def.operations.length; i++) {
    const subset = def.operations.filter((_, j) => j !== i);
    const v = applyOps(def.source, subset);
    // An anchor that vanishes when an earlier op is removed is itself evidence of a real dependency.
    const r = v.ok ? runProbe(def.language, def.lead, v.src, def.delta_probe) : { pass: false, out: v.why };
    omitted.push(!r.pass);
    if (r.pass) {
      problems.push({ kind: 'rule3/5',
        detail: 'omitting ' + def.operations[i].id + ' STILL passes the delta - that operation is '
          + 'unnecessary or unreachable (the goal-64 defect class)' });
    }
  }

  // rule 2 - at least one real dependency edge
  if (!def.dependency_edges || !def.dependency_edges.length) {
    problems.push({ kind: 'rule2', detail: 'no dependency edge declared' });
  }
  // rule 1 - 2..4 distinct sites
  if (def.operations.length < 2 || def.operations.length > 4) {
    problems.push({ kind: 'rule1', detail: 'operation_count must be 2-4, got ' + def.operations.length });
  }

  if (problems.length) return { ok: false, problems };

  // ---- write the package. task.json is built from an ALLOW-LIST, so metadata cannot leak by accident.
  const dir = join(outDir, def.id);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'source'), { recursive: true });
  mkdirSync(join(dir, 'evidence', 'probes'), { recursive: true });
  mkdirSync(join(dir, 'evidence', 'omitted-op-variants'), { recursive: true });

  const task = { task_id: def.id, goal: def.goal, lead: def.lead,
    language: def.language, run_with: def.run_with };
  if (def.analogy) task.analogy = def.analogy;
  // The requested API, declared so the leakage check can tell a deliverable from an invented internal.
  if (def.interface) task.interface = def.interface;
  writeFileSync(join(dir, 'task.json'), JSON.stringify(task, null, 2) + NL, 'utf8');
  writeFileSync(join(dir, 'source', def.lead), def.source, 'utf8');

  writeFileSync(join(dir, 'evidence', 'reference.patch'),
    def.operations.map((o) => '--- op ' + o.id + ' after: ' + JSON.stringify(o.anchor.slice(-40)) + NL + o.code).join(NL), 'utf8');
  writeFileSync(join(dir, 'evidence', 'reference.' + def.lead), ref.src, 'utf8');
  writeFileSync(join(dir, 'evidence', 'probes', 'delta.' + (def.language === 'py' ? 'py' : 'js')), def.delta_probe, 'utf8');
  writeFileSync(join(dir, 'evidence', 'probes', 'preservation.' + (def.language === 'py' ? 'py' : 'js')), def.preservation_probe, 'utf8');
  for (let i = 0; i < def.operations.length; i++) {
    const v = applyOps(def.source, def.operations.filter((_, j) => j !== i));
    writeFileSync(join(dir, 'evidence', 'omitted-op-variants', 'without-' + def.operations[i].id + '.txt'),
      v.ok ? v.src : 'ANCHOR VANISHED: ' + v.why, 'utf8');
  }

  const oracle = {
    task_id: def.id,
    analogy_class: def.analogy_class,
    analogy_justification: def.analogy_justification,
    transaction: {
      operation_count: def.operations.length,
      operations: def.operations.map((o) => ({ id: o.id, intent: o.intent, site_hint: o.anchor.slice(-48) })),
      dependency_edges: def.dependency_edges,
      permitted_orders: [def.operations.map((o) => o.id)],
      transaction_length: def.operations.length,
    },
    complexity: { structural_class: def.structural_class,
      affected_region_lines: def.operations.reduce((a, o) => a + o.code.split(NL).length, 0) },
    reference: { source_hash: sha(def.source), reference_hash: sha(ref.src),
      changed_sites: def.operations.map((o) => o.id), implementation: 'reference.patch' },
    witnesses: { noop_fails_delta: !noop.pass,
      each_operation_omitted_fails_delta: omitted,
      reference_preserves_old_behavior: refPres.pass, reference_passes_delta: refDelta.pass },
    sealing: { authored_commit: null, evidence_commit: null, pre_generation: true },
  };
  writeFileSync(join(dir, 'evidence', 'oracle.json'), JSON.stringify(oracle, null, 2) + NL, 'utf8');

  const v = validateTask(dir);
  if (!v.ok) { rmSync(dir, { recursive: true, force: true }); return { ok: false, problems: v.problems }; }
  return { ok: true, dir, operation_count: def.operations.length, analogy_class: def.analogy_class };
}
