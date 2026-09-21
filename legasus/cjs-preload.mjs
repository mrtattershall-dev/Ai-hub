/**
 * cjs-preload.mjs - BIND-CJS candidate mechanism #1: controlled intervention in a CommonJS
 * `require`, using node:module's SYNCHRONOUS hooks.
 *
 *   node --import ./legasus/cjs-preload.mjs <witness>
 *
 *   LEGASUS_CJS_MAP   JSON [{ from: <absolute path>, to: <absolute path> }, ...]
 *   LEGASUS_CJS_LOG   path; the mechanism appends ONE record per substitution it performs
 *
 * This is NOT the ESM transport ported. `module.register` installs an asynchronous, off-thread
 * loader that answers ESM resolution only - measured at TRANSFER-BIND (db4f3d9): it left a
 * CommonJS require on the original and said nothing. `module.registerHooks` installs
 * synchronous in-thread hooks that participate in CommonJS resolution as well.
 *
 * The log is the mechanism's CLAIM about what it served. It is never evidence that the claim
 * is true: the executed identity is observed separately, from inside the loaded file, and the
 * qualification driver requires requested == served == executed. A mechanism that reports
 * success is not evidence that success occurred (TRANSFER-BIND arm B).
 */
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { appendFileSync } from 'node:fs';

const MAP = process.env.LEGASUS_CJS_MAP ? JSON.parse(process.env.LEGASUS_CJS_MAP) : [];
const LOG = process.env.LEGASUS_CJS_LOG;

const byUrl = new Map();
for (const m of MAP) byUrl.set(pathToFileURL(m.from).href, { toUrl: pathToFileURL(m.to).href, from: m.from, to: m.to });

function note(rec) {
  if (!LOG) return;
  try { appendFileSync(LOG, JSON.stringify(rec) + '\n'); } catch { /* absence of a claim is itself the observation */ }
}

if (byUrl.size) {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const r = nextResolve(specifier, context);
      const hit = byUrl.get(r.url);
      if (!hit) return r;
      note({ event: 'served', requestedFrom: hit.from, servedPath: hit.to, specifier, at: Date.now() });
      return { ...r, url: hit.toUrl, shortCircuit: true };
    },
  });
  note({ event: 'armed', entries: MAP.length });
}
