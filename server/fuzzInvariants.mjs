/**
 * fuzzInvariants.mjs - what must be true of a run directory after the agent has been at it.
 *
 * Pulled out of fuzzLoop.mjs so the checks can be tested on their own. A fuzzer that reports
 * "40/40 clean" proves nothing unless each check is known to FIRE on the damage it names -
 * the first version of mockLoop's marker check passed with the marker guard disabled.
 * fuzzInvariants.test.mjs builds a deliberately corrupted directory per violation kind.
 *
 * Every check here maps to something that actually went wrong on 2026-09-10:
 *   CRASH    the hub process died mid-run
 *   MARKER   package.json overwritten with {"type":"module"} (9 of 67 workspaces)
 *   BROKEN   code left on disk that does not parse (10 of 67)
 *   STRAY    a write landing beside the workspace instead of inside it
 *   GIT      agent checkpoints committed into the HUB's repo, because git walked up to the
 *            nearest .git when the workspace had none of its own
 *   RUNFILE  a persisted run truncated, losing its history
 *   TRANSCRIPT  a run's <id>.transcript.jsonl with a line that is not JSON (it is JSONL: one record per line)
 *   INDEX    a run-index line that no longer parses, silently skewing every trend
 *
 * checkQueueInvariants (chain mode, below) adds three for the backlog: STRANDED, ORPHAN,
 * QUEUEFILE.
 *
 * Returns a list of violation strings, each prefixed with its kind. Empty means clean.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';

// What the harness itself puts beside the workspace. Anything else there is a stray write.
const HARNESS_FILES = new Set(['workspace', 'hub.json', 'queue.json', 'runs', 'index.jsonl', 'traces']);

export function checkInvariants(dir, { hubExitCode = null, hubLog = '' } = {}) {
  const v = [];
  const ws = join(dir, 'workspace');

  if (hubExitCode !== null && hubExitCode !== undefined) {
    v.push(`CRASH: hub exited ${hubExitCode}: ${String(hubLog).slice(-200).replace(/\s+/g, ' ')}`);
  }

  const pkg = join(ws, 'package.json');
  if (existsSync(pkg)) {
    const raw = readFileSync(pkg, 'utf8');
    try {
      const j = JSON.parse(raw);
      if (j.type !== 'commonjs' || raw.length < 100) v.push(`MARKER: type=${j.type} ${raw.length}B`);
    } catch { v.push(`MARKER: package.json is not valid JSON (${raw.length}B)`); }
  }

  if (existsSync(ws)) {
    for (const f of readdirSync(ws).filter((x) => /\.(c|m)?js$/i.test(x))) {
      try { execFileSync(process.execPath, ['--check', join(ws, f)], { timeout: 15000, stdio: 'pipe' }); }
      catch (e) {
        // Two different failures that `node --check` reports the same way, separated so the
        // fuzz result means something.
        //
        // ESM: syntactically fine code using import/export in a workspace that is CommonJS.
        // Much of the replay corpus was recorded BEFORE the prompt learned to say so, so it
        // replays ESM the live model no longer writes. It cannot be refused outright - a
        // browser module script is legitimately ESM in a .js file - so it is reported apart
        // rather than drowning out genuinely broken code.
        //
        // BROKEN: code that will not parse under any module system. That is always damage.
        const why = String(e.stderr || e.message || '');
        const esm = /ES module|Cannot use import statement|Unexpected token 'export'|"type": "module"/i.test(why);
        v.push(esm ? `ESM: ${f} uses import/export in a commonjs workspace` : `BROKEN: ${f} does not parse`);
      }
    }
  }

  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (!HARNESS_FILES.has(f) && !/\.(bak|tmp)$/.test(f)) v.push(`STRAY: ${f} written beside the workspace`);
    }
  }

  if (existsSync(join(ws, '.git'))) {
    try {
      const top = execFileSync('git', ['-C', ws, 'rev-parse', '--show-toplevel'], {
        encoding: 'utf8', stdio: 'pipe',
        // Same ceiling the hub uses: stop git walking up past the workspace's parent.
        env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(resolve(ws)) },
      }).trim();
      if (resolve(top).toLowerCase() !== resolve(ws).toLowerCase()) v.push(`GIT: workspace repo resolves to ${top}`);
    } catch (e) { v.push(`GIT: could not resolve the workspace repo (${String(e.message).slice(0, 60)})`); }
  }

  const runsDir = join(dir, 'runs');
  if (existsSync(runsDir)) {
    for (const f of readdirSync(runsDir)) {
      // A transcript is JSONL (one record per model call), not one document: validate it line by line.
      if (f.endsWith('.transcript.jsonl')) {
        const lines = readFileSync(join(runsDir, f), 'utf8').split('\n').filter((l) => l.trim());
        const bad = lines.findIndex((l) => { try { JSON.parse(l); return false; } catch { return true; } });
        if (bad >= 0) v.push(`TRANSCRIPT: ${f} line ${bad + 1} is not valid JSON`);
        continue;
      }
      try { JSON.parse(readFileSync(join(runsDir, f), 'utf8')); } catch { v.push(`RUNFILE: ${f} is not valid JSON`); }
    }
  }

  const idx = join(dir, 'index.jsonl');
  if (existsSync(idx)) {
    readFileSync(idx, 'utf8').split('\n').filter(Boolean).forEach((l, i) => {
      try { JSON.parse(l); } catch { v.push(`INDEX: line ${i + 1} is not valid JSON`); }
    });
  }

  return v;
}

/**
 * checkQueueInvariants - what must be true of the backlog once a chain has SETTLED.
 *
 *   QUEUEFILE  queue.json is not valid JSON, has no items array, or the hub already moved a
 *              corrupt one aside (queue.json.corrupt-*): its load() quarantines on read, so by
 *              check time the evidence may only survive under that name.
 *   STRANDED   an item still 'queued' whose `after` predecessor ended stopped / failed / error,
 *              or no longer exists. dequeue() releases a chained item only once its predecessor
 *              is 'done', so this item waits for ever and nothing retries it. KNOWN hub
 *              behaviour: failQueueItem repoints the tail only when it splices in a repair.
 *              'interrupted' is deliberately NOT dead - that run is resumable by design.
 *   ORPHAN     an item left 'taken' with no run that could still finish it - invisible to
 *              dequeue, and silently re-run by requeueOrphans() on the next boot.
 *
 * Call it only when nothing is running: autoStart() legitimately holds an item 'taken' for
 * 250ms before its run exists, so a mid-flight check would report a false ORPHAN.
 */
const DEAD_ITEM = new Set(['stopped', 'failed', 'error']);
const LIVE_RUN = new Set(['running', 'awaiting_approval', 'interrupted']);

export function checkQueueInvariants(dir, { queueFile = join(dir, 'queue.json') } = {}) {
  const v = [];
  const qdir = dirname(queueFile);
  const base = basename(queueFile);
  if (existsSync(qdir)) {
    for (const f of readdirSync(qdir)) {
      if (f.startsWith(`${base}.corrupt-`)) v.push(`QUEUEFILE: the hub quarantined a corrupt queue as ${f}`);
    }
  }
  if (!existsSync(queueFile)) return v;

  let items;
  try {
    const j = JSON.parse(readFileSync(queueFile, 'utf8'));
    if (!j || !Array.isArray(j.items)) throw new Error('no items array');
    items = j.items;
  } catch (e) {
    v.push(`QUEUEFILE: ${base} is not a valid queue (${String(e.message).slice(0, 60)})`);
    return v;                          // nothing below can be trusted without the items
  }

  // Persisted runs carry queueItemId and their final status. Unparseable ones are RUNFILE's
  // business, not this check's.
  const runs = [];
  const runsDir = join(dir, 'runs');
  if (existsSync(runsDir)) {
    for (const f of readdirSync(runsDir).filter((x) => x.endsWith('.json'))) {
      try { runs.push(JSON.parse(readFileSync(join(runsDir, f), 'utf8'))); } catch { /* RUNFILE */ }
    }
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  for (const it of items) {
    if (it.status === 'queued' && it.after) {
      const dep = byId.get(it.after);
      if (!dep) v.push(`STRANDED: ${it.id} waits on ${it.after}, which no longer exists`);
      else if (DEAD_ITEM.has(dep.status)) {
        v.push(`STRANDED: ${it.id} waits on ${dep.id}, which ended '${dep.status}'${dep.repairOf ? ` (itself the repair of ${dep.repairOf})` : ''}`);
      }
    }
    if (it.status === 'taken') {
      const mine = runs.filter((r) => r && r.queueItemId === it.id);
      if (!mine.some((r) => LIVE_RUN.has(r.status))) {
        v.push(`ORPHAN: ${it.id} is 'taken' with no run in progress (its runs: ${mine.map((r) => r.status).join(',') || 'none'})`);
      }
    }
  }
  return v;
}
