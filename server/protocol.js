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
  /**
   * `applyEdit` and `verify` are OPTIONAL, and the real-hub integration passes NEITHER.
   *
   * THE CONTROLLER MUST NOT OWN EXECUTION. The hub's shared tool site (agent.js:3566) is what
   * emits host events, captures beforeSrc, and runs the lost-definition guards, the repeat
   * guards and the syntax rollback. A controller that applied its own mutations would hand the
   * TREATMENT arm a privileged path around all of that - and around d2 - so any A/B difference
   * could come from the shortcut rather than from the interaction contract. The arms must
   * differ ONLY in what is asked of the model and which actions are legal.
   *
   * So the integration uses validate()/notifyResult() and lets the hub execute. The injected
   * forms remain for the standalone control, which tests the state machine in isolation.
   */
  constructor({ readFile, applyEdit = null, verify = null, targets = [] }) {
    this.readFile = readFile;       // (path) -> string | null
    this.applyEdit = applyEdit;     // standalone control only; null in the real hub
    this.verify = verify;           // standalone control only; null in the real hub
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

  // ── the real-hub interface: VALIDATE, then be TOLD what happened ─────────────────────
  //
  // The hub executes; the controller never does. Everything below only inspects and records.

  /**
   * Is this tool call legal in the current phase, against current evidence?
   *
   * Returns a refusal rather than throwing, because the caller's job is to feed the refusal
   * back as the next instruction - not to end the run. The action set is small by
   * construction (R2), so "illegal" here means the model reached outside its current
   * responsibility, which is information worth returning to it.
   */
  validate(tool, args = {}) {
    const READ = new Set(['read_file', 'outline_file', 'search_file', 'list_dir']);
    const WRITE = new Set(['write_file', 'edit_file', 'append_file']);
    const path = args.path;

    if (tool === 'finish') return this.phase === PHASE.DECIDE
      ? { ok: true }
      : { ok: false, refusal: REFUSAL.WRONG_PHASE, phase: this.phase };

    if (READ.has(tool)) {
      if (this.phase !== PHASE.OBSERVE) return { ok: false, refusal: REFUSAL.WRONG_PHASE, phase: this.phase };
      // R3 as a general law: a completed evidence-acquisition step cannot be repeated while
      // its underlying evidence is unchanged. Not a warning - a refusal the caller turns into
      // a transition.
      const live = this.readFile(path);
      const ev = this.evidence.get(path);
      if (live !== null && ev && ev.hash === hashOf(live)) {
        return { ok: false, refusal: REFUSAL.EVIDENCE_UNCHANGED, phase: this.phase, path };
      }
      return { ok: true };
    }

    if (WRITE.has(tool)) {
      if (this.phase !== PHASE.PRODUCE && this.phase !== PHASE.DECIDE) {
        return { ok: false, refusal: REFUSAL.WRONG_PHASE, phase: this.phase };
      }
      // R1: it may only change what it has been shown, at the hash it was shown.
      const ev = this.evidence.get(path);
      if (!ev) return { ok: false, refusal: REFUSAL.STALE_EVIDENCE, phase: this.phase, path };
      const live = this.readFile(path);
      if (live === null || hashOf(live) !== ev.hash) {
        this.evidence.delete(path);
        return { ok: false, refusal: REFUSAL.STALE_EVIDENCE, phase: this.phase, path, transitioned: true };
      }
      // R3 at the mutation level: the same edit against the same state, twice.
      if (this.attempted.has(this._key(tool, args, path))) {
        return { ok: false, refusal: REFUSAL.EVIDENCE_UNCHANGED, phase: this.phase, path };
      }
      return { ok: true };
    }
    return { ok: false, refusal: REFUSAL.UNKNOWN_INTENT, phase: this.phase };
  }

  /**
   * Told what the hub's shared execution site did. The controller derives everything from the
   * OBSERVED result and the file's real hash - never from what the model claimed.
   */
  notifyResult(tool, args = {}, result = '') {
    const path = args.path;
    const failed = /^ERROR/.test(String(result ?? ''));
    const READ = new Set(['read_file', 'outline_file', 'search_file', 'list_dir']);
    const WRITE = new Set(['write_file', 'edit_file', 'append_file']);

    if (READ.has(tool) && !failed && path) {
      const content = this.readFile(path);
      if (content !== null) {
        this.evidence.set(path, { hash: hashOf(content), content, at: Date.now() });
        this._record('observed', { path });
      }
      this.phase = PHASE.DECIDE;
      return this.state();
    }

    if (WRITE.has(tool) && path) {
      const before = this.evidence.get(path)?.hash ?? null;
      const after = this.readFile(path);
      const changed = !failed && after !== null && hashOf(after) !== before;
      if (changed) {
        // R4: mutation CREATES a verification obligation. The model is never asked whether to
        // test. Evidence for a changed file is void by definition.
        this.obligations.push({ path, from: before });
        this.evidence.delete(path);
        this.phase = PHASE.VERIFY;
        this._record('applied', { path });
      } else {
        // No progress: mark the key dead so it cannot be resent against the same state, and
        // transition rather than warn.
        this.attempted.add(this._key(tool, args, path));
        this.evidence.delete(path);
        this.phase = PHASE.OBSERVE;
        this._record('no-progress', { path, failed });
      }
      return this.state();
    }
    return this.state();
  }

  /** The hub has discharged the obligations its own verifier ran. */
  obligationsDischarged() {
    this.obligations = [];
    if (this.phase === PHASE.VERIFY) this.phase = PHASE.OBSERVE;
    this._record('verified');
    return this.state();
  }

  /**
   * The phase-scoped instruction the hub puts in front of the model instead of the monolithic
   * "emit ACTION blocks until done". Carries the exact evidence (R1) so nothing is recalled.
   */
  instruction() {
    switch (this.phase) {
      case PHASE.OBSERVE: {
        const need = this.targets.filter((p) => {
          const live = this.readFile(p);
          const ev = this.evidence.get(p);
          return live !== null && (!ev || ev.hash !== hashOf(live));
        });
        if (!need.length) { this.phase = PHASE.DECIDE; return this.instruction(); }
        return `PHASE: OBSERVE\nYour only job this turn is to read ONE of these files: ${need.join(', ')}\nUse read_file. Nothing else is available in this phase.`;
      }
      case PHASE.DECIDE:
      case PHASE.PRODUCE: {
        const shown = [...this.evidence.entries()]
          .map(([p, e]) => `--- ${p} (hash ${e.hash}) ---\n${e.content}`).join('\n');
        return `PHASE: DECIDE AND PRODUCE\nHere is the EXACT current content of what you have observed. Do not rely on memory of any other file.\n\n${shown}\n\nEither write_file ONE of these files with its complete new contents, or finish. Nothing else is available in this phase.`;
      }
      case PHASE.VERIFY:
        return 'PHASE: VERIFY\nThe hub is verifying the change automatically. Nothing is required from you.';
      default:
        return 'PHASE: DONE';
    }
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
