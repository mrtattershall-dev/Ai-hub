// r4 — PRODUCER #2: git. Selected mechanically by the rule frozen in 087ec67.
//
// Chosen for STRAIN. git differs from doctest on all seven declared axes: it does not execute the subject
// at all, its identity is content-addressed, its history is an explicit DAG, and it has no notion of
// PASS or FAIL. If the evidence boundary survives git, it is not doctest-shaped.
//
// It is also a fact Legasus genuinely consumes rather than one invented to be consumed: THE COPY YOU
// MEASURE MUST BE THE COPY YOU EDITED is a byte-identity claim, and the provenance sidecar already leans
// on git facts.
//
// THE STRAIN IS IMMEDIATE AND IT IS THE POINT. doctest evidence adapts to {observability, assertion};
// git evidence HAS NO ASSERTION. A boundary that forced an assertion field onto it would be inventing a
// distinction the producer never made - law 4 - so the record below carries git's own vocabulary and the
// adapter is allowed to say that no assertion applies.
import { execFileSync } from 'node:child_process';

const git = (args, cwd) => {
  try {
    return { ok: true,
      out: execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 30000 }).replace(/\s+$/, '') };
  } catch (e) {
    return { ok: false, err: String((e && e.message) || e).slice(0, 200) };
  }
};

// Observe byte identity and tracking facts for a set of paths. `oid` is git's OWN identity - a hash over
// the object's bytes - and is carried verbatim rather than being reduced to a Legasus key.
export function runGitProducer({ repo, paths }) {
  const version = git(['--version'], repo);
  if (!version.ok) {
    return { ok: false, producerFailed: true,
      why: 'git could not be run. That is a fact about the PRODUCER and carries no evidential force'
        + ' about the subject.' };
  }
  const head = git(['rev-parse', 'HEAD'], repo);
  const records = [];
  for (const p of paths) {
    const oid = git(['hash-object', '--', p], repo);
    const tracked = git(['ls-files', '--error-unmatch', '--', p], repo);
    const status = git(['status', '--porcelain', '--', p], repo);
    const committed = git(['rev-parse', 'HEAD:' + p.replace(/\\/g, '/')], repo);
    if (!oid.ok) {
      // The file could not be hashed at all. Explicit, and never a clean result.
      records.push({ path: p, nativeResult: 'UNREADABLE', nativeDetails: { error: oid.err } });
      continue;
    }
    const isTracked = tracked.ok;
    const dirty = status.ok && status.out.length > 0;
    records.push({
      path: p,
      // GIT'S OWN VOCABULARY, not a verdict vocabulary borrowed from elsewhere.
      nativeResult: !isTracked ? 'UNTRACKED' : (dirty ? 'TRACKED_MODIFIED' : 'TRACKED_CLEAN'),
      nativeDetails: {
        worktreeOid: oid.out,
        committedOid: committed.ok ? committed.out : null,
        porcelain: status.ok ? status.out : null,
        matchesCommitted: committed.ok ? (committed.out === oid.out) : null,
      },
      identity: {
        producer: 'git',
        producerVersion: version.out.replace(/^git version\s*/, ''),
        // CONTENT-ADDRESSED. The path is DESCRIPTION; the oid is the identity.
        object: oid.out,
        head: head.ok ? head.out : null,
      },
    });
  }
  return { ok: true, producer: 'git', producerVersion: version.out.replace(/^git version\s*/, ''),
    head: head.ok ? head.out : null, records };
}

// git's identity, as a comparable string. Deliberately NOT the path.
export const gitIdentity = (rec) => ['git', rec.identity.producerVersion, rec.identity.object].join('|');
