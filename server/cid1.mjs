/**
 * cid1.mjs - D-ID. Candidate identity, defined independently of Git.
 *
 * Contract: legasus/screen/D-ID-1_PREREG.md (1c3a2b1c) + Amendments 1 (3e14f827) and 2 (a69aaddd).
 *
 *   cid1(root) -> { ok: true, id: 'cid1:<hex>', entries } | { ok: false, reason, path }
 *
 * A PURE OBSERVER. It reads the directory and returns an identifier or a refusal. It copies
 * nothing, runs no git, writes nothing, and decides no verdict. It is deliberately NOT wired into
 * evaluator.js / acceptance.js / batch.js: what a receipt names is D-BIND's responsibility, and
 * repairing that here would hide which mechanism fixed which property.
 *
 * WHAT IT NAMES: the snapshot a check can observe at /candidate - every regular file and symlink
 * under the root, excluding only path components EXACTLY equal to `.git`. `.gitignore`,
 * `.gitattributes`, `.github/`, ignored files and hidden files are all included. Exact bytes, no
 * CRLF/LF normalization. A symlink is named by its STORED TARGET TEXT and never followed. Empty
 * directories, file modes and timestamps are declared out (known blind spots).
 *
 * FAIL CLOSED on what it cannot FAITHFULLY NAME - not on names that merely look strange:
 *   - a name or link target that is not well-formed Unicode (a lone surrogate would collapse to
 *     U+FFFD in UTF-8, so two distinct names could share one encoding)
 *   - an entry that is not a file, directory or symlink
 *   - any readdir / lstat / read / readlink failure
 * Never a silent skip: a skipped entry would make the identity name a different object.
 *
 * MEASURED, NOT ASSUMED (D-ID-1 M15c): on Windows, Node's readdir never yields a lone surrogate - it
 * decodes one to U+FFFD, so the isWellFormed() checks below cannot fire there. A real lone-surrogate
 * file is still refused: lstat on the decoded name finds nothing (ENOENT), and a decoded name that
 * collides with a genuine lookalike is caught as two entries with one path encoding. The
 * well-formedness checks stay as defence for callers of identityOf and for other platforms.
 *
 * WINDOWS: traversal uses the \\?\ path form, which addresses names exactly. CORRECTED by
 * D-ID-1 RECONCILE R3 (1f764685): an earlier version of this comment claimed the ordinary form
 * "would read `odd.` as `odd`". That was ASSUMED, never measured, and is FALSE for absolute paths
 * through Node - Node namespaces absolute paths itself, and an ordinary read of `odd.` returned
 * odd.'s own bytes. The explicit prefix is kept because it does not depend on that Node behaviour
 * (and a RELATIVE prefixed path fails, so the root is always resolved first).
 *
 * CONCURRENCY (stated, not solved): one traversal is not an atomic snapshot. A write landing
 * between two entries, or a change-and-revert, is not seen. Detecting change across an evaluation
 * is D-CONS's job, not this function's.
 *
 * ENCODING - every variable-length field length-prefixed, so no filename can forge a boundary:
 *   digest = sha256( DOMAIN || u64(count) || entry... ), entries sorted by Buffer.compare(path)
 *   FILE    'F' || u64(len path) || path || u64(len bytes)  || sha256(bytes)
 *   SYMLINK 'L' || u64(len path) || path || u64(len target) || target
 *   u64 = 8-byte big-endian. DOMAIN = "legasus/candidate-identity/cid1" + 0x00.
 */
import { readdirSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const CID1_DOMAIN = Buffer.concat([Buffer.from('legasus/candidate-identity/cid1', 'ascii'), Buffer.from([0])]);
const WIN = process.platform === 'win32';

const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; };
const sha256 = (b) => createHash('sha256').update(b).digest();

/** The exact-addressing form of an absolute path. On Windows, \\?\ disables name normalization. */
function exact(abs) {
  if (!WIN) return abs;
  if (abs.startsWith('\\\\?\\')) return abs;
  if (abs.startsWith('\\\\')) return '\\\\?\\UNC\\' + abs.slice(2);
  return '\\\\?\\' + abs;
}
const child = (dir, name) => dir + (WIN ? '\\' : '/') + name;

class Refusal extends Error { constructor(reason, path) { super(reason); this.reason = reason; this.path = path; } }

/**
 * Identity of an explicit entry list. Exported so the framing can be tested without a filesystem.
 * entries: [{ type: 'F', path, bytes: Buffer } | { type: 'L', path, target: string }]
 */
export function identityOf(entries) {
  const enc = entries.map((e) => {
    if (typeof e.path !== 'string' || !e.path.isWellFormed()) throw new Refusal('path is not well-formed Unicode', e.path);
    const p = Buffer.from(e.path, 'utf8');
    if (e.type === 'F') return { p, body: Buffer.concat([Buffer.from('F'), u64(p.length), p, u64(e.bytes.length), sha256(e.bytes)]) };
    if (e.type === 'L') {
      if (typeof e.target !== 'string' || !e.target.isWellFormed()) throw new Refusal('symlink target is not well-formed Unicode', e.path);
      const t = Buffer.from(e.target, 'utf8');
      return { p, body: Buffer.concat([Buffer.from('L'), u64(p.length), p, u64(t.length), t]) };
    }
    throw new Refusal(`unknown entry type ${e.type}`, e.path);
  });
  enc.sort((a, b) => Buffer.compare(a.p, b.p));
  for (let i = 1; i < enc.length; i++) if (Buffer.compare(enc[i - 1].p, enc[i].p) === 0) throw new Refusal('two entries share one path encoding', enc[i].p.toString('utf8'));
  const h = createHash('sha256');
  h.update(CID1_DOMAIN); h.update(u64(enc.length));
  for (const e of enc) h.update(e.body);
  return 'cid1:' + h.digest('hex');
}

/** Identify the visible snapshot under `root`. Never throws: a refusal is a returned value. */
export function cid1(root) {
  const entries = [];
  const walk = (absExact, rel) => {
    let names;
    try { names = readdirSync(absExact); } catch (e) { throw new Refusal(`readdir failed: ${e.code || e.message}`, rel || '.'); }
    for (const name of names) {
      if (name === '.git') continue;                                      // EXACT component only
      if (!name.isWellFormed()) throw new Refusal('name is not well-formed Unicode', rel);
      const r = rel ? `${rel}/${name}` : name;
      const p = child(absExact, name);
      let st;
      try { st = lstatSync(p); } catch (e) { throw new Refusal(`lstat failed: ${e.code || e.message}`, r); }
      if (st.isSymbolicLink()) {
        let target;
        try { target = readlinkSync(p); } catch (e) { throw new Refusal(`readlink failed: ${e.code || e.message}`, r); }
        entries.push({ type: 'L', path: r, target });
      } else if (st.isDirectory()) {
        walk(p, r);
      } else if (st.isFile()) {
        let bytes;
        try { bytes = readFileSync(p); } catch (e) { throw new Refusal(`read failed: ${e.code || e.message}`, r); }
        entries.push({ type: 'F', path: r, bytes });
      } else {
        throw new Refusal('entry is not a file, directory or symlink', r);
      }
    }
  };
  try {
    walk(exact(resolve(root)), '');
    return { ok: true, id: identityOf(entries), entries: entries.length };
  } catch (e) {
    if (e instanceof Refusal) return { ok: false, reason: e.reason, path: e.path ?? null };
    return { ok: false, reason: `unexpected: ${e.message}`, path: null };
  }
}
