/**
 * fuzzCorpus.mjs - which recorded real replies are the nasty ones.
 *
 * `fuzzLoop.mjs --mode=hostile` serves ONLY these, so the loop's worst real inputs are hit
 * every iteration instead of a few times in 1,425. Each category is a shape that has
 * already cost something:
 *
 *   multi        more than one ACTION in a reply. parseAction used to keep the first and
 *                drop the rest in silence (102 of 1,759 replies).
 *   pkgFirst     the FIRST action writes package.json - the marker the workspace depends on
 *                (9 of 67 real workspaces had it destroyed).
 *   lineNumbers  a fenced block carrying read_file's `19: ` / `  19| ` prefixes, copied back
 *                into code that then will not parse.
 *   noThought    no THOUGHT and not a planner turn: the reply skipped the format the parser
 *                leans on.
 *
 * Tested in fuzzInvariants.test.mjs: each classifier fires on its shape and not on an
 * ordinary reply.
 */
import { parseActions, stripLineNumberPrefixes } from './agentParse.js';

const WRITES = new Set(['write_file', 'edit_file', 'append_file']);
// Planner turns legitimately carry no THOUGHT: the plan IS the reply.
const PLANNER = /^\s*(BUILD PLAN|PLAN:|1\. WHAT IT DOES)/;

export const HOSTILE = {
  multi: (r) => (r.actions || []).length > 1,
  pkgFirst: (r) => {
    const a = parseActions(r.text)[0];
    return !!a && WRITES.has(a.tool) && /(^|[\/])package\.json$/i.test(String(a.args?.path || '').trim());
  },
  lineNumbers: (r) => [...String(r.text || '').matchAll(/```[^\n]*\n([\s\S]*?)```/g)]
    .some((m) => { const b = m[1].replace(/\n$/, ''); return stripLineNumberPrefixes(b) !== b; }),
  noThought: (r) => !r.hasThought && !PLANNER.test(String(r.text || '')),
};

/** The hostile categories a corpus row falls in; [] for an ordinary reply. */
export function hostileCategories(row) {
  return Object.keys(HOSTILE).filter((k) => HOSTILE[k](row));
}
