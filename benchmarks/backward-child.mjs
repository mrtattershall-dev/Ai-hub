// BACKWARD-1 — the CHILD. One subject entry, observed, reported.
//
// THIS IS ITS OWN FILE ON PURPOSE. The child used to be a branch at the top of run-backward.mjs that
// ended with process.exit(0). When that exit was removed so the subject could drain, the branch fell
// THROUGH into the parent section: every child started a whole run of its own. Orphans, a machine
// two other sessions could not use, and lifecycle controls failing for a reason that had nothing to
// do with lifecycle.
//
// A guard flag would have fixed it. A separate file makes it unrepresentable, which is the repair
// this project keeps choosing when a rule turns out to be load-bearing.
//
//     LGS_ONE    the single subject entry to observe
//     LGS_OUT    where to write the observation record
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { SINKS } from '../legasus/legascreen/witness-store.mjs';

const out = process.env.LGS_OUT;
let written = false;

// PHASE AND EXITKIND ARE THE PROTOCOL RECORD. An empty event list is not one fact but three:
//   LOADING            the subject took the process away before the entry finished
//   LOADED + WATCHDOG  the entry finished loading but never let go
//   LOADED + NATURAL   the entry ran to the end and caused nothing - the ONLY scorable emptiness
// Without the distinction, process.exit(0) before the first sink reads as "ran, caused nothing".
let phase = 'LOADING';
let exitKind = 'NATURAL';

const dump = (code) => {
  if (written) return;
  written = true;
  try {
    writeFileSync(out, JSON.stringify({ phase, exitKind,
      code: code === undefined ? null : code, events: SINKS.events() }));
  } catch { /* nothing further can be done from here */ }
};

// REGISTERED BEFORE THE SUBJECT IS TOUCHED.
process.on('exit', dump);
process.on('uncaughtException', () => dump(null));

// THE BOUND IS ARMED BEFORE THE SUBJECT LOADS, NOT AFTER.
//
// An UNREF'D timer costs nothing: it does not hold the loop open, so a subject that finishes still
// exits naturally and this never fires. It fires only when something else is holding the process.
//
// Armed AFTER the import, it could not bound a subject that hangs DURING load - `await import`
// never returns, so the arming line never runs - and such a subject fell through to the parent's
// kill, which is precisely the path that leaves orphans on Windows. Armed here it covers load and
// drain alike, and the parent's timeout becomes a last resort rather than the normal path for a
// hang.
const GRACE_MS = Number(process.env.LGS_GRACE_MS || 25000);
const watchdog = setTimeout(() => {
  exitKind = 'WATCHDOG';
  dump(0);
  process.exit(0);
}, GRACE_MS);
watchdog.unref();

// `await import` returns when a module has been EVALUATED, which for a test file means its tests are
// REGISTERED, not run. Exiting right after this killed the subject mid-suite: Legasus fell from 4132
// witnessed effects to 2295 while every lifecycle control still passed. So the child now simply ends
// here and lets the process drain, bounded by the watchdog above.
try { await import(pathToFileURL(resolve(process.env.LGS_ONE)).href); phase = 'LOADED'; }
catch { phase = 'REFUSED'; }
