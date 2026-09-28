// RUNTIME WRITE INTERCEPTION — the class A instrument.
//
// Static search misses aliases, wrappers and child-process writes. This records what ACTUALLY REACHED
// DISK, with the caller and the resolved path, by patching the fs write primitives themselves.
//
// WHY THE fs LAYER AND NOT THE TOOL LAYER. Patching a tool proves only that the patched tool behaved.
// Patching `fs` catches every route in the same process regardless of which wrapper called it — which is
// the whole point, since agent.js reaches the filesystem from 47 call sites outside the tool surface.
//
// WHAT IT CANNOT SEE, and this is the class A / class B boundary made concrete:
//   - a CHILD PROCESS. `run_command` and `run_python` hand code to execAgentCommand with cwd: WORKSPACE.
//     Nothing patched in this process observes that child's writes. Class B's snapshot exists for them.
//   - native or worker-thread writes that do not pass through this module's `fs` binding.
//   - anything after this module is restored.
//
// So a clean interception log means "no write from THIS process, through THESE primitives, during THIS
// window, went unrecorded". It does not mean no write occurred.
// PATCHED VIA createRequire, NOT the ESM namespace. Two measured facts forced this:
//   1 an ESM namespace object is FROZEN - `fs[name] = ...` throws
//     "Cannot assign to read only property 'writeFileSync' of object '[object Module]'"
//   2 agent.js line 16 does `import { writeFileSync, ... } from 'fs'`, and a NAMED ESM IMPORT BINDS THE
//     FUNCTION DIRECTLY. Patching after agent.js has loaded changes nothing it calls.
// So this module must be loaded as a PRELOAD (node --import) BEFORE the subject, which is the same
// mechanism legascreen/witness-register.mjs already uses. Verified by experiment: a preload patch IS seen
// by a later named ESM import. Loaded afterwards, it silently intercepts NOTHING.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const fs = createRequire(import.meta.url)('fs');

const PRIMITIVES = ['writeFileSync', 'appendFileSync', 'unlinkSync', 'rmSync', 'renameSync',
  'mkdirSync', 'copyFileSync', 'truncateSync', 'writeSync', 'createWriteStream'];

let active = null;

// The caller, as a stack WITHOUT this module's own frames, so the attribution names the real writer.
function callerOf() {
  const raw = new Error().stack.split('\n').slice(1)
    .filter((l) => !l.includes('write-interceptor.mjs'));
  const frames = raw.map((l) => l.trim()).filter(Boolean);
  const first = frames.find((l) => !l.includes('node:internal')) || frames[0] || '<unknown>';
  return { frame: first, stack: frames.slice(0, 8) };
}

export function beginInterception({ root, allow = () => true } = {}) {
  if (active) throw new Error('interception is already active; nesting would confuse attribution');
  const resolvedRoot = root ? resolve(root) : null;
  const log = [];
  const originals = {};

  const inScope = (p) => {
    if (!resolvedRoot) return true;
    try { return resolve(String(p)).startsWith(resolvedRoot); } catch { return false; }
  };

  for (const name of PRIMITIVES) {
    if (typeof fs[name] !== 'function') continue;
    originals[name] = fs[name];
    const original = originals[name];
    // eslint-disable-next-line func-names
    fs[name] = function (...args) {
      const target = args[0];
      if (inScope(target)) {
        const entry = {
          primitive: name,
          target: String(target),
          resolved: (() => { try { return resolve(String(target)); } catch { return null; } })(),
          caller: callerOf(),
          permitted: true,
          at: log.length,
        };
        // THE GATE. `allow` decides whether this write reaches the real primitive. A refusal here means
        // the BYTES NEVER CHANGE — prevention, not detection.
        const verdict = allow(entry);
        if (verdict !== true) {
          entry.permitted = false;
          entry.refusedBecause = typeof verdict === 'string' ? verdict : 'refused by the interception gate';
          log.push(entry);
          const e = new Error('GOVERNANCE: ' + entry.refusedBecause);
          e.governanceRefusal = true;
          e.entry = entry;
          throw e;
        }
        log.push(entry);
      }
      return original.apply(fs, args);
    };
  }

  active = {
    log,
    end() {
      for (const [name, fn] of Object.entries(originals)) fs[name] = fn;
      active = null;
      return log;
    },
  };
  return active;
}

export const isIntercepting = () => !!active;

// Did every in-scope write that actually happened come from a governed path? `governedFrames` are stack
// substrings that identify the authorized executor.
export function auditLog(log, { governedFrames = ['governed-edit.mjs'] } = {}) {
  const effected = log.filter((e) => e.permitted);
  const ungoverned = effected.filter((e) =>
    !e.caller.stack.some((f) => governedFrames.some((g) => f.includes(g))));
  return {
    total: log.length,
    effected: effected.length,
    refused: log.length - effected.length,
    governed: effected.length - ungoverned.length,
    ungoverned,
    ok: ungoverned.length === 0,
    why: ungoverned.length
      ? ungoverned.length + ' write(s) reached disk without passing through '
        + governedFrames.join('/') + ': ' + ungoverned.map((e) => e.primitive + ' ' + e.target).join(', ')
      : effected.length + ' write(s), all through ' + governedFrames.join('/'),
  };
}
