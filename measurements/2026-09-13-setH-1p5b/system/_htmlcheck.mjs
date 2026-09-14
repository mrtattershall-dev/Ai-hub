// Shared by spec2.mjs and its control suite so the test exercises the SHIPPING logic, not a copy.
// A quoted token in the goal text is an ID only if the nearest preceding keyword is "id"/"ids";
// if "class" is nearer it is a CLASS. The first version demanded every quoted token be an id, which
// rejected a hand-written correct page over <li class="s9-card"> - caught by the positive control.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function goalTokens(goalText) {
  const ids = [], classes = [];
  const re = /"([a-z0-9][a-z0-9_-]{2,})"/gi;
  let m;
  while ((m = re.exec(goalText)) !== null) {
    const tok = m[1];
    if (tok.includes('.')) continue;
    const pre = goalText.slice(Math.max(0, m.index - 90), m.index);
    const idHits = [...pre.matchAll(/\bids?\b/gi)];
    const clHits = [...pre.matchAll(/\bclass(?:es)?\b/gi)];
    const lastId = idHits.length ? idHits[idHits.length - 1].index : -1;
    const lastCl = clHits.length ? clHits[clHits.length - 1].index : -1;
    if (lastCl > lastId) { if (!classes.includes(tok)) classes.push(tok); }
    else if (lastId >= 0) { if (!ids.includes(tok)) ids.push(tok); }
  }
  return { ids, classes };
}

export function htmlCheck(ws, file, goalText) {
  const src = readFileSync(join(ws, file), 'utf8');
  const { ids, classes } = goalTokens(goalText);
  const missingIds = ids.filter((id) => !new RegExp('id\s*=\s*["\u0027]' + id + '["\u0027]').test(src));
  // A class named by the goal is created at runtime, so it need only APPEAR in the source (markup
  // or the script that builds the element) - requiring a static class= attribute would be wrong.
  const missingClasses = classes.filter((c) => !src.includes(c));
  const refs = [...src.matchAll(/(?:src|href)\s*=\s*["\u0027]([^"\u0027]+)["\u0027]/g)].map((x) => x[1])
    .filter((u) => !/^(https?:|\/\/|#|data:|mailto:)/.test(u));
  const missingRefs = refs.filter((u) => !existsSync(join(ws, u.split(/[?#]/)[0])));
  const ok = missingIds.length === 0 && missingClasses.length === 0 && missingRefs.length === 0;
  const msg = ok ? '' : ('missing ids ' + JSON.stringify(missingIds)
    + ' missing classes ' + JSON.stringify(missingClasses)
    + ' dead refs ' + JSON.stringify(missingRefs)).slice(0, 130);
  return { ok, names: [], msg };
}
