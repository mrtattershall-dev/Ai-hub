/**
 * goalEntry.mjs - FG-4 SUBJECT. Which file does the finish gate judge for this goal?
 *
 * Contract: legasus/screen/FG-4-SUBJECT_PREREG.md (80174bbe). PURE: the caller supplies `exists`.
 *
 *   goalEntry(goal, exists) -> { entry, missing }
 *     entry    the FIRST code file the goal names that exists, judged as the project's entry
 *     missing  the first named code file that does NOT exist - a refusal, never a fall-through to the
 *              next named file. fatal-09 path 3: "goal 10 names s10_desk.js, s1_library.js ... if s10 was
 *              never written the entry silently becomes s1 and the goal can pass on a file it never
 *              touched" - live on candidate-0 (FG-1 F4).
 *     Exception: a goal whose verb is remove/delete/drop treats an absent named file as SATISFIED and
 *     moves on to the next named file (or none).
 *
 * namedFiles() lower-cases its matches, exactly as the line this replaces did; `exists` is called with
 * that form (case-insensitive on Windows, where every run so far has happened - recorded, not hidden).
 */
import { namedFiles } from './taskLedger.js';

export const CODE_EXT = /\.(py|c?js|mjs)$/i;
const REMOVING = /\b(remove|delete|drop)\b/i;

export function goalEntry(goal, exists) {
  const named = namedFiles(goal || '').filter((f) => CODE_EXT.test(f));
  if (!named.length) return { entry: undefined, missing: null };
  const removing = REMOVING.test(String(goal || ''));
  for (const f of named) {
    if (exists(f)) return { entry: f, missing: null };
    if (!removing) return { entry: undefined, missing: f };
  }
  return { entry: undefined, missing: null };   // every named file absent under a remove/delete goal: satisfied
}
