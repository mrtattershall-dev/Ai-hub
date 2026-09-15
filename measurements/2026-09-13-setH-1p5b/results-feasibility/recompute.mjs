// RECOMPUTE THE ROUTE CRITERION FROM PRESERVED BYTES.
//
// The preregistered definition was: RESPONSIVE = the reply is non-empty AND does not echo the
// instruction text. My implementation of "echo" tested only for
//     /EXISTING and AUTHORITATIVE|REQUESTED CHANGE|INSERT HERE/
// and missed the third instruction line, so a reply beginning
//     "# AT THIS POINT WRITE ONLY THIS: add a new line in the ..."
// was scored echo=false. That is an incomplete IMPLEMENTATION of the stated definition, not a change
// to the definition - so it is fixed, and BOTH numbers are reported so the effect of the fix is
// visible instead of being absorbed into the choice.
//
// No new inference: every reply was written to disk, so the criterion is recomputed over the same
// bytes. This is the whole reason for the preserve-first rule.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.argv[2];
const rows = JSON.parse(readFileSync(join(DIR, 'rows.json'), 'utf8'));

const ECHO_OLD = /EXISTING and AUTHORITATIVE|REQUESTED CHANGE|INSERT HERE/;
const ECHO_NEW = /EXISTING and AUTHORITATIVE|REQUESTED CHANGE|INSERT HERE|AT THIS POINT WRITE ONLY|AT THE MARKER/i;

const byRoute = new Map();
for (const r of rows) {
  const body = readFileSync(join(DIR, 'replies', r.reply_id + '.txt'), 'utf8');
  const snippet = r.route === 'V2_indent_primer' ? ' '.repeat(r.site === 1 ? 4 : 8) + body : body;
  const nonEmpty = !!snippet.trim();
  const rec = byRoute.get(r.route) || { route: r.route, n: 0, respOld: 0, respNew: 0, loads: 0, oldKept: 0, echoNew: 0 };
  rec.n++;
  if (nonEmpty && !ECHO_OLD.test(snippet)) rec.respOld++;
  if (nonEmpty && !ECHO_NEW.test(snippet)) rec.respNew++;
  if (ECHO_NEW.test(snippet)) rec.echoNew++;
  if (r.loads) rec.loads++;
  if (r.old_regression) rec.oldKept++;
  byRoute.set(r.route, rec);
}

console.log('  ROUTE CRITERION, recomputed from preserved bytes');
console.log('  RESPONSIVE = non-empty AND does not echo the instruction');
console.log('  ELIGIBLE   = responsive on at least 6 of 8\n');
console.log('  route              n   responsive(as-run)  responsive(echo fixed)  echoed  loads  oldKept');
const elig = [];
for (const r of [...byRoute.values()]) {
  console.log('  ' + r.route.padEnd(18) + String(r.n).padEnd(4)
    + (r.respOld + '/' + r.n).padEnd(20) + (r.respNew + '/' + r.n).padEnd(24)
    + String(r.echoNew).padEnd(8) + String(r.loads).padEnd(7) + String(r.oldKept));
  if (r.respNew >= 6) elig.push(r);
}
console.log('');
if (!elig.length) {
  console.log('  NO ELIGIBLE ROUTE. Per the preregistered rule, B1 is NOT run and this is the finding:');
  console.log('  none of the three formulations reliably makes this model fill an insertion point.');
} else {
  elig.sort((a, b) => (b.loads - a.loads) || (a.route === 'V2_indent_primer' ? -1 : 1));
  console.log('  ELIGIBLE: ' + elig.map((r) => r.route + ' (' + r.respNew + '/' + r.n + ', loads ' + r.loads + ')').join('  |  '));
  console.log('  CHOSEN:   ' + elig[0].route
    + (elig.length > 1 && elig[0].loads === elig[1].loads ? '   (tie on loads, broken toward native FIM as preregistered)' : '   (most candidates that load)'));
}
