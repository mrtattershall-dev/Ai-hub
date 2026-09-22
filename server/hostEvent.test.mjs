/**
 * hostEvent.test.mjs - PHASE 1's success criteria C1-C5, and nothing beyond them.
 *
 *   node server/hostEvent.test.mjs
 *
 * WHAT THIS FILE MAY AND MAY NOT CLAIM
 * ------------------------------------
 * It may establish the INFORMATION CONTRACT: that the facts LegaCore needs exist at the host
 * boundary at full fidelity and survive the crossing.
 *
 * It may NOT be cited as evidence that Legasus improves autonomous coding. In Phase 1 a sink
 * observes and returns nothing, so the two arms cannot differ in software outcome - "events
 * reached the consumer" is a statement about plumbing. Phase 2 is where a decision becomes
 * load-bearing, and it is a separate preregistration.
 *
 * TWO PARTS, FOR ONE REASON
 * -------------------------
 * PART A drives the event builder and the sink contract directly - fast, no workspace.
 * PART B spawns a REAL hub against a scripted model and reads the JSONL the hub itself wrote.
 * Part B exists because the hub under test is a CHILD PROCESS: an in-process listener could
 * never see a real run, and C1 ("exactly one event per tool execution") is worthless if it is
 * checked against a replica of the code path instead of the path itself.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { onHostEvent, attachFileSink, emitHostEvent, __hostEventTest, BEFORE_MISSING } = await import('./hostEvent.js');

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

const TMP = mkdtempSync(join(tmpdir(), 'hostevent-'));

// A representative call site payload, shaped exactly as agent.js passes it.
const call = (over = {}) => ({
  tool: 'write_file',
  args: { path: 'a.js', content: 'const x = 1;\n' },
  beforeSrc: null,
  result: 'OK: wrote a.js.',
  callKey: 'write_file {"path":"a.js"}',
  run: { id: 'r1', goal: 'g', source: 'human', entrance: 'http:start', steps: [] },
  ...over,
});

try {
  // ───────────────────────── PART A: the contract itself ─────────────────────────

  // ── C2: the before-image arrives verbatim, or MARKED absent - never '' and never rebuilt.
  await test('C2 - a captured before-image travels byte-identical', () => {
    const before = 'module.exports = { v: 1 };\n// trailing\n';
    const e = __hostEventTest.build(call({ beforeSrc: before }));
    assert.equal(e.before.present, true);
    assert.equal(e.before.text, before, 'the before-image must not be normalised or truncated');
  });

  await test("C2 - an absent before-image carries NO text field: '' is a different fact", () => {
    const e = __hostEventTest.build(call({ beforeSrc: null }));
    assert.equal(e.before.present, false);
    assert.ok(!('text' in e.before), "absent must not be representable as an empty string");
  });

  await test('C2 - the four absence REASONS are distinct, not one null', () => {
    const why = (over) => __hostEventTest.build(call({ beforeSrc: null, ...over })).before.why;
    assert.equal(why({ tool: 'read_file', args: { path: 'a.js' } }), BEFORE_MISSING.NOT_A_WRITE);
    // append_file writes and is NOT covered by agent.js's capture - the gap that let 20
    // appended copies survive the duplicate guard. It must be distinguishable from "new file".
    assert.equal(why({ tool: 'append_file', args: { path: 'a.js' } }), BEFORE_MISSING.TOOL_NOT_COVERED);
    // .html/.css/.json/.gd get no before-image at all: a different blind spot again.
    assert.equal(why({ tool: 'write_file', args: { path: 'page.html' } }), BEFORE_MISSING.EXT_NOT_COVERED);
    assert.equal(why({ tool: 'write_file', args: { path: 'new.js' } }), BEFORE_MISSING.NEW_FILE);
    assert.equal(new Set([BEFORE_MISSING.NOT_A_WRITE, BEFORE_MISSING.TOOL_NOT_COVERED,
      BEFORE_MISSING.EXT_NOT_COVERED, BEFORE_MISSING.NEW_FILE]).size, 4, 'all four must be distinct values');
  });

  // ── the outcome. saveTrace keeps {type, tool, path} and drops this entirely.
  await test('the per-step RESULT travels, with the hub error convention decoded', () => {
    assert.equal(__hostEventTest.build(call()).result.isError, false);
    const bad = __hostEventTest.build(call({ result: 'ERROR: no such file' }));
    assert.equal(bad.result.isError, true, 'the hub signals failure by RETURNING "ERROR: ..."');
    assert.equal(bad.result.text, 'ERROR: no such file', 'the answer itself must travel, not just a flag');
  });

  await test('args travel VERBATIM - `path` alone was the training projection, not a contract', () => {
    const e = __hostEventTest.build(call());
    assert.equal(e.args.content, 'const x = 1;\n', 'the written bytes must be in the event');
    assert.equal(e.path, 'a.js');
  });

  // ── C3: entrance is LINEAGE, distinct from source, and never inferred.
  await test('C3 - entrance, source and actor are THREE separate fields', () => {
    const e = __hostEventTest.build(call({ run: { id: 'r', goal: 'g', source: 'queue', entrance: 'supervisor', steps: [] } }));
    assert.equal(e.run.source, 'queue', 'source = what originated the GOAL');
    assert.equal(e.run.entrance, 'supervisor', 'entrance = the route that began the CHAIN');
    assert.equal(e.actor, 'model', 'actor = who performed the immediate action');
    assert.equal(new Set([e.run.source, e.run.entrance, e.actor]).size, 3,
      'collapsing any two of these into one string is the information loss this field exists to stop');
  });

  await test('C3 - entrance is never INVENTED when a run did not carry one', () => {
    const e = __hostEventTest.build(call({ run: { id: 'r', goal: 'g', source: 'human', steps: [] } }));
    assert.equal(e.run.entrance, null, 'an unstamped entrance is null - never derived from source');
  });

  await test('the event names the SITE it came from, and carries a schema version', () => {
    const e = __hostEventTest.build(call());
    assert.equal(e.site, 'agent.js:3396', '2690 and 4590 do not emit in Phase 1; the event must say which site did');
    assert.equal(e.v, 1);
  });

  // ── C5: a sink cannot influence the run, and nothing is flattened.
  await test('C5 - a THROWING sink does not propagate', () => {
    __hostEventTest.clear();
    const off = onHostEvent(() => { throw new Error('sink exploded'); });
    try { emitHostEvent(call()); } finally { off(); }   // must not throw
  });

  await test('C5 - every sink still runs when an earlier one throws', () => {
    __hostEventTest.clear();
    let second = 0;
    const offA = onHostEvent(() => { throw new Error('first'); });
    const offB = onHostEvent(() => { second++; });
    try { emitHostEvent(call()); } finally { offA(); offB(); }
    assert.equal(second, 1, 'one bad consumer must not silence the others');
  });

  await test("C5 - a sink's RETURN VALUE has nowhere to go: emit returns undefined", () => {
    __hostEventTest.clear();
    const off = onHostEvent(() => ({ verdict: 'REFUSED' }));
    try {
      assert.equal(emitHostEvent(call()), undefined,
        'in Phase 1 there is no channel through which a consumer could decide anything');
    } finally { off(); }
  });

  await test('with NO sink, emit is inert and costs nothing', () => {
    __hostEventTest.clear();
    assert.equal(__hostEventTest.count(), 0);
    assert.equal(emitHostEvent(call()), undefined);
  });

  await test('detach really detaches, and is idempotent', () => {
    __hostEventTest.clear();
    const off = onHostEvent(() => {});
    assert.equal(__hostEventTest.count(), 1);
    off(); assert.equal(__hostEventTest.count(), 0);
    off(); assert.equal(__hostEventTest.count(), 0);
  });

  await test('a malformed call site is survivable', () => {
    __hostEventTest.clear();
    let got = 0;
    const off = onHostEvent(() => { got++; });
    try { emitHostEvent({}); } finally { off(); }   // no tool, no run, no args
    assert.equal(got, 1, 'an incomplete payload should still produce an event rather than crash a run');
  });

  await test('the file sink writes one JSON line per event', () => {
    __hostEventTest.clear();
    const log = join(TMP, 'sink.jsonl');
    const off = attachFileSink(log);
    try { emitHostEvent(call()); emitHostEvent(call({ tool: 'read_file' })); } finally { off(); }
    const lines = readFileSync(log, 'utf8').trim().split('\n');
    assert.equal(lines.length, 2);
    assert.deepEqual(lines.map((l) => JSON.parse(l).tool), ['write_file', 'read_file']);
  });

  // ─────────────────── PART B: C1, on the REAL path, in a REAL hub ───────────────────
  //
  // Spawns index.js against fakemodel.mjs and reads the JSONL the hub wrote itself. If the
  // harness is unavailable this SKIPS rather than passing: a criterion that quietly stops
  // being checked is worse than one that fails.
  let harness = null;
  try { harness = await import('./testHarness.mjs'); } catch { /* reported below */ }

  if (!harness) {
    console.log('SKIP  C1 (real path): testHarness.mjs unavailable - C1 IS NOT ESTABLISHED');
  } else {
    const { scratch, startHub, freePorts } = harness;
    const [hubPort, fakePort] = await freePorts(2);
    const dir = scratch('hostevent-c1', { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
    const log = join(dir, 'host-events.jsonl');
    const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--script', 'happy'], { stdio: 'ignore' });
    let hub = null;
    try {
      const started = await startHub(dir, { port: hubPort, env: { HOST_EVENT_LOG: log, AGENT_APPROVAL_MODE: 'build' } });
      hub = started.hub;
      const { api } = started;

      const { runId } = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Create hello.js that prints hello' }) });
      let run = null;
      for (let i = 0; i < 120; i++) {
        run = await api(`/agent/${runId}`);
        if (run && run.status && run.status !== 'running' && !run.busy) break;
        await new Promise((r) => setTimeout(r, 1000));
      }

      await test('C1 - the hub wrote a host-event log at all', () => {
        assert.ok(existsSync(log), `no events file at ${log} - the sink never attached in the real hub`);
      });

      const events = existsSync(log)
        ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
        : [];
      // The run's own record of what it executed. `type === 'tool'` is a step that actually
      // called a tool; approval_request/checkpoint/note/plan are bookkeeping, not executions.
      const toolSteps = (run?.steps || []).filter((s) => s.type === 'tool');

      await test('C1 - EXACTLY one event per tool execution: no drops, no duplicates', () => {
        assert.ok(toolSteps.length > 0, 'the scripted run executed no tools, so C1 is untested');
        assert.equal(events.length, toolSteps.length,
          `${events.length} events vs ${toolSteps.length} tool steps - a gap is a dropped observation, a surplus is a double emit`);
      });

      await test('C1 - the events are the SAME tools, in the SAME order', () => {
        assert.deepEqual(events.map((e) => e.tool), toolSteps.map((s) => s.tool));
      });

      await test('C3 - a real run stamps entrance from its ROUTE, not from source', () => {
        assert.ok(events.length > 0, 'no events to check');
        for (const e of events) {
          assert.equal(e.run.entrance, 'http:start', 'POST /agent/start must stamp http:start');
          assert.equal(e.actor, 'model');
        }
        assert.notEqual(events[0].run.entrance, events[0].run.source,
          'entrance and source must not have collapsed into the same value');
      });

      await test('C2 - a real write carries a real before-image or a real reason', () => {
        const writes = events.filter((e) => ['write_file', 'edit_file', 'append_file'].includes(e.tool));
        assert.ok(writes.length > 0, 'the scripted run wrote nothing, so C2 is untested on the real path');
        for (const w of writes) {
          if (w.before.present) assert.equal(typeof w.before.text, 'string');
          else assert.ok(Object.values(BEFORE_MISSING).includes(w.before.why), `unknown absence reason ${w.before.why}`);
        }
      });
    } finally {
      try { if (hub) hub.kill(); } catch {}
      try { fake.kill(); } catch {}
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  }
} finally {
  __hostEventTest.clear();
  try { rmSync(TMP, { recursive: true, force: true }); } catch {}
}

console.log(`host event (Phase 1 C1-C5): ${passed} passed${process.exitCode ? ' (with failures above)' : ''}`);
process.exit(process.exitCode || 0);
