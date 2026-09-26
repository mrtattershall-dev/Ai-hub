/**
 * costAccount.mjs - MEASURED cost of a campaign, from its own logs, split into the phases that
 * actually bill: startup, probe, active units, idle gaps, shutdown. Then cost per accepted
 * repair per arm, with the shared overhead attributed in proportion to each arm's task time.
 *
 *   node server/costAccount.mjs <stage1.log> <campaign.log> <watchdog.log> <summary.jsonl> [--rate-gpu 1.1016] [--rate-cons 1.55] [--out f.json]
 *
 * Everything is an ESTIMATE from unit prices and observed clocks; the invoice is the authority.
 * Idle inside the campaign is detected from gaps between consecutive unit rows larger than the
 * unit's own elapsed plus a tolerance (a sleeping machine, a hung relaunch, a manual pause).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const [S1, CAMP, WD, SUM] = argv;
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 ? argv[i + 1] : d; };
const RATE_GPU = parseFloat(opt('rate-gpu', '1.1016'));     // A10 $0.000306/s, verified 2026-09-25
const RATE_CONS = parseFloat(opt('rate-cons', '1.55'));     // + up to 4 cores + 32 GiB
const OUT = opt('out', null);
if (!S1 || !CAMP || !WD || !SUM) { console.error('usage: costAccount.mjs <stage1.log> <campaign.log> <watchdog.log> <summary.jsonl> [--rate-gpu r] [--rate-cons r] [--out f]'); process.exit(2); }

const ts = (s, re) => { const m = String(s).match(re); return m ? Date.parse(m[1]) : null; };
const s1 = readFileSync(S1, 'utf8'), camp = readFileSync(CAMP, 'utf8'), wd = readFileSync(WD, 'utf8');
const wdEvents = wd.trim().split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const rows = readFileSync(SUM, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.kind === 'run' && r.state !== 'UNATTEMPTED').sort((a, b) => a.idx - b.idx);

// Clocks. The app bills from container start (first request after deploy) to stopped_at; we
// take deploy time as the conservative start.
const deployAt = ts(s1, /\[(\S+Z)\] deployed/);
const modelUpAt = ts(s1, /\[(\S+Z)\] model up/);
const stage1DoneAt = ts(s1, /\[(\S+Z)\] STAGE1 done/);
const campStartAt = ts(camp, /START (\S+Z) hub/);
const completeAt = ts(camp, /COMPLETE (\S+Z)/);
const stoppedEv = wdEvents.find((e) => e.event === 'CONFIRMED_STOPPED');
const stoppedAt = stoppedEv ? Date.parse(String(stoppedEv.stopped_at).replace(' ', 'T')) : null;
const observedAt = stoppedEv ? Date.parse(stoppedEv.at) : null;
if ([deployAt, modelUpAt, campStartAt, completeAt, stoppedAt].some((x) => x === null || Number.isNaN(x))) {
  console.error('could not read one of: deployed / model up / START / COMPLETE / stopped_at'); process.exit(3);
}

// Phases (seconds).
const startup = (modelUpAt - deployAt) / 1000;
const probeAndGate = (campStartAt - modelUpAt) / 1000;
const campaignSpan = (completeAt - campStartAt) / 1000;
const shutdown = (stoppedAt - completeAt) / 1000;
const total = (stoppedAt - deployAt) / 1000;

// Inside the campaign: unit time, per-unit overhead, and IDLE gaps between rows.
const unitSec = rows.reduce((a, r) => a + (r.elapsedSec || 0), 0);
let idleGaps = [];
for (let i = 1; i < rows.length; i++) {
  const gap = (Date.parse(rows[i].at) - Date.parse(rows[i - 1].at)) / 1000 - (rows[i].elapsedSec || 0);
  if (gap > 120) idleGaps.push({ afterUnit: rows[i - 1].idx, beforeUnit: rows[i].idx, idleSec: Math.round(gap) });
}
const firstRowAt = rows.length ? Date.parse(rows[0].at) : campStartAt;
const baselineSec = Math.max(0, (firstRowAt - campStartAt) / 1000 - (rows[0]?.elapsedSec || 0));
const overrunSec = rows.reduce((a, r) => a + (r.overranBySec || 0), 0);   // time past the unit bound: a sleeping machine, not model work
const idleSec = idleGaps.reduce((a, g) => a + g.idleSec, 0);
const overheadSec = Math.max(0, campaignSpan - unitSec - idleSec - baselineSec);   // hub spawn, acceptance, case measurement, teardown

const money = (sec) => ({ gpuOnly: +(sec / 3600 * RATE_GPU).toFixed(3), conservative: +(sec / 3600 * RATE_CONS).toFixed(3) });
const phases = {
  startup: { sec: Math.round(startup), ...money(startup) },
  probeAndGate: { sec: Math.round(probeAndGate), ...money(probeAndGate) },
  campaignBaselines: { sec: Math.round(baselineSec), ...money(baselineSec) },
  campaignUnits: { sec: Math.round(unitSec - overrunSec), ...money(unitSec - overrunSec) },
  campaignUnitOverrun: { sec: Math.round(overrunSec), units: rows.filter((r) => r.overranBySec > 0).map((r) => `${r.task} +${r.overranBySec}s`), ...money(overrunSec) },
  campaignOverhead: { sec: Math.round(overheadSec), ...money(overheadSec) },
  campaignIdle: { sec: Math.round(idleSec), gaps: idleGaps, ...money(idleSec) },
  shutdown: { sec: Math.round(shutdown), ...money(shutdown) },
  total: { sec: Math.round(total), ...money(total) },
};

// Per arm: attributable = the arm's own unit seconds; shared = everything else, split by the
// arm's share of unit seconds. Cost per ACCEPTED repair on both bases.
const arms = [...new Set(rows.map((r) => r.arm))];
const shared = total - (unitSec - overrunSec);
const perArm = {};
for (const a of arms) {
  const g = rows.filter((r) => r.arm === a);
  const sec = g.reduce((x, r) => x + (r.elapsedSec || 0) - (r.overranBySec || 0), 0);   // overrun is not the arm's work
  const repairs = g.filter((r) => r.accepted).length;
  const share = (unitSec - overrunSec) ? sec / (unitSec - overrunSec) : 0;
  const attributedSec = sec + shared * share;
  perArm[a] = {
    units: g.length, repairs, unitSec: sec, shareOfUnitTime: +share.toFixed(3),
    attributedSecInclShared: Math.round(attributedSec),
    secPerRepairOwnTime: repairs ? Math.round(sec / repairs) : null,
    secPerRepairInclShared: repairs ? Math.round(attributedSec / repairs) : null,
    dollarsPerRepairOwnTime: repairs ? money(sec / repairs) : null,
    dollarsPerRepairInclShared: repairs ? money(attributedSec / repairs) : null,
  };
}

const out = { inputs: { stage1: S1, campaign: CAMP, watchdog: WD, summary: SUM }, rates: { gpuOnlyPerHour: RATE_GPU, conservativePerHour: RATE_CONS },
  clocks: { deployAt: new Date(deployAt).toISOString(), modelUpAt: new Date(modelUpAt).toISOString(), campaignStartAt: new Date(campStartAt).toISOString(), completeAt: new Date(completeAt).toISOString(), stoppedAt: new Date(stoppedAt).toISOString(), stopObservedAt: observedAt ? new Date(observedAt).toISOString() : null },
  phases, perArm, note: 'ESTIMATES from verified unit prices and observed clocks; the invoice is the authority. Shared time is split by each arm\'s share of unit time.' };
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');

const f = (p) => `${String(p.sec).padStart(6)} s  $${p.gpuOnly.toFixed(2)} / $${p.conservative.toFixed(2)}`;
console.log(`clocks: deploy ${out.clocks.deployAt}  model up ${out.clocks.modelUpAt}  START ${out.clocks.campaignStartAt}  COMPLETE ${out.clocks.completeAt}  stopped ${out.clocks.stoppedAt}`);
console.log('phase                 seconds   GPU-only / conservative');
for (const [k, v] of Object.entries(phases)) console.log(`${k.padEnd(20)} ${f(v)}${k === 'campaignIdle' && v.gaps.length ? '   gaps: ' + v.gaps.map((g) => `${g.idleSec}s after unit ${g.afterUnit}`).join(', ') : ''}${k === 'campaignUnitOverrun' && v.units.length ? '   ' + v.units.join(', ') : ''}`);
console.log('\narm            units  repairs  own s   s/repair(own)  s/repair(incl. shared)  $/repair own (gpu/cons)   $/repair incl. shared');
for (const [a, v] of Object.entries(perArm)) console.log(`${a.padEnd(14)} ${String(v.units).padStart(5)}  ${String(v.repairs).padStart(7)}  ${String(v.unitSec).padStart(5)}   ${String(v.secPerRepairOwnTime ?? '-').padStart(13)}  ${String(v.secPerRepairInclShared ?? '-').padStart(22)}  ${v.dollarsPerRepairOwnTime ? `$${v.dollarsPerRepairOwnTime.gpuOnly.toFixed(3)} / $${v.dollarsPerRepairOwnTime.conservative.toFixed(3)}` : '-'}   ${v.dollarsPerRepairInclShared ? `$${v.dollarsPerRepairInclShared.gpuOnly.toFixed(3)} / $${v.dollarsPerRepairInclShared.conservative.toFixed(3)}` : '-'}`);
if (OUT) console.log(`\nwritten: ${OUT}`);
