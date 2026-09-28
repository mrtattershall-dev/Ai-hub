// NARROWABILITY V2 — behavioural AND structural channels, both required.
//
// V1 (`narrowability.mjs`) is untouched and its denominators stay frozen. This is the version used for
// families authored after it exists, per NARROWABILITY_V2.md.
//
//     candidate edit -> loads? -> behavioural preservation? -> structural preservation? -> delta? -> legal
//
// The structural channel comes from `structure.mjs`, which was witnessed independently and consults
// nothing from `ownership_boundary`. A position is legal only when both channels agree, so a candidate
// that passes the probes while silently re-parenting existing statements is no longer counted legal.
//
// Everything else - candidate enumeration, intra-line handling, the reconstruction - is reused from V1
// rather than reimplemented, because two implementations of one derived artifact is hazard 9 and this
// project has paid for it twice.
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { structurePreserved } from '../structure.mjs';
import { reconstruct, baseFor, applyByAnchor } from './narrowability.mjs';
import { structuralParent } from '../../legaparse/siteclass.mjs';

const NL = String.fromCharCode(10);
const ind = (l) => (l.match(/^[ \t]*/) || [''])[0].length;

function insertAfterLine(text, pos, code) {
  const lines = text.split(NL);
  return lines.slice(0, pos + 1).join(NL) + NL + code.replace(/\n$/, '') + NL
    + lines.slice(pos + 1).join(NL);
}

function runProbe(lang, sourceName, sourceText, probeText) {
  const ws = mkdtempSync(join(tmpdir(), 'narrow2-'));
  writeFileSync(join(ws, sourceName), sourceText, 'utf8');
  const probeName = lang === 'py' ? '_probe.py' : '_probe.js';
  writeFileSync(join(ws, probeName), probeText, 'utf8');
  try {
    const out = execFileSync(lang === 'py' ? 'python' : 'node', [probeName],
      { cwd: ws, encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] });
    return /\bOK\b/.test(out);
  } catch { return false; }
}

function candidates(text, refPos, indent) {
  const lines = text.split(NL);
  const target = (structuralParent(text, refPos, indent) || { line: -1 }).line;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const p = structuralParent(text, i, indent);
    if ((p ? p.line : -1) !== target) continue;
    if (/:\s*$/.test(lines[i])) continue;
    out.push(i);
  }
  return out;
}

export function proveTaskV2(dir) {
  const recon = reconstruct(dir);
  const { task, oracle, srcName, src, lang } = recon;
  const pdir = join(dir, 'evidence', 'probes');
  const ext = lang === 'py' ? '.py' : '.js';
  const delta = existsSync(join(pdir, 'delta' + ext)) ? readFileSync(join(pdir, 'delta' + ext), 'utf8') : null;
  const preserve = existsSync(join(pdir, 'preservation' + ext))
    ? readFileSync(join(pdir, 'preservation' + ext), 'utf8') : null;
  const ops = oracle.transaction.operations;
  if (!delta) return { id: task.task_id, error: 'no delta probe' };
  const full = recon.full;
  const ref = applyByAnchor(src, full);
  if (!ref || !runProbe(lang, srcName, ref, delta)) {
    return { id: task.task_id, error: 'the reference transaction does not pass its own delta probe' };
  }

  const rows = [];
  for (let k = 0; k < full.length; k++) {
    if (!full[k].anchor.endsWith(NL)) {
      rows.push({ op: full[k].id, intra_line: true, candidates: null, passing: null,
        narrowable: false, max_gain_bits: null,
        note: 'intra-line: position fixed by the expression it edits' });
      continue;
    }
    const base = baseFor(recon, k);
    if (base === null) { rows.push({ op: full[k].id, error: 'anchor not unique without this op' }); continue; }
    const at = base.indexOf(full[k].anchor);
    if (at < 0) { rows.push({ op: full[k].id, error: 'anchor missing from base' }); continue; }
    const refPos = base.slice(0, at + full[k].anchor.length - 1).split(NL).length - 1;
    const codeIndent = ind((full[k].code.split(NL).find((l) => l.trim()) || ''));
    const cands = candidates(base, refPos, codeIndent);

    const passing = [];
    const behaviouralOnly = [];      // passed the probes, failed structure - what V1 would have kept
    for (const p of cands) {
      const text = insertAfterLine(base, p, full[k].code);
      const behavioural = runProbe(lang, srcName, text, delta)
        && (!preserve || runProbe(lang, srcName, text, preserve));
      if (!behavioural) continue;
      // The insertion map is exact and must be passed: without it a pre-existing statement can be
      // compared against an inserted line that happens to read the same, which invented seven
      // violations on this oracle's first family.
      const blockLines = (full[k].code.endsWith(NL) ? full[k].code.slice(0, -1) : full[k].code).split(NL).length;
      const structural = structurePreserved(base, text, { pos: p, count: blockLines });
      if (structural.preserved) passing.push(p);
      else behaviouralOnly.push({ position: p, violations: structural.violations.slice(0, 2) });
    }
    rows.push({ op: full[k].id, ref_position: refPos,
      base_lines: base.split(NL).length,
      candidates: cands.length, candidate_positions: cands,
      failing_positions: cands.filter((p) => !passing.includes(p)),
      passing: passing.length, passing_positions: passing,
      structural_only_failures: behaviouralOnly,
      narrowable: passing.length > 0 && passing.length < cands.length,
      max_gain_bits: passing.length > 0 ? Math.log2(cands.length / passing.length) : null,
      oracle_version: 'V2' });
  }
  return { id: task.task_id, rows };
}

const isMain = process.argv[1] && process.argv[1].endsWith('narrowability2.mjs');
if (isMain) {
  const FAM = process.argv[2];
  const JSONOUT = process.argv[3] || null;
  const dump = [];
  let narrowable = 0; let independent = 0; let intra = 0; let broken = 0; let structOnly = 0;
  for (const d of readdirSync(FAM).sort()) {
    if (!existsSync(join(FAM, d, 'task.json'))) continue;
    const r = proveTaskV2(join(FAM, d));
    if (r.error) { console.log('  ' + d + '  ERROR ' + r.error); continue; }
    dump.push({ task: d, rows: r.rows });
    for (const row of r.rows) {
      if (row.error) { console.log('  ' + d + ' ' + row.op + '  ERROR ' + row.error); broken++; continue; }
      const kind = row.intra_line ? 'INTRA-LINE ' : row.passing === 0 ? 'UNTESTABLE '
        : row.narrowable ? 'NARROWABLE ' : 'independent';
      if (row.intra_line) intra++;
      else if (row.passing === 0) broken++;
      else if (row.narrowable) narrowable++;
      else independent++;
      const so = (row.structural_only_failures || []).length;
      structOnly += so;
      console.log('  ' + d + ' ' + String(row.op).padEnd(4) + kind
        + '  candidates ' + String(row.candidates).padStart(3)
        + '  passing ' + String(row.passing).padStart(3)
        + '  max gain ' + (row.max_gain_bits === null ? 'n/a' : row.max_gain_bits.toFixed(2) + ' bits')
        + (so ? '   [' + so + ' behaviourally-legal but structurally invalid]' : ''));
    }
  }
  console.log('');
  console.log('  ---- NARROWABILITY V2, both channels required');
  console.log('  NARROWABLE                ' + narrowable + '   <- the denominator');
  console.log('  position-independent      ' + independent);
  console.log('  intra-line                ' + intra + '      untestable ' + broken);
  console.log('  caught by STRUCTURE only  ' + structOnly + '   positions the probes called legal and');
  console.log('                                structural preservation rejected');
  if (JSONOUT) {
    writeFileSync(JSONOUT, JSON.stringify(dump, null, 1), 'utf8');
    console.log('  ground truth -> ' + JSONOUT);
  }
}
