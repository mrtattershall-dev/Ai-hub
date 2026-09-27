/**
 * autoGuide.mjs - the system choosing its own guidance: where the slot goes, what it contains, and
 * what to say. Implements the policy frozen in `ASSIST-2_DEFINITION.md` BEFORE this file was written.
 *
 *   node server/autoGuide.mjs --task farm-grow --workspace <dir with index.html> \
 *     --model-url ... --model ... [--seeds 1,2,3,4,5] [--out r.json]
 *
 * WHAT IT DECIDES, and nothing else decides for it at run time:
 *   P2  the SITE - extend a listener that already dispatches on this trigger, or add one after the last
 *       listener of that event type, or DECLINE
 *   P3  the SCAFFOLD - the trigger filter, a trailing redraw only if every existing handler of that
 *       type calls one, and data preparation only if the effects name the player's own tile
 *   P4  the INSTRUCTION - one line from the requirement's own words, capped
 *   P6  ESCALATION - if the page throws at load the site was wrong, so switch rules; if the failure is
 *       behavioural, keep the site and spend the remaining seeds
 *
 * WHAT IT DOES NOT DECIDE: the requirement, the checks, or whether a candidate is acceptable. Those are
 * the task's and the gate's.
 *
 * FITTED, and said out loud: these rules were authored while looking at one page. R1's early-return
 * clause exists because that page's handler starts with one. General in form, one example in view.
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync, mkdtempSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const exec = promisify(execFile);
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };

const MODEL_URL = opt('model-url', 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = opt('model', 'qwen2.5-coder:1.5b');
const TASK_ID = opt('task', 'farm-grow');
const WS_IN = opt('workspace', null);
const SEEDS = String(opt('seeds', '1,2,3,4,5')).split(',').map((x) => parseInt(x, 10));
const MAX_TOKENS = parseInt(opt('max-tokens', '800'), 10);
const TEMPERATURE = parseFloat(opt('temperature', '0.2'));
const DEADLINE_MS = Math.max(10_000, parseFloat(opt('deadline-sec', '900')) * 1000);
const OUT = opt('out', null);

const sha = (t) => createHash('sha256').update(t).digest('hex');

// ══ P2: SITE SELECTION ═══════════════════════════════════════════════════════════════════════════
/**
 * Where should the slot go? Reads the file, applies the frozen rules in order, and reports which one
 * fired and why. Never guesses: if neither rule can be located it declines and names what was missing.
 */
export function chooseSite(file, requirement, { preferRule = null } = {}) {
  const key = requirement?.trigger?.key;
  if (!key || requirement.trigger.kind !== 'key') {
    return { declined: 'UNSUPPORTED_TRIGGER', needed: 'a requirement whose trigger is a key press; this policy handles no other kind' };
  }
  const lines = file.split('\n');
  const listeners = [];
  for (let i = 0; i < lines.length; i++) {
    if (/addEventListener\(\s*'keydown'/.test(lines[i])) {
      // Find the end of this listener by brace balance from its opening line.
      let depth = 0, end = i;
      for (let j = i; j < lines.length; j++) {
        depth += (lines[j].match(/\{/g) || []).length - (lines[j].match(/\}/g) || []).length;
        if (j > i && depth <= 0) { end = j; break; }
        end = j;
      }
      listeners.push({ start: i, end, text: lines.slice(i, end + 1).join('\n') });
    }
  }
  if (!listeners.length) {
    return { declined: 'NO_LISTENER_FOUND', needed: `somewhere that already handles a ${requirement.trigger.kind} press, to put this beside` };
  }

  // R1: a listener that dispatches on key values, and whose first statement does not exclude ours.
  const dispatching = listeners.filter((l) => /e\.key\s*===|switch\s*\(\s*e\.key/.test(l.text));
  const excludesUs = (l) => {
    const first = l.text.split('\n').slice(1).map((x) => x.trim()).find((x) => x.length);
    return !!first && /^if\s*\(\s*e\.key\s*!==/.test(first) && !first.includes(`'${key}'`);
  };
  const r1 = dispatching.find((l) => !excludesUs(l));
  if (r1 && preferRule !== 'R2') {
    const anchor = lines[r1.start + 1] !== undefined ? lines[r1.start + 1] : null;
    return {
      rule: 'R1', why: 'a keydown listener already dispatches on key values and does not exclude this key, so a branch goes inside it',
      insertAfterLine: r1.start, anchorLine: anchor, listener: r1,
    };
  }
  const blocked = dispatching.filter(excludesUs);

  // R2: a new listener after the last existing one of this type.
  const last = listeners[listeners.length - 1];
  if (preferRule === 'R1' && !r1) {
    return { declined: 'R1_UNAVAILABLE', needed: 'a dispatching listener that does not exclude this key' };
  }
  return {
    rule: 'R2',
    why: blocked.length
      ? `the existing keydown listener begins with an early return that excludes '${key}', so a branch inside it could never run; a new listener goes after the last one`
      : 'no existing keydown listener dispatches on key values, so a new listener goes after the last one',
    insertAfterLine: last.end, listener: last, blockedByEarlyReturn: blocked.length > 0,
  };
}

// ══ P3: THE SCAFFOLD ═════════════════════════════════════════════════════════════════════════════
/** What may surround the slot, derived from the file and the requirement - never from a person. */
export function buildScaffold(file, requirement, site) {
  const key = requirement.trigger.key;
  const indent = '        ';
  // A redraw is included only if the file defines one AND every existing keydown handler calls it.
  const definesRedraw = /function\s+draw\s*\(\s*\)/.test(file);
  const handlers = file.split('\n').filter((l) => /addEventListener\(\s*'keydown'/.test(l)).length;
  const callsRedraw = (file.match(/draw\(\s*\)\s*;/g) || []).length;
  const includeRedraw = definesRedraw && handlers > 0 && callsRedraw >= handlers;
  // Data preparation only if the effects name the player's OWN tile.
  const namesPlayersTile = (requirement.effects || []).some((e) => /player'?s? (own )?tile/i.test(e));
  const body = [];
  if (namesPlayersTile) body.push(`${indent}    const k = \`\${player.x},\${player.y}\`;`);
  body.push(`${indent}    // FILL IN`);
  if (includeRedraw) body.push(`${indent}    try { draw(); } catch (err) { /* redraw is not the change */ }`);

  const block = site.rule === 'R1'
    ? [`${indent}    if (e.key === '${key}') {`, ...body.map((l) => '    ' + l), `${indent}    }`]
    : [`${indent}document.addEventListener('keydown', (e) => {`, `${indent}    if (e.key !== '${key}') return;`, ...body, `${indent}});`];

  return {
    lines: block, includeRedraw, namesPlayersTile,
    why: [
      `the trigger filter is always supplied (key '${key}')`,
      includeRedraw ? 'a redraw is supplied because the file defines draw() and every existing keydown handler calls it' : 'no redraw is supplied: the file does not define one, or not every handler calls it',
      namesPlayersTile ? "a tile-key line is supplied because the effects name the player's own tile" : "no tile-key line is supplied: the effects do not name the player's own tile",
    ],
  };
}

// ══ P4: THE INSTRUCTION ══════════════════════════════════════════════════════════════════════════
/** One line, from the requirement's own words. No examples, no invented field names, no code. */
export function buildInstruction(requirement, cap = 200) {
  const parts = [...(requirement.effects || [])];
  const hard = (requirement.invariants || []).filter((i) => !/keeps working/i.test(i));
  let line = `// on this key: ${parts.join('; ')}.`;
  // The invariants go in VERBATIM. An earlier version rewrote them and produced
  // "Create or remove no tile is created or removed" - a policy that edits the requirement's words is
  // a policy that can corrupt them.
  if (hard.length) line += ` Ensure ${hard.join(', and ')}.`;
  if (line.length > cap) line = line.slice(0, cap - 1) + '.';
  return line;
}

// ══ the run ══════════════════════════════════════════════════════════════════════════════════════
const git = (ws, args) => exec('git', ['-C', ws, ...args], { windowsHide: true });

async function main() {
  const T0 = Date.now();
  const { farmTasks } = await import('./benchTasks.js');
  const { evaluate } = await import('./evaluator.js');
  const { applyAcceptance } = await import('./acceptance.js');
  const { playCheck } = await import('./playCheck.js');
  const { judgeCandidate } = await import('./judgeCandidate.mjs');
  const { cutRegion, trimInfillTail } = await import('./localEdit.mjs');

  const task = farmTasks().find((t) => t.id === TASK_ID);
  if (!task) { console.error(`unknown task ${TASK_ID}`); process.exit(2); }
  if (!task.requirement) { console.error(`${TASK_ID} has no structured requirement for the policy to read`); process.exit(2); }
  const spec = task.diagnostic.spec;
  const ENTRY = spec.entry || 'index.html';
  const startFile = readFileSync(join(WS_IN, ENTRY), 'utf8');

  const out = {
    at: new Date().toISOString(), task: TASK_ID, model: MODEL, seeds: SEEDS,
    interventionsByAPerson: 0,
    policy: { frozenIn: 'ASSIST-2_DEFINITION.md' },
    startSha: sha(startFile), decisions: [], attempts: [], accepted: false,
  };

  let preferRule = null;
  for (let choice = 1; choice <= 2 && !out.accepted; choice++) {
    // ── P2, P3, P4: the system's own decisions ──
    const site = chooseSite(startFile, task.requirement, { preferRule });
    if (site.declined) {
      out.decisions.push({ choice, declined: site.declined, needed: site.needed });
      console.log(`site choice ${choice}: DECLINED (${site.declined}) - ${site.needed}`);
      break;
    }
    const scaffold = buildScaffold(startFile, task.requirement, site);
    const instruction = buildInstruction(task.requirement);
    const decision = { choice, rule: site.rule, why: site.why, scaffold: scaffold.lines.join('\n'), scaffoldWhy: scaffold.why, instruction };
    out.decisions.push(decision);
    console.log(`site choice ${choice}: ${site.rule} - ${site.why}`);
    console.log(`  scaffold:\n${scaffold.lines.map((l) => '    ' + l).join('\n')}`);
    console.log(`  instruction: ${instruction}`);

    // Insert the scaffold, then cut its FILL IN line back out as the hole.
    const lines = startFile.split('\n');
    const scaffolded = [...lines.slice(0, site.insertAfterLine + 1), ...scaffold.lines, ...lines.slice(site.insertAfterLine + 1)].join('\n');
    const FILL = scaffold.lines.find((l) => l.includes('// FILL IN'));
    const cut = cutRegion(scaffolded, FILL, FILL);
    if (!cut.ok) { out.decisions[out.decisions.length - 1].error = cut.reason; break; }

    for (const seed of SEEDS) {
      const ws = mkdtempSync(join(tmpdir(), `guide-${TASK_ID}-`));
      try {
        writeFileSync(join(ws, ENTRY), startFile, 'utf8');
        await git(ws, ['init', '-q']); await git(ws, ['config', 'core.autocrlf', 'false']);
        await git(ws, ['add', '-A']);
        await git(ws, ['-c', 'user.email=g@g', '-c', 'user.name=g', 'commit', '-q', '-m', 'start']);
        const startRef = (await git(ws, ['rev-parse', 'HEAD'])).stdout.trim();

        const gen = await infill(cut.prefix + instruction + '\n', cut.suffix, seed);
        const trimmed = trimInfillTail(String(gen.text || ''), cut.suffix);
        const middle = trimmed.text;
        const rec = { choice, seed, rule: site.rule, generationMs: gen.ms, outputTokens: gen.outTok ?? null, boundaries: {}, timing: {} };
        rec.rawReply = String(gen.text || '').slice(0, 4000);
        rec.middleUsed = middle.slice(0, 2000);
        rec.trimmed = trimmed.trimmed ? trimmed.trimmedAt : false;
        if (!middle.trim().length) {
          rec.outcome = 'NO_CODE'; out.attempts.push(rec);
          console.log(`  seed ${seed}: no code produced`);
          continue;
        }
        const candidate = cut.prefix + instruction + '\n' + middle + cut.suffix;
        writeFileSync(join(ws, ENTRY), candidate.endsWith('\n') ? candidate : candidate + '\n', 'utf8');
        await git(ws, ['add', '-A']);
        await git(ws, ['-c', 'user.email=g@g', '-c', 'user.name=g', 'commit', '-q', '-m', 'candidate']).catch((e) => {
          if (!/nothing to commit/i.test(String(e.stdout || '') + String(e.stderr || ''))) throw e;
        });
        await judgeCandidate(ws, task, spec, startRef, rec, T0, { playCheck, evaluate, applyAcceptance, join, readFileSync });
        rec.candidateSha = sha(candidate);
        rec.outcome = rec.boundaries.accepted ? 'ACCEPTED' : 'REJECTED';
        if (rec.boundaries.accepted) { out.accepted = true; out.acceptedFile = rec.acceptedFile; out.acceptedSeed = seed; }
        out.attempts.push(rec);
        console.log(`  seed ${seed}: play [${rec.play.passing.join(',')}] ${rec.diagnosis?.failureClass ?? ''} ${rec.acceptance.disposition}${rec.boundaries.accepted ? '  <- ACCEPTED' : ''}`);
        if (rec.boundaries.accepted) break;
      } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
    }

    // ── P6: escalate only on a load-time throw, and only once ──
    if (!out.accepted) {
      const threw = out.attempts.filter((a) => a.choice === choice).some((a) => a.diagnosis?.failureClass === 'RUNTIME_EXCEPTION_AT_LOAD');
      if (threw && choice === 1) {
        preferRule = site.rule === 'R1' ? 'R2' : 'R1';
        out.escalation = { after: choice, reason: 'the page threw at load, so the site was wrong', switchingTo: preferRule };
        console.log(`escalating: the page threw at load, switching to ${preferRule}`);
      } else break;
    }
  }

  out.totals = {
    attempts: out.attempts.length,
    accepted: out.attempts.filter((a) => a.outcome === 'ACCEPTED').length,
    generationSeconds: +(out.attempts.reduce((s, a) => s + (a.generationMs || 0), 0) / 1000).toFixed(1),
    outputTokens: out.attempts.reduce((s, a) => s + (a.outputTokens || 0), 0),
    wallClockSeconds: +((Date.now() - T0) / 1000).toFixed(1),
    siteChoices: out.decisions.filter((d) => d.rule).length,
    interventionsByAPerson: 0,
  };
  return out;

  async function infill(prefix, suffix, seed) {
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), DEADLINE_MS);
    let text = '', outTok = null, doneReason = null, aborted = false;
    try {
      const res = await fetch(`${MODEL_URL}/api/generate`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ model: MODEL, prompt: prefix, suffix, stream: true, options: { temperature: TEMPERATURE, num_predict: MAX_TOKENS, seed } }),
      });
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, ms: Date.now() - t0 };
      const dec = new TextDecoder();
      let buf = '';
      for await (const chunk of res.body) {
        buf += dec.decode(chunk, { stream: true });
        const ls = buf.split('\n'); buf = ls.pop() || '';
        for (const l of ls) {
          if (!l.trim()) continue;
          let j; try { j = JSON.parse(l); } catch { continue; }
          if (j.response) text += j.response;
          if (j.done) { outTok = j.eval_count ?? null; doneReason = j.done_reason || 'done'; }
        }
      }
    } catch (e) { aborted = ctrl.signal.aborted; if (!aborted) return { ok: false, reason: String(e.message || e), ms: Date.now() - t0 }; } finally { clearTimeout(timer); }
    return { ok: true, text, ms: Date.now() - t0, outTok, doneReason: aborted ? 'harness_deadline' : doneReason };
  }
}

const DIRECT = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (DIRECT) {
  const out = await main();
  console.log(`\n  ACCEPTED: ${out.accepted ? 'YES, seed ' + out.acceptedSeed : 'no'}`);
  console.log(`  attempts ${out.totals.attempts}, site choices ${out.totals.siteChoices}, generation ${out.totals.generationSeconds} s, ${out.totals.outputTokens} tokens, interventions by a person ${out.totals.interventionsByAPerson}`);
  if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8'); console.log(`  written: ${OUT}`); }
  process.exit(0);
}
