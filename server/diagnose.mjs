/**
 * diagnose.mjs - ACTIVE DIAGNOSIS: maintain competing explanations for an observed failure, choose
 * the observation that separates them, eliminate what the observation contradicts, and only then
 * state a repair scope and its proof obligations. Decline when the evidence does not separate them.
 *
 * WHY THIS EXISTS. Every experiment so far has asked a model to "fix it" and measured what came
 * back. The question between detection and editing was always answered by a person: notice what
 * evidence is missing, design the probe, interpret it, choose the scope. REPAIR-2 is the clean
 * example - the error "Cannot read properties of null (reading 'addEventListener')" is equally
 * consistent with "the element is not there yet", "the id is wrong" and "the interface was never
 * built", and the model picked the first because nothing separated them. This module makes that step
 * mechanical.
 *
 * WHAT IS AUTOMATIC AND WHAT IS AUTHORED, stated plainly because it is the whole question:
 *
 *   AUTHORED by me   the catalogue below: which explanations exist for a failure signature, which
 *                    observation discriminates a pair of them, and what each explanation implies for
 *                    scope and obligations.
 *   AUTOMATIC        for a given failure: which explanations apply, which observation to take, what
 *                    that observation eliminates, whether one explanation survives, and the scope
 *                    and obligations that follow. No human reads the error.
 *
 * So this is selection within a declared space, not open-ended invention. It is exactly the step
 * that was being done by hand, and nothing more than that.
 *
 * `diagnose()` is PURE over captured evidence, so it can be tested without a browser. Collecting the
 * evidence is `collectEvidence()`, which runs the play and a syntax check.
 */

// ── failure signatures, read off the evidence, never guessed ──────────────────────────────────
const SIGNATURES = [
  { id: 'SYNTAX_INVALID', test: (e) => e.syntax && e.syntax.ok === false },
  { id: 'NULL_PROPERTY_READ', test: (e) => firstError(e, /Cannot read propert(?:y|ies) of null \(reading '([^']+)'\)/) },
  { id: 'NULL_PROPERTY_WRITE', test: (e) => firstError(e, /Cannot set propert(?:y|ies) of null \(setting '([^']+)'\)/) },
  { id: 'STATE_CHANGED_WHEN_IT_MUST_NOT', test: (e) => (e.failingStepNames || []).some((n) => /leaves the state unchanged|changes nothing/i.test(n)) },
  { id: 'REQUIRED_EFFECT_ABSENT', test: (e) => (e.failingStepNames || []).some((n) => /creates|spends|plants/i.test(n)) },
];

function firstError(e, re) {
  for (const msg of e.errors || []) { const m = re.exec(msg); if (m) return true; }
  return false;
}
function failingSelector(e) {
  const look = e.dom && e.dom.nullLookups;
  return look && look.length ? String(look[0]) : null;
}
/** Levenshtein, small and exact - used only to ask "is there an id one typo away?". */
function distance(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}

/**
 * THE CATALOGUE. Each explanation declares what it predicts about an observation, so an observation
 * can contradict it. An explanation nothing can contradict is not allowed here.
 */
export const EXPLANATIONS = [
  {
    id: 'MALFORMED_CODE',
    signature: 'SYNTAX_INVALID',
    says: 'the script does not parse, so nothing else can be concluded until it does',
    predicts: () => ({ probe: 'SYNTAX', expect: 'invalid' }),
    scope: (e) => (e.syntax && e.syntax.line ? { kind: 'line', line: e.syntax.line } : { kind: 'file' }),
    obligations: () => ['the script must parse', 'no behaviour claim may be made until it does'],
  },
  {
    id: 'LOOKUP_TOO_EARLY',
    signature: 'NULL_PROPERTY_READ',
    says: 'the element exists in the document but the lookup ran before it was there',
    predicts: () => ({ probe: 'IDS_PRESENT', expect: 'absent at failure, PRESENT once ready' }),
    holds: (obs) => { const o = obs.IDS_PRESENT || {}; return o.idsAfterReady !== null && o.selector !== null
      && o.idsAfterReady.includes(o.selector) && !(o.idsAtFailure || []).includes(o.selector); },
    scope: (e) => ({ kind: 'line', line: lineOfStack(e) }),
    obligations: () => ['the lookup must happen after the element exists', 'no element may be invented'],
  },
  {
    id: 'WRONG_IDENTIFIER',
    signature: 'NULL_PROPERTY_READ',
    says: 'the element exists under a different name and the code asks for the wrong one',
    predicts: () => ({ probe: 'IDS_PRESENT', expect: 'a near-identical id present once ready' }),
    holds: (obs) => { const o = obs.IDS_PRESENT || {}; return o.selector !== null && !(o.idsAfterReady || []).includes(o.selector)
      && (o.idsAfterReady || []).some((id) => id !== o.selector && distance(id.toLowerCase(), o.selector.toLowerCase()) <= 2); },
    scope: (e) => ({ kind: 'line', line: lineOfStack(e) }),
    obligations: (obs) => [`the lookup must name an id the document has: ${JSON.stringify((obs.IDS_PRESENT || {}).idsAfterReady || [])}`, 'no element may be invented'],
  },
  {
    id: 'INTERFACE_NEVER_BUILT',
    signature: 'NULL_PROPERTY_READ',
    says: 'nothing in the document provides that element, so the code assumes an interface that is not there',
    predicts: () => ({ probe: 'IDS_PRESENT', expect: 'absent at failure AND absent once ready, with no near match' }),
    holds: (obs) => { const o = obs.IDS_PRESENT || {}; return o.selector !== null && o.idsAfterReady !== null
      && !o.idsAfterReady.includes(o.selector)
      && !o.idsAfterReady.some((id) => distance(id.toLowerCase(), o.selector.toLowerCase()) <= 2); },
    scope: (e) => ({ kind: 'line', line: lineOfStack(e) }),
    obligations: (obs) => [
      `the repair must not depend on an element with id ${JSON.stringify((obs.IDS_PRESENT || {}).selector)}, which the document does not have`,
      `the interface the requirement names must be used instead of an invented one`,
      'no element may be invented',
    ],
    // What the observation supports, and what it does not - carried with the conclusion.
    limits: () => ['an absent id at readyState complete rules out "readiness will create it" IN THE OBSERVED STATE; it does not rule out a later dynamic insertion by some other script'],
  },
  {
    id: 'EFFECT_OUTSIDE_ITS_GUARD',
    signature: 'STATE_CHANGED_WHEN_IT_MUST_NOT',
    says: 'a state update runs on a path where the action it belongs to did nothing',
    predicts: () => ({ probe: 'STATE_DELTA', expect: 'a counter moved while the thing it counts did not' }),
    holds: (obs) => { const o = obs.STATE_DELTA || {}; return o.available === true && o.counterMoved === true && o.subjectMoved === false; },
    scope: (e) => ({ kind: 'line', line: lineOfStack(e) }),
    obligations: () => [
      'every state update must sit on the same path as the effect it accompanies',
      'the action must change nothing when its precondition does not hold',
    ],
  },
];

function lineOfStack(e) {
  for (const t of e.stacks || []) {
    const m = /:(\d+):\d+\)?\s*$/m.exec(String(t).split('\n').find((l) => /:\d+:\d+/.test(l)) || '');
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

/** THE OBSERVATIONS. Each reads captured evidence; none of them is a judgement. */
export const PROBES = {
  SYNTAX: (e) => ({ available: !!e.syntax, ok: e.syntax ? e.syntax.ok : null }),
  IDS_PRESENT: (e) => ({
    available: !!(e.dom && (e.dom.idsAfterReady || e.dom.nullLookups)),
    selector: failingSelector(e),
    idsAtFailure: e.dom ? e.dom.idsAtFirstFailure : null,
    idsAfterReady: e.dom ? e.dom.idsAfterReady : null,
    readyState: e.dom ? e.dom.readyState : null,
  }),
  STATE_DELTA: (e) => ({ available: !!e.stateDelta, ...(e.stateDelta || {}) }),
};

/**
 * Diagnose one failure. Returns the competing explanations, the observation chosen to separate them,
 * what survived, and either a bounded repair plan or a refusal naming what is still missing.
 */
export function diagnose(evidence) {
  const out = { reproduced: null, signatures: [], considered: [], observations: {}, surviving: [], plan: null, declined: null };

  // 1. REPRODUCE. Without a reproduced failure there is nothing to explain.
  if (!evidence || evidence.reproduced !== true) {
    out.reproduced = false;
    out.declined = { reason: 'UNREPRODUCED', needed: 'a run of the failing case that captures the error, the code version and the observed state' };
    return out;
  }
  out.reproduced = true;

  // 2. SIGNATURES, read off the evidence.
  out.signatures = SIGNATURES.filter((s) => { try { return !!s.test(evidence); } catch { return false; } }).map((s) => s.id);
  if (!out.signatures.length) {
    out.declined = { reason: 'NO_SIGNATURE_MATCHED', needed: 'a failure signature this catalogue covers; the observed failure is outside it' };
    return out;
  }

  // ONE SIGNATURE AT A TIME, IN PRIORITY ORDER. A failing page usually signals several at once, and
  // they are not independent: a script that does not parse explains every behavioural failure after
  // it, and a page that threw while loading never reached its behavioural checks at all - so those
  // checks' verdicts describe nothing. Diagnosing the earliest blocking signature alone is both
  // correct and the reason an unavailable behavioural observation must not veto a load-time
  // diagnosis. The first version demanded every probe any candidate explanation named, so arm B's
  // real failure declined for want of a state delta that could not exist on a page exposing no state.
  const PRIORITY = ['SYNTAX_INVALID', 'NULL_PROPERTY_READ', 'NULL_PROPERTY_WRITE', 'STATE_CHANGED_WHEN_IT_MUST_NOT', 'REQUIRED_EFFECT_ABSENT'];
  const primary = PRIORITY.find((id) => out.signatures.includes(id));
  out.primarySignature = primary;
  out.alsoSignalled = out.signatures.filter((id) => id !== primary);
  out.blocking = primary === 'SYNTAX_INVALID' || primary === 'NULL_PROPERTY_READ' || primary === 'NULL_PROPERTY_WRITE'
    ? 'this failure happens before or during load, so the behavioural checks below it were never reached and their verdicts are not evidence about behaviour'
    : null;

  // 3. COMPETING EXPLANATIONS for that one signature.
  const competing = EXPLANATIONS.filter((x) => x.signature === primary);
  out.considered = competing.map((x) => ({ id: x.id, says: x.says, predicts: x.predicts() }));
  if (!competing.length) {
    out.declined = { reason: 'NO_EXPLANATION_FOR_SIGNATURE', needed: `an explanation covering ${primary}` };
    return out;
  }

  // 4. THE OBSERVATION THAT SEPARATES THEM. Each explanation names the probe it can be contradicted
  // by; take every probe the competing set asks for, once.
  const wanted = [...new Set(competing.map((x) => x.predicts().probe))];
  for (const name of wanted) out.observations[name] = PROBES[name] ? PROBES[name](evidence) : { available: false };
  const unavailable = wanted.filter((n) => !out.observations[n] || out.observations[n].available === false);
  if (unavailable.length) {
    out.declined = {
      reason: 'OBSERVATION_UNAVAILABLE',
      needed: `these observations are required to separate ${competing.map((x) => x.id).join(' / ')}: ${unavailable.join(', ')}`,
      competing: competing.map((x) => x.id),
    };
    return out;
  }

  // 5. ELIMINATE. An explanation survives only if the observation it named is consistent with it.
  // The probe results stay KEYED BY PROBE: an explanation may only consult the observation it
  // declared it could be contradicted by. Flattening them once let a predicate read a field that did
  // not exist and threw at the moment it was supposed to be eliminating an explanation.
  const obs = out.observations;
  out.surviving = competing.filter((x) => (typeof x.holds === 'function' ? !!x.holds(obs) : true)).map((x) => x.id);
  out.eliminated = competing.filter((x) => !out.surviving.includes(x.id)).map((x) => ({ id: x.id, contradictedBy: x.predicts().probe }));

  // 6. ONE SURVIVOR, OR DECLINE. Two surviving explanations imply different repairs, and guessing
  // between them is the thing this module exists to stop.
  if (out.surviving.length !== 1) {
    out.declined = {
      reason: out.surviving.length === 0 ? 'ALL_EXPLANATIONS_CONTRADICTED' : 'EXPLANATIONS_STILL_TIED',
      surviving: out.surviving,
      needed: out.surviving.length === 0
        ? 'an explanation this catalogue does not contain: every candidate was contradicted by the observations'
        : 'a further observation that distinguishes the survivors; none in the catalogue does',
    };
    return out;
  }

  // 7. THE BOUNDED PLAN. Smallest scope the evidence supports, with its obligations and limits.
  const winner = competing.find((x) => x.id === out.surviving[0]);
  out.plan = {
    cause: winner.id,
    says: winner.says,
    scope: winner.scope(evidence),
    scopePreference: 'edit before rewrite: the smallest region the evidence implicates. Broaden only after a bounded attempt fails its obligations, and record why.',
    obligations: [
      ...winner.obligations(obs),
      ...(evidence.failingStepNames || []).map((n) => `the failing check must pass: ${n}`),
      ...(evidence.protectedStepNames || []).map((n) => `this must keep passing: ${n}`),
    ],
    limits: typeof winner.limits === 'function' ? winner.limits(obs) : [],
    evidenceUsed: { signatures: out.signatures, observations: wanted },
  };
  return out;
}

/** Collect the evidence `diagnose` needs: run the play, and check that the script parses. */
export async function collectEvidence({ workspace, task, deps }) {
  const { playCheck, writeFileSync, readFileSync, mkdtempSync, rmSync, join, tmpdir, execFileSync } = deps;
  const spec = task.diagnostic.spec;
  const entry = spec.entry || 'index.html';
  const file = readFileSync(join(workspace, entry), 'utf8');
  const play = await playCheck(workspace, spec, { timeoutMs: 90_000 });

  // Does the script parse? A malformed script explains everything else, so it is checked first - and
  // EVERY script block is checked, not just the first. Checking only the first missed a malformed
  // later block entirely and let a load-time exception be diagnosed as a behavioural cause. The
  // reported line is translated into a FILE line, so the scope it yields points at the real file.
  let syntax = { ok: true, line: null };
  const dir = mkdtempSync(join(tmpdir(), 'syn-'));
  try {
    const re = /<script>([\s\S]*?)<\/script>/g;
    let m, block = 0;
    while ((m = re.exec(file)) !== null) {
      block++;
      const body = m[1];
      const f = join(dir, `c${block}.js`);
      writeFileSync(f, body, 'utf8');
      try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (err) {
        const text = String(err.stderr || err.message || '');
        const lm = new RegExp(`c${block}\\.js:(\\d+)`).exec(text);
        const inBlock = lm ? parseInt(lm[1], 10) : null;
        const blockStartLine = file.slice(0, m.index + m[0].indexOf(body)).split('\n').length;
        syntax = {
          ok: false, block,
          line: inBlock ? blockStartLine + inBlock - 1 : null,
          lineWithinBlock: inBlock,
          message: (text.split('\n').find((l) => /Error/.test(l)) || '').trim().slice(0, 200),
        };
        break;
      }
    }
  } finally { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } }

  const failing = new Set([...(play.failing || [])]);
  const caseName = (n) => (play.cases || []).find((c) => c.n === n)?.name || `step ${n}`;
  const protectedSteps = task.protected?.play?.steps || [];
  return {
    reproduced: play.status === 'OK' && failing.size > 0,
    file, errors: [...(play.errors || [])], stacks: [...(play.stacks || [])], dom: play.dom || null,
    syntax,
    failingStepNames: [...failing].map(caseName),
    protectedStepNames: protectedSteps.map(caseName),
    stateDelta: stateDeltaFrom(play),
    play,
  };
}

/**
 * The one behavioural observation this catalogue needs: on the step that says the state must not
 * change, did a counter move while the thing it counts did not? Read from the play's own dump.
 */
function stateDeltaFrom(play) {
  const c = (play.cases || []).find((x) => x.kind !== 'PASS' && /unchanged|changes nothing/i.test(x.name || ''));
  if (!c) return null;
  const m = /state (\{[\s\S]*)$/.exec(c.text || '');
  if (!m) return null;
  let state; try { state = JSON.parse(m[1].replace(/\}[^}]*$/, '}')); } catch { return null; }
  const seeds = state?.inventory?.seeds;
  const tiles = state?.tiles ? Object.keys(state.tiles).length : null;
  if (typeof seeds !== 'number' || tiles === null) return null;
  // The step presses the action twice on one tile: a seed spent with no second tile created is the
  // signature of an update outside its guard.
  return { counterMoved: seeds < 5 - tiles, subjectMoved: false, seeds, tiles };
}
