#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// governedRun.mjs — the TREATMENT arm. Identical to the direct arm except for how the effect happens.
//
//   node server/governedRun.mjs --authority-root ../ai-coding-hub-consolidation --pages s01,s02
//
// ══ THE ORDER, AND WHY IT IS THIS ORDER ══════════════════════════════════════════════════════════
//
//   observe -> derive -> generate -> contain -> VERIFY -> authorize narrowly -> effect once -> receipt
//
// VERIFICATION COMES BEFORE AUTHORITY. The verdict is what LICENSES the grant: an EPISTEMIC token is
// minted about this target at the observed revision, and the authority is scoped to that same target
// and that same revision. Committing first and checking afterwards would make the receipt a report
// rather than a justification, and there would be nothing for the evidence obligation to carry.
//
// Everything before the arrow into `verifyCandidate` is `sharedRun.mjs`, called by both arms. The only
// thing this file does differently is the effect: prepare a packet, commit it through the governed
// workspace, and write a receipt binding what was loaded, what was asked, what came back, and what
// landed.
//
// ══ THE RECEIPT BINDS FIVE THINGS IN ONE RECORD ══════════════════════════════════════════════════
//   1. the authority module manifest and digests      - WHAT CODE governed this
//   2. the decoding profile and its resolved values   - WHAT THE MODEL WAS ASKED UNDER
//   3. the observed base revision                     - WHAT STATE IT WAS BUILT ON
//   4. the model request and response digests         - WHAT WAS ASKED AND WHAT CAME BACK
//   5. the observed post-write revision and verdict   - WHAT ACTUALLY LANDED, AND WHETHER IT HELD
//
// Any one of these alone is a story. Together they are the only thing that lets a reader who was not
// here rebuild why this change was retained.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { blankRecord, validateTimingRecord } from './timingContract.mjs';
import { bindAuthority } from './authorityBinding.mjs';
import { observeAndDerive, buildPrompt, generate, extractWholePage, verifyCandidate, sha, nowMs } from './sharedRun.mjs';

const NL = String.fromCharCode(10);
const opt = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const AUTHORITY_ROOT = opt('authority-root', null);
const AUTHORITY_PIN = opt('authority-pin', null);
const PROFILE = opt('profile', 'whole-file-v1');
const MODEL = opt('model', 'qwen2.5-coder:1.5b');
const PAGES = opt('pages', 's01').split(',').map((s) => s.trim()).filter(Boolean);
const OUT = opt('out', 'legasus/records/timing');
const RECEIPTS = opt('receipts', 'legasus/records/receipts');
const RUN_ID = opt('run-id', `timing-governed-${Date.now()}`);
const ENDPOINT = opt('endpoint', 'http://127.0.0.1:11434/api/generate');

// FAIL CLOSED BEFORE ANYTHING ELSE. A governed run that cannot say which authority stack it bound to
// has nothing to govern with, and running anyway would produce a receipt that names nothing.
const authority = await bindAuthority({ root: AUTHORITY_ROOT, pin: AUTHORITY_PIN });
const { governedEdit: _ge, EDIT_FIXTURE_EVIDENCED } = authority.modules['legasus/runtime/epistemic-admission/governed-edit.mjs'];
const { createWorkspace, fileScope, PACKET } = authority.modules['legasus/runtime/governedWorkspace/workspace.mjs'];
const { delegate, observe, isAuthority } = authority.modules['legasus/legaknow/calculus.mjs'];
const { observation, OBSERVABILITY } = authority.modules['legasus/legaknow/observation.mjs'];
void _ge;

/**
 * Promote a verified candidate. `deps` is forwarded to the workspace so the gate can inject a
 * transforming filesystem; nothing else ever passes it.
 */
export async function promote({ canonical, entry, candidate, verdict, deps }) {
  const ws = createWorkspace({ root: canonical, deps });
  const scope = fileScope(entry);
  const baseRevision = ws.revisionOfScope(scope);

  // THE VERDICT BECOMES EVIDENCE. Minted about THIS target at THIS revision - evidence about other
  // bytes cannot satisfy the obligation, which is the point of pinning it here rather than asserting it.
  const evidence = observe({
    observation: observation({
      status: OBSERVABILITY.OBSERVED,
      value: `graph coverage ${verdict.covered.join(',') || 'none'}`,
      subject: entry, producer: 'governedRun', procedure: 'featureGraph.verify', attribution: 'browser', context: 'TIMING-1',
    }),
    procedure: 'featureGraph.verify',
    context: { repository: 'TIMING-1', implementation: entry, revision: baseRevision },
  });
  if (!isAuthority(evidence)) return { promoted: false, reason: 'EVIDENCE_REFUSED', why: evidence && evidence.why, ws, baseRevision };

  const grant = delegate({
    from: 'OWNER', grant: EDIT_FIXTURE_EVIDENCED.requires, to: 'governedRun',
    context: { repository: 'TIMING-1', implementation: entry, revision: baseRevision },
  });

  const packet = ws.prepare({
    scope, baseRevision, evidence: [evidence], authority: grant,
    contract: EDIT_FIXTURE_EVIDENCED, contents: candidate, by: 'governedRun',
    validation: { kind: 'feature-graph', covered: verdict.covered, missing: verdict.missing },
  });
  const r = ws.commit(packet.id);
  return { promoted: r.committed === true, result: r, ws, baseRevision, packetId: packet.id, evidenceMinted: true };
}

// ══ ONE RUN ═══════════════════════════════════════════════════════════════════════════════════════
async function runOne(pageDir, pageName) {
  const tRun = nowMs();
  const notes = [];
  const baseline = readFileSync(join(pageDir, 'baseline-as-delivered.html'), 'utf8');
  const task = JSON.parse(readFileSync(join(pageDir, 'task.json'), 'utf8'));
  const spec = task.diagnostic.spec;
  const entry = spec.entry || 'index.html';

  const canonical = mkdtempSync(join(tmpdir(), 'governed-'));
  try {
    writeFileSync(join(canonical, entry), baseline, 'utf8');

    const { graph, derivationMs } = await observeAndDerive(baseline, task);
    const gen = await generate({ prompt: buildPrompt(baseline, task), profile: PROFILE, model: MODEL, endpoint: ENDPOINT });

    const rec = blankRecord({
      arm: 'governed', runId: RUN_ID, at: new Date().toISOString(), task: task.id, page: pageName,
      baselineSha: sha(baseline), model: MODEL,
      decodingProfile: gen.decoding.profile,
      decoding: { temperature: gen.decoding.temperature, num_predict: gen.decoding.num_predict, seed: gen.decoding.seed },
      decodingOverridesRefused: gen.decoding.overridesRefused,
      authority: { root: authority.identity.root, commit: authority.identity.commit, dirty: authority.identity.dirty, manifestDigest: authority.identity.manifestDigest, moduleCount: authority.identity.moduleCount },
    });
    rec.clocks.derivationMs = derivationMs;
    rec.clocks.generationMs = gen.ms;
    rec.counts.calls = 1;
    rec.counts.nodesCovered = 0;
    rec.counts.nodesMissing = graph.nodes.length;

    const receipt = {
      contract: 'GOVERNED-RECEIPT-1', version: '1.0.0', runId: RUN_ID, page: pageName, task: task.id, at: rec.at,
      authority: { ...authority.identity, manifest: authority.manifest },
      decoding: gen.decoding,
      base: { baselineSha: sha(baseline), observedRevision: null },
      model: { name: MODEL, endpoint: ENDPOINT, requestSha: gen.requestSha || null, responseSha: gen.responseSha || null, doneReason: gen.doneReason || null },
      verification: null, effect: null, terminal: null,
    };

    if (!gen.ok) {
      rec.terminal = 'NOT_EVALUATED'; rec.outcome = 'GENERATION_FAILED'; notes.push(gen.why);
      rec.clocks.endToEndMs = nowMs() - tRun; rec.notes = notes;
      receipt.terminal = rec.terminal;
      return { rec, receipt };
    }
    rec.counts.promptTokens = gen.promptTokens;
    rec.counts.outputTokens = gen.outputTokens;
    if (gen.doneReason === 'length') notes.push('OUTPUT_CAP_EXHAUSTED: done_reason=length');

    const tC = nowMs();
    const ex = extractWholePage(gen.text, baseline);
    rec.clocks.containmentMs = nowMs() - tC;
    if (!ex.ok) {
      rec.terminal = 'REFUSED'; rec.outcome = ex.reason; rec.counts.acceptedChanges = 0;
      rec.clocks.verificationMs = 0; rec.clocks.effectMs = 0;
      rec.clocks.endToEndMs = nowMs() - tRun; rec.notes = notes;
      receipt.terminal = rec.terminal;
      return { rec, receipt };
    }
    rec.candidateSha = sha(ex.page);

    // VERIFY FIRST. Nothing has been written to the canonical workspace at this point.
    const verdict = await verifyCandidate({ candidate: ex.page, task, spec, graph });
    rec.clocks.verificationMs = verdict.verificationMs;
    rec.counts.nodesCovered = verdict.covered.length;
    rec.counts.nodesMissing = verdict.missing.length;
    receipt.verification = { complete: verdict.complete, covered: verdict.covered, missing: verdict.missing, candidateSha: rec.candidateSha };

    // THE VERIFIER MUST HAVE RUN BEFORE ANY OF THIS MEANS ANYTHING. With no verdict there is no
    // evidence to mint, so there is nothing to license a grant - the governed path simply has no
    // input. Recording it as a rejection would blame the model for a missing browser.
    if (verdict.ran === false) {
      rec.terminal = 'NOT_EVALUATED'; rec.outcome = 'VERIFIER_UNAVAILABLE';
      rec.counts.acceptedChanges = 0; rec.clocks.effectMs = 0;
      notes.push(String(verdict.why || 'the verifier could not run'));
      rec.clocks.endToEndMs = nowMs() - tRun; rec.notes = notes;
      receipt.terminal = rec.terminal;
      receipt.effect = { promoted: false, reason: 'VERIFIER_UNAVAILABLE' };
      return { rec, receipt };
    }

    const tE = nowMs();
    if (!verdict.complete) {
      // Never promoted. The canonical workspace still holds the baseline - there is nothing to restore
      // because nothing was ever written, and saying RESTORED for that would overstate what happened.
      rec.terminal = 'RESTORED'; rec.outcome = `MISSING_${verdict.missing.join('_')}`;
      rec.counts.acceptedChanges = 0;
      rec.clocks.effectMs = nowMs() - tE; rec.clocks.restorationMs = 0;
      notes.push('not promoted: the canonical workspace was never written to');
      rec.clocks.endToEndMs = nowMs() - tRun; rec.notes = notes;
      receipt.terminal = rec.terminal;
      receipt.effect = { promoted: false, reason: 'VERIFICATION_INCOMPLETE' };
      return { rec, receipt };
    }

    const p = await promote({ canonical, entry, candidate: ex.page, verdict });
    rec.clocks.effectMs = nowMs() - tE;
    receipt.base.observedRevision = p.baseRevision;

    const eff = p.result && p.result.effect;
    receipt.effect = {
      promoted: p.promoted, packetId: p.packetId || null,
      reason: p.promoted ? 'ACTION_PERMITTED' : (p.result ? p.result.reason : p.reason),
      retryable: p.result ? p.result.retryable ?? null : null,
      disposition: p.result ? p.result.disposition ?? null : null,
      intendedRevision: eff ? eff.intendedRevision ?? null : null,
      revisionAfter: eff ? eff.revisionAfter ?? null : null,
      effectVerified: eff ? eff.effectVerified ?? null : null,
      bytesAfter: eff ? eff.bytesAfter ?? null : null,
    };

    if (p.promoted) {
      rec.terminal = 'RETAINED'; rec.outcome = 'ACCEPTED'; rec.counts.acceptedChanges = 1;
    } else if (p.result && p.result.reason === PACKET.EFFECT_UNVERIFIED) {
      rec.terminal = 'EFFECT_UNVERIFIED'; rec.outcome = PACKET.EFFECT_UNVERIFIED;
      rec.counts.acceptedChanges = 0;
      notes.push('bytes landed that were not the bytes intended; the scope is quarantined and this is not progress');
    } else {
      rec.terminal = 'REFUSED'; rec.outcome = String((p.result && p.result.reason) || p.reason);
      rec.counts.acceptedChanges = 0;
    }
    receipt.terminal = rec.terminal;
    rec.clocks.endToEndMs = nowMs() - tRun; rec.notes = notes;
    return { rec, receipt };
  } finally { if (existsSync(canonical)) { try { rmSync(canonical, { recursive: true, force: true }); } catch { /* best effort */ } } }
}

// ══ THE RUN ═══════════════════════════════════════════════════════════════════════════════════════
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('governedRun.mjs')) {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(RECEIPTS, { recursive: true });
  console.log(`TIMING-1 arm=governed profile=${PROFILE} model=${MODEL}`);
  console.log(`authority ${authority.identity.root}`);
  console.log(`  commit ${String(authority.identity.commit).slice(0, 12)}  dirty=${authority.identity.dirty}  `
    + `manifest ${authority.identity.manifestDigest.slice(0, 16)}  ${authority.identity.moduleCount} modules`);
  console.log(`${NL}page   terminal          gen(ms)  verify(ms)  effect(ms)  e2e(ms)   nodes  promoted`);

  const written = [];
  for (const p of PAGES) {
    const dir = join('legasus/bench/suppression1', p);
    if (!existsSync(join(dir, 'task.json'))) { console.log(`  ${p}: no task, skipped`); continue; }
    const { rec, receipt } = await runOne(dir, p);
    const v = validateTimingRecord(rec);
    if (!v.ok) { console.error(`  ${p}: RECORD REJECTED BY THE CONTRACT -> ${v.problems.join('; ')}`); continue; }
    writeFileSync(join(OUT, `${RUN_ID}-${p}.json`), JSON.stringify(rec, null, 2), 'utf8');
    writeFileSync(join(RECEIPTS, `${RUN_ID}-${p}.receipt.json`), JSON.stringify(receipt, null, 2), 'utf8');
    written.push(rec);
    const c = rec.clocks;
    console.log(`  ${p}   ${String(rec.terminal).padEnd(16)} ${String(c.generationMs).padStart(7)} `
      + `${String(c.verificationMs).padStart(11)} ${String(c.effectMs).padStart(11)} ${String(c.endToEndMs).padStart(8)}  `
      + `${rec.counts.nodesCovered}/${rec.counts.nodesCovered + rec.counts.nodesMissing}  ${rec.terminal === 'RETAINED'}`);
  }
  console.log(`${NL}  ${written.length} record(s) + receipts written`);
}
