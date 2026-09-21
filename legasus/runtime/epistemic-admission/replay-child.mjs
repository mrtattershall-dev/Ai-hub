// THE OTHER SIDE OF A REAL PROCESS BOUNDARY.
//
// A second store() inside one process tests store isolation, not restart: the module graph, the
// calculus's private WeakSet, every already-minted token and the ref counter all stay alive and
// reachable. This file is run by `node replay-child.mjs <journal.json>` from a parent that has
// already exited its own work, so the ONLY thing crossing is bytes on disk.
//
// It prints one JSON object on stdout and nothing else. The parent parses that and nothing else.
import { readFileSync } from 'node:fs';
import { parse, locate, replayJournal } from './replay.mjs';
import { store } from './authority-store.mjs';
import { isAuthority } from '../../legaknow/calculus.mjs';

const out = (o) => { process.stdout.write(JSON.stringify(o)); };

const j = parse(readFileSync(process.argv[2], 'utf8'));
if (!j.ok) { out({ ok: false, why: j.why }); process.exit(0); }

const journal = { entries: j.entries };
const st = store();

// R1, MEASURED IN THE CHILD: every address the parent issued is dead here, before anything runs.
const deadRefs = journal.entries.map((e) => {
  const r = st.resolve(e.ref);
  const l = locate(journal, e.ref);
  return { ref: e.ref, resolved: r.ok, why: r.why || null,
    located: l.ok, locateReturnedToken: Object.prototype.hasOwnProperty.call(l, 'token') };
});

const replayed = replayJournal(journal, { authorityStore: st });

// THE BOUNDARY'S OWN POSITIVE CONTROL. If a JSON round-trip of a real token ever answers true to
// isAuthority(), the boundary is not what the preregistration says it is and every other arm here
// is uninterpretable. Reported unconditionally, including when nothing minted.
let cloneIsAuthority = null, liveIsAuthority = null;
const firstNew = (replayed.outcomes || []).find((o) => o.newRef);
if (firstNew) {
  const got = st.resolve(firstNew.newRef);
  if (got.ok) {
    liveIsAuthority = isAuthority(got.token);
    cloneIsAuthority = isAuthority(JSON.parse(JSON.stringify(got.token)));
  }
}

out({ ok: true, pid: process.pid, deadRefs, replayed, liveIsAuthority, cloneIsAuthority,
  storeSize: st.size() });
