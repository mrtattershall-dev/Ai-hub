/**
 * safeJson.js - never let an unreadable file become an empty one.
 *
 * THE BUG THIS EXISTS TO KILL
 * --------------------------
 * Three separate loaders had the same shape:
 *
 *     function load() {
 *       try { return JSON.parse(readFileSync(FILE, 'utf8')); }
 *       catch { return { items: [] }; }          // <- here
 *     }
 *
 * Read that with the WRITE path in mind. Every caller does load -> mutate -> save. So a
 * file that fails to parse for any reason - a torn write, a half-synced OneDrive copy, a
 * disk hiccup, an editor saving UTF-16 - is read as EMPTY, and the very next save writes
 * that emptiness over the top. The data is not lost by the corruption; it is lost by the
 * recovery. And it happens silently, because `catch {}` says nothing.
 *
 * What was at stake:
 *   hub.json            every provider API key AND all conversation history
 *   agent-queue.json    the entire unattended backlog
 *   assets/manifest.json the index for ~13,000 asset files, trusted by four consumers
 *
 * hub.json made it worse: saveDb copied the CURRENT file to .bak before renaming, so a
 * corrupt file overwrote the last known-good backup one save before the empty file
 * overwrote the corrupt one. Two generations of loss from one bad read.
 *
 * THE RULE
 * --------
 * A missing file is normal and means empty. A file that EXISTS but will not parse is an
 * emergency: recover from the backup, or preserve the original and refuse to pretend it
 * was empty. Corruption must never be silently laundered into data loss.
 */
import { existsSync, readFileSync, renameSync, copyFileSync } from 'fs';

/**
 * @param {string} file            path to the JSON file
 * @param {object} opts
 * @param {*}      opts.empty      what a genuinely absent file means
 * @param {string} opts.label      human name, for the message
 * @param {boolean} opts.tryBak    look for `<file>.bak` before giving up
 * @param {'throw'|'quarantine'} opts.onUnrecoverable
 *        'throw'      - refuse to continue (use when the file holds secrets you cannot regenerate)
 *        'quarantine' - move the bad file aside and continue empty (use when continuing
 *                       matters more than stopping, e.g. an unattended run in flight)
 */
export function readJsonSafe(file, { empty, label = file, tryBak = false, onUnrecoverable = 'throw' } = {}) {
  if (!existsSync(file)) return structuredClone(empty);

  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (parseErr) {
    if (tryBak && existsSync(file + '.bak')) {
      try {
        const recovered = JSON.parse(readFileSync(file + '.bak', 'utf8'));
        console.error(`[safeJson] ${label} was unreadable (${parseErr.message}). RECOVERED FROM ${file}.bak — the damaged file is at ${quarantine(file)}.`);
        return recovered;
      } catch { /* backup is bad too - fall through */ }
    }

    const kept = quarantine(file);
    const msg = `${label} exists but is not valid JSON (${parseErr.message}). The damaged file has been kept at ${kept} — it has NOT been overwritten.`;
    if (onUnrecoverable === 'throw') {
      throw new Error(`${msg} Fix or remove it, then restart. Refusing to start with an empty ${label}, because the next save would make the loss permanent.`);
    }
    console.error(`[safeJson] ${msg} Continuing with an empty ${label}.`);
    return structuredClone(empty);
  }
}

/** Move the damaged file aside so the next save cannot destroy it. Returns the new path. */
function quarantine(file) {
  const dest = `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  try { renameSync(file, dest); return dest; } catch { /* fall through */ }
  try { copyFileSync(file, dest); return dest; } catch { return '(could not be preserved)'; }
}

/**
 * Refresh `<file>.bak` ONLY from a file that currently parses.
 *
 * The old saveDb copied whatever was on disk, so one corrupt generation destroyed the
 * backup that would have recovered it. A backup you overwrite with garbage is not a backup.
 */
export function refreshBackup(file) {
  if (!existsSync(file)) return;
  try {
    JSON.parse(readFileSync(file, 'utf8'));      // only a VALID file earns backup status
    copyFileSync(file, file + '.bak');
  } catch { /* leave the last good .bak alone - it is now the only copy that parses */ }
}

/**
 * rename(), but survive a transient Windows lock.
 *
 * The atomic-save pattern used all over this hub is write-temp then rename-over-target.
 * rename IS atomic, but on Windows it fails outright with EPERM/EBUSY/EACCES if ANYTHING
 * else has the destination open - another hub process, a virus scanner, a file indexer,
 * a sync client. Measured 2026-09-10: the asset manifest save crashed the audit with
 * EPERM while a second hub happened to be reading it.
 *
 * On POSIX this is a no-op in practice. On Windows the lock is almost always momentary,
 * so a few short retries turn a hard crash into a pause - which matters most for a
 * process meant to run unattended for days on exactly this platform.
 */
export function renameWithRetry(tmp, dest, attempts = 6) {
  const transient = new Set(['EPERM', 'EBUSY', 'EACCES', 'ENOTEMPTY']);
  for (let i = 0; ; i++) {
    try { renameSync(tmp, dest); return; }
    catch (e) {
      if (i >= attempts - 1 || !transient.has(e.code)) throw e;
      // Busy-wait briefly: these locks clear in milliseconds and the callers are sync.
      const until = Date.now() + Math.min(120, 10 * 2 ** i);
      while (Date.now() < until) { /* spin */ }
    }
  }
}
