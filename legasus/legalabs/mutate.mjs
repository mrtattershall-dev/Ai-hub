// CHECKED SOURCE MUTATION — one operation, which refuses rather than reporting a success it did not have.
//
// Three defects in a single session shared one shape, and none of them threw:
//
//   a patch script printed "threshold tightened", matched nothing, and changed nothing
//   a commit-msg guard was installed, ran, and admitted every message it was built to refuse
//   a `python -c` diagnostic lost its backslashes in the shell and died on a SyntaxError
//
// The common form is the standing lens of this whole project: THE COSTLY FAILURES DO NOT CRASH. They
// report OK while the work is lost. Fourteen recorded occurrences of the shell-quoting class alone is
// proof that behavioural discipline does not control it.
//
//     IF VIOLATING AN INVARIANT IS CHEAP AND SILENT, MECHANIZE THE BOUNDARY.
//
// So a mutation is not "apply a regex and hope". It is a transaction with a stated INTENT, and it must
// prove it did what it said:
//
//     INTENT  ->  TRANSFORM  ->  ACTUAL BYTES CHANGED?  ->  POST-CONDITIONS HOLD?  ->  COMMIT
//                      |                  |                        |
//                      +-- REFUSE --------+------------------------+
//
// Every refusal names which stage refused. A caller that ignores the return value gets no mutation at
// all, because nothing is written until every stage has passed.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

export const REFUSED = {
  NO_SUCH_FILE: 'NO_SUCH_FILE',
  ANCHOR_ABSENT: 'ANCHOR_ABSENT',         // the thing being replaced was not there
  ANCHOR_AMBIGUOUS: 'ANCHOR_AMBIGUOUS',   // it was there more than once, so the site is not identified
  NO_CHANGE: 'NO_CHANGE',                 // the transform ran and produced identical bytes
  POSTCONDITION: 'POSTCONDITION',         // the result is not what the intent promised
  UNPARSEABLE: 'UNPARSEABLE',             // the result does not parse, and the intent did not say it would
};

const PY_PARSE = [
  'import ast, sys',
  'src = sys.stdin.read()',
  'try:',
  '    ast.parse(src)',
  '    print("OK")',
  'except SyntaxError as e:',
  '    print("ERR:" + str(e.msg) + " @line " + str(e.lineno))',
].join(String.fromCharCode(10));

// Sanity for the languages this project actually mutates. UNKNOWN is never an approval.
export function parses(text, language) {
  if (language === 'python') {
    try {
      const out = execFileSync('python', ['-c', PY_PARSE],
        { input: text, encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
      return out.startsWith('OK') ? { ok: true } : { ok: false, why: out.trim() };
    } catch (e) { return { ok: null, why: 'the parse harness could not run' }; }
  }
  return { ok: null, why: 'no parser configured for ' + language };
}

// THE OPERATION. `find` may be a string (which must occur EXACTLY ONCE - an ambiguous anchor does not
// identify a site, which is a lesson already paid for in this repository) or a function.
export function mutate({ file, text, find, replace, transform, language = null,
  expectChange = true, expectParses = null, postconditions = [], write = false }) {
  let before;
  if (file !== undefined) {
    if (!existsSync(file)) return { ok: false, refused: REFUSED.NO_SUCH_FILE, file };
    before = readFileSync(file, 'utf8');
  } else {
    before = text;
  }

  let after;
  if (typeof transform === 'function') {
    after = transform(before);
    if (after === null || after === undefined) {
      return { ok: false, refused: REFUSED.POSTCONDITION,
        why: 'the transform declined to produce a result, which is not the same as succeeding' };
    }
  } else {
    if (typeof find !== 'string') {
      return { ok: false, refused: REFUSED.POSTCONDITION, why: 'no transform and no string anchor' };
    }
    let count = 0; let idx = before.indexOf(find);
    while (idx !== -1) { count++; idx = before.indexOf(find, idx + find.length); }
    if (count === 0) {
      return { ok: false, refused: REFUSED.ANCHOR_ABSENT,
        why: 'the anchor does not occur in the source, so nothing was replaced. A patch that silently'
          + ' matches nothing is the defect this operation exists to prevent.' };
    }
    if (count > 1) {
      return { ok: false, refused: REFUSED.ANCHOR_AMBIGUOUS, occurrences: count,
        why: 'the anchor occurs ' + count + ' times and therefore does not identify a site' };
    }
    after = before.replace(find, replace);
  }

  if (expectChange && after === before) {
    return { ok: false, refused: REFUSED.NO_CHANGE,
      why: 'the transform ran and produced byte-identical output. This is the shape of a patch script'
        + ' that reports success and changes nothing.' };
  }
  if (!expectChange && after !== before) {
    return { ok: false, refused: REFUSED.POSTCONDITION,
      why: 'the transform was declared non-mutating and changed the bytes' };
  }

  // Parse sanity, when the intent says the result should parse. A DELIBERATELY broken result is a valid
  // intent - that is how damage interventions are built - so this is opt-in and explicit either way.
  if (expectParses !== null && language) {
    const p = parses(after, language);
    if (p.ok === null) {
      return { ok: false, refused: REFUSED.UNPARSEABLE,
        why: 'parse sanity was requested and could not be evaluated: ' + p.why
          + '. An unrunnable check has NOT passed.' };
    }
    if (p.ok !== expectParses) {
      return { ok: false, refused: REFUSED.UNPARSEABLE,
        why: 'intent said parses=' + expectParses + ' and the result ' + (p.ok ? 'parses' : 'does not')
          + (p.why ? ': ' + p.why : '') };
    }
  }

  for (const [i, pc] of postconditions.entries()) {
    let held;
    try { held = !!pc.test(after, before); } catch (e) { held = false; }
    if (!held) {
      return { ok: false, refused: REFUSED.POSTCONDITION, index: i,
        why: 'postcondition failed: ' + (pc.why || '#' + i) };
    }
  }

  if (write && file !== undefined) writeFileSync(file, after, 'utf8');
  return { ok: true, before, after, wrote: !!(write && file !== undefined),
    beforeSha: sha(before), afterSha: sha(after),
    bytes: after.length - before.length };
}
