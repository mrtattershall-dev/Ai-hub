// SUBSTRATE SEALING. Proves not merely that generations happened later, but that the exact
// prompt-visible and evaluator-visible artifacts were unchanged when they did.
//
// Rule 14 asserts `sealing.pre_generation`. An assertion is a claim; a hash is evidence. This makes the
// claim checkable by anyone later, including a reader who does not trust the author - which is the
// standard the rest of this project already holds itself to (rules, endpoints and analysers are frozen
// and hashed BEFORE the run that tests them).
//
// Three hashes per task, kept separate on purpose:
//     task_sha       task.json           what the model is allowed to see
//     source_sha     source/             the starting program, also prompt-visible
//     evidence_sha   evidence/           what the model must never see
// Separating them means a later audit can show the CONTRACT was unchanged even if the evaluator gained a
// probe, or - more importantly - detect the reverse.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const sha = (b) => createHash('sha256').update(b).digest('hex');

// Directory hash: every file, path-qualified, in sorted order, so a rename is a change.
export function hashTree(dir) {
  if (!existsSync(dir)) return null;
  const h = createHash('sha256');
  const walk = (d, prefix) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      const rel = prefix ? prefix + '/' + name : name;
      if (statSync(p).isDirectory()) walk(p, rel);
      else h.update(rel).update('\0').update(readFileSync(p)).update('\0');
    }
  };
  walk(dir, '');
  return h.digest('hex');
}

export function sealTask(taskDir) {
  return {
    task_sha: existsSync(join(taskDir, 'task.json')) ? sha(readFileSync(join(taskDir, 'task.json'))) : null,
    source_sha: hashTree(join(taskDir, 'source')),
    evidence_sha: hashTree(join(taskDir, 'evidence')),
  };
}

export function sealFamily(familyDir) {
  const tasks = readdirSync(familyDir)
    .filter((d) => existsSync(join(familyDir, d, 'task.json'))).sort();
  let commit = null;
  // stdio pipe: sealing a family outside a repo is legitimate (the witness suite does it), and git's
  // "not a git repository" on stderr would otherwise pollute the output of a passing test run.
  try {
    commit = execSync('git rev-parse HEAD',
      { cwd: familyDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) { commit = null; }
  return {
    sealed_at: new Date().toISOString(),
    sealed_at_commit: commit,
    pre_generation: true,
    note: 'Sealed BEFORE any model generation or applicability detection ran against this family. '
      + 'Rule 15: author all, validate, seal, freeze, and only then let anything see it.',
    tasks: tasks.map((t) => ({ task_id: t, ...sealTask(join(familyDir, t)) })),
  };
}

export function verifyFamily(familyDir, manifestPath) {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const problems = [];
  for (const rec of m.tasks) {
    const now = sealTask(join(familyDir, rec.task_id));
    for (const k of ['task_sha', 'source_sha', 'evidence_sha']) {
      if (rec[k] !== now[k]) {
        problems.push({ task_id: rec.task_id, field: k, sealed: rec[k], now: now[k] });
      }
    }
  }
  const present = readdirSync(familyDir).filter((d) => existsSync(join(familyDir, d, 'task.json'))).sort();
  const sealedIds = m.tasks.map((t) => t.task_id);
  for (const p of present) if (!sealedIds.includes(p)) problems.push({ task_id: p, field: 'ADDED_AFTER_SEAL' });
  for (const s of sealedIds) if (!present.includes(s)) problems.push({ task_id: s, field: 'REMOVED_AFTER_SEAL' });
  return { ok: problems.length === 0, problems, sealed_at: m.sealed_at, n: m.tasks.length };
}

// ---- CLI
const [cmd, dir, manifest] = process.argv.slice(2);
if (cmd === 'seal' && dir) {
  const m = sealFamily(dir);
  const out = manifest || join(dir, 'MANIFEST.sealed.json');
  writeFileSync(out, JSON.stringify(m, null, 2), 'utf8');
  console.log('  sealed ' + m.tasks.length + ' task(s) -> ' + out);
  for (const t of m.tasks) {
    console.log('    ' + t.task_id + '  task ' + String(t.task_sha).slice(0, 12)
      + '  source ' + String(t.source_sha).slice(0, 12) + '  evidence ' + String(t.evidence_sha).slice(0, 12));
  }
} else if (cmd === 'verify' && dir) {
  const r = verifyFamily(dir, manifest || join(dir, 'MANIFEST.sealed.json'));
  if (r.ok) console.log('  SEAL INTACT - ' + r.n + ' task(s) byte-identical to the seal of ' + r.sealed_at);
  else {
    console.log('  SEAL BROKEN');
    for (const p of r.problems) console.log('    ' + p.task_id + '  ' + p.field
      + (p.sealed ? '\n        sealed ' + p.sealed.slice(0, 16) + '\n        now    ' + String(p.now).slice(0, 16) : ''));
  }
}
