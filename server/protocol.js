/**
 * protocol.js - the gated micro-loop controller. PROTOCOL-1's TREATMENT arm.
 *
 * See legasus/screen/PROTOCOL-1_PREREG.md. The CONTROL arm is the hub's existing monolithic
 * ACTION loop, which is not touched.
 *
 * WHY THIS EXISTS. Two model sizes failed the monolithic protocol the same way, one size
 * apart: the 1.5B made ~20 calls with ZERO writes to a protected target; the 7B used 12-19s
 * of a 600s budget with an identical trajectory at 60s and 600s. Both stalls were structural,
 * not stochastic.
 *
 * THE SPLIT OF AUTHORITY - the whole idea:
 *
 *     MODEL OWNS                      CONTROLLER OWNS
 *       what should change              which files have been observed, and their hashes
 *       reasoning about code            the exact current source state
 *       generating code                 which tools are legal in this phase
 *       choosing among a few intents    whether an action changed anything
 *                                       whether this action already failed
 *                                       verification obligations
 *                                       progress state between calls
 *
 * The model keeps INTENT authority and loses BOOKKEEPING authority. That is the same move d2
 * makes on effects, applied one level up.
 *
 * WHAT THIS FILE MAY NOT BECOME. The rules below are derived from responsibility boundaries,
 * NOT from the two observed specimens (`outline_file` x6 and a hallucinated FIND). If those
 * pathologies disappear it must be as a CONSEQUENCE of a general rule. Tuning against the
 * specimens would make the experiment prove nothing - the trap
 * `contract-derivation-contaminated-treatment` records, where one heuristic defined both the
 * instruction and the evaluator.
 */
import { createHash } from 'node:crypto';

/** The phases. A turn belongs to exactly one, and that decides what is legal. */
export const PHASE = {
  OBSERVE: 'OBSERVE',     // controller supplies state; model may only inspect
  DECIDE: 'DECIDE',       // model picks ONE bounded intent
  PRODUCE: 'PRODUCE',     // model emits only the artifact that intent needs
  APPLY: 'APPLY',         // controller applies it; no model involvement
  VERIFY: 'VERIFY',       // controller runs checks; no model involvement
  DONE: 'DONE',
};

/** Why a turn was refused. Distinct values, never collapsed into one "no". */
export const REFUSAL = {
  WRONG_PHASE: 'WRONG_PHASE',                 // R2
  EVIDENCE_UNCHANGED: 'EVIDENCE_UNCHANGED',   // R3
  STALE_EVIDENCE: 'STALE_EVIDENCE',           // R1
  UNKNOWN_INTENT: 'UNKNOWN_INTENT',
};

export const hashOf = (s) => createHash('sha256').update(String(s ?? ''), 'utf8').digest('hex').slice(0, 16);

/**
 * The controller. Holds ALL progress state, so nothing depends on the model remembering
 * anything between calls - which is the property the monolithic loop could not provide.
 */
export class ProtocolController {
  constructor({ readFile, applyEdit, verify, targets = [] }) {
    this.readFile = readFile;       // (path) -> string | null
    this.applyEdit = applyEdit;     // ({path, content}) -> {ok, error?}
    this.verify = verify;           // ({path}) -> {ok, detail}
    this.targets = targets;

    this.phase = PHASE.OBSERVE;
    this.evidence = new Map();      // path -> { hash, content, at }
    this.attempted = new Set();     // (intent|args|stateHash) that produced no progress
    this.pendingIntent = null;
    this.obligations = [];          // R4: verification owed, created by mutation
    this.log = [];                  // every transition, for the controls to read
  }

  _record(event, detail = {}) { this.log.push({ n: this.log.length + 1, phase: this.phase, event, ...detail }); }

  /** The key a repetition is judged on: intent + args + the state it was decided against. */
  _key(intent, args, path) {
    const ev = this.evidence.get(path);
    return `${intent}|${JSON.stringify(args ?? {})}|${ev ? ev.hash : 'NO-EVIDENCE'}`;
  }

  /** What the model is allowed to do right now. Deliberately small. */
  legalActions() {
    switch (this.phase) {
      case PHASE.OBSERVE: {
        // R3, stated generally: a completed evidence-acquisition step cannot be repeated
        // while its underlying evidence is unchanged. So a file whose CURRENT hash already
        // matches recorded evidence is not offerable - the action does not exist in this
        // state rather than being refused after the fact.
        const need = this.targets.filter((p) => {
          const live = this.readFile(p);
          const ev = this.evidence.get(p);
          return live !== null && (!ev || ev.hash !== hashOf(live));
        });
        return need.length ? [{ intent: 'observe', paths: need }] : [{ intent: 'decide' }];
      }
      case PHASE.DECIDE:
        // Only targets the model has FRESH evidence for. It cannot decide to change
        // something it has not been shown.
        return [{ intent: 'modify', paths: [...this.evidence.keys()] }, { intent: 'finish' }];
      case PHASE.PRODUCE:
        return [{ intent: 'produce', path: this.pendingIntent?.path }];
      default:
        return [];                   // APPLY / VERIFY / DONE are the controller's alone
    }
  }

  /**
   * R1: the exact current content and hash of what the model is about to reason about.
   * The model is NEVER asked to recall source text - the hallucinated-FIND failure mode is
   * unreachable because recalled text is never the basis of an edit.
   */
  observe(paths) {
    if (this.phase !== PHASE.OBSERVE) return { ok: false, refusal: REFUSAL.WRONG_PHASE, phase: this.phase };
    const given = {};
    for (const p of paths) {
      const content = this.readFile(p);
      if (content === null) continue;
      const hash = hashOf(content);
      this.evidence.set(p, { hash, content, at: Date.now() });
      given[p] = { hash, content };
    }
    this._record('observed', { paths: Object.keys(given) });
    this.phase = PHASE.DECIDE;
    return { ok: true, evidence: given, phase: this.phase };
  }

  /** The model's ONE bounded intent. */
  decide(intent, args = {}) {
    if (this.phase !== PHASE.DECIDE) return { ok: false, refusal: REFUSAL.WRONG_PHASE, phase: this.phase };
    if (intent === 'finish') { this.phase = PHASE.DONE; this._record('finish'); return { ok: true, phase: this.phase }; }
    if (intent !== 'modify') return { ok: false, refusal: REFUSAL.UNKNOWN_INTENT, phase: this.phase };
    const path = args.path;
    const ev = this.evidence.get(path);
    if (!ev) return { ok: false, refusal: REFUSAL.STALE_EVIDENCE, phase: this.phase, why: `no fresh evidence for ${path}` };

    // R3 again, at the decision level: the same intent against the same state, twice, is not
    // a warning - it is a mechanical transition back to OBSERVE.
    const key = this._key(intent, args, path);
    if (this.attempted.has(key)) {
      this._record('repetition-detected', { key });
      this.phase = PHASE.OBSERVE;
      this.evidence.delete(path);   // force fresh evidence before it may be tried again
      return { ok: false, refusal: REFUSAL.EVIDENCE_UNCHANGED, phase: this.phase, transitioned: true };
    }
    this.pendingIntent = { intent, path, args, key, decidedAgainst: ev.hash };
    this.phase = PHASE.PRODUCE;
    this._record('decided', { intent, path });
    return { ok: true, phase: this.phase, evidence: { path, hash: ev.hash, content: ev.content } };
  }

  /**
   * The model supplies the new content for the bounded region. Whole-content, against the
   * exact text it was just given - so there is no FIND snippet to hallucinate.
   */
  produce(content) {
    if (this.phase !== PHASE.PRODUCE) return { ok: false, refusal: REFUSAL.WRONG_PHASE, phase: this.phase };
    const { path, key, decidedAgainst } = this.pendingIntent;

    // R1 enforced at apply time: if the file moved under us between DECIDE and PRODUCE, the
    // artifact was reasoned against a state that no longer exists. Back to OBSERVE - never
    // applied, and never retried blind.
    const liveNow = this.readFile(path);
    if (liveNow === null || hashOf(liveNow) !== decidedAgainst) {
      this._record('stale-rejected', { path });
      this.phase = PHASE.OBSERVE;
      this.evidence.delete(path);
      this.pendingIntent = null;
      return { ok: false, refusal: REFUSAL.STALE_EVIDENCE, phase: this.phase, transitioned: true };
    }

    this.phase = PHASE.APPLY;
    const res = this.applyEdit({ path, content });
    const changed = res.ok && hashOf(this.readFile(path)) !== decidedAgainst;
    if (!changed) {
      // Produced no progress. Mark the key so the same thing cannot be tried again against
      // the same state, and go back to OBSERVE rather than letting it be resent.
      this.attempted.add(key);
      this._record('no-progress', { path, error: res.error || 'content identical' });
      this.phase = PHASE.OBSERVE;
      this.evidence.delete(path);
      this.pendingIntent = null;
      return { ok: false, refusal: REFUSAL.EVIDENCE_UNCHANGED, phase: this.phase, transitioned: true };
    }

    // R4: mutation CREATES a verification obligation. The model is never asked whether it
    // should test - that is the "advisory does not work" lesson applied structurally.
    this.obligations.push({ path, from: decidedAgainst });
    this.evidence.delete(path);      // the file changed: prior evidence is void by definition
    this.pendingIntent = null;
    this.phase = PHASE.VERIFY;
    this._record('applied', { path });
    return { ok: true, phase: this.phase };
  }

  /** Runs automatically. No model involvement, and the obligation is discharged here. */
  runVerification() {
    if (this.phase !== PHASE.VERIFY) return { ok: false, refusal: REFUSAL.WRONG_PHASE, phase: this.phase };
    const results = this.obligations.map((o) => ({ path: o.path, ...this.verify({ path: o.path }) }));
    this.obligations = [];
    this.phase = PHASE.OBSERVE;
    this._record('verified', { results: results.map((r) => `${r.path}:${r.ok ? 'ok' : 'FAIL'}`) });
    return { ok: true, results, phase: this.phase };
  }

  /** Progress state the model never has to carry. */
  state() {
    return {
      phase: this.phase,
      observed: [...this.evidence.keys()],
      hashes: Object.fromEntries([...this.evidence].map(([p, e]) => [p, e.hash])),
      deadKeys: this.attempted.size,
      pendingObligations: this.obligations.length,
      turns: this.log.length,
    };
  }
}
