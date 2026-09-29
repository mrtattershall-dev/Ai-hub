// CHAIN-1 CHILD. Drives the REAL agent tool dispatch through the receipt/ancestry layer.
//
// Invoked as:  node chain-child.mjs <workspace> <scenario>
// with AGENT_WORKSPACE and AGENT_GOVERNED_WRITES=1 already in env.
//
// OWN PROCESS, NOT A FUNCTION CALL. `export const WORKSPACE = process.env.AGENT_WORKSPACE` binds at
// IMPORT time (agent.js), and `AGENT_GOVERNED_WRITES` is read at module scope. Setting either after the
// import points the tools at the wrong tree or leaves governance off while the harness reports it on.
// That exact mistake is in this project's hazard ledger, which is why this is a child process.
//
// AND IT GOES THROUGH `tools[name](args)`. Calling prepare()/commit() directly would prove the
// coordination layer works, which is already established, and would prove nothing about whether the
// CONTROLLER routes through it.
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { delegate } from '../../legaknow/calculus.mjs';
import { createWorkspace, fileScope, revisionOf, EDIT_FIXTURE } from './workspace.mjs';

const [, , workspace, scenario] = process.argv;
const out = (o) => process.stdout.write('\n__RESULT__' + JSON.stringify(o) + '\n');
const readA = () => readFileSync(join(workspace, 'src', 'a.js'), 'utf8');
const readB = () => readFileSync(join(workspace, 'src', 'b.js'), 'utf8');

const agent = await import('../../../server/agent.js');
const callTool = agent.__toolPolicyTest.callTool;

// THE GOVERNING LAYER'S SIDE OF THE BOUNDARY. The owner issues authority; the controller holds it. The
// model never sees a token and never names an ancestor.
const ws = createWorkspace({ root: workspace });
agent.setRunWorkspace(ws);
const grantFor = (rel) => delegate({
  from: 'OWNER', grant: EDIT_FIXTURE.requires, to: 'controller',
  context: { repository: 'CHAIN1', implementation: rel, revision: revisionOf(join(workspace, rel)) },
});
const steps = [];
async function step(label, { rel, args, tool = 'write_file', ancestry = [] }) {
  agent.setRunAuthority(grantFor(rel));
  agent.setRunAncestry(ancestry);
  const before = { a: readA(), b: readB() };
  let result;
  try { result = String(await callTool(tool, args)); } catch (e) { result = 'THREW: ' + e.message; }
  const after = { a: readA(), b: readB() };
  steps.push({
    // 480, not 220: a refusal naming two absolute Windows temp paths exceeded the shorter cap and the
    // assertion failed on the TRUNCATION rather than on the behaviour. Keep the whole reason.
    label, tool, result: result.slice(0, 480),
    refused: result.startsWith('REFUSED'),
    aChanged: before.a !== after.a, bChanged: before.b !== after.b,
    promotions: agent.runPromotions().length,
    lastReceipt: agent.runPromotions().slice(-1)[0] || null,
  });
  return steps[steps.length - 1];
}

const A_NEW = 'export const a = 2; // promoted by A\n';
const B_NEW = 'export const b = 2; // promoted by B, assuming A\n';

try {
  if (scenario === 'chain') {
    // ── THE ONE REAL CHAIN ────────────────────────────────────────────────────────────────────────
    // A promotes.
    const a = await step('A promotes', { rel: 'src/a.js', args: { path: 'src/a.js', content: A_NEW } });
    const receiptA = a.lastReceipt;

    // A becomes DEFUNCT: its effect is undone underneath it by something outside this run.
    writeFileSync(join(workspace, 'src', 'a.js'), 'export const a = 999; // reverted elsewhere\n');
    const defunct = ws.receiptDefunct(receiptA);

    // B was verified assuming A. It must not promote now.
    const b = await step('B assuming a defunct A', {
      rel: 'src/b.js', args: { path: 'src/b.js', content: B_NEW }, ancestry: [receiptA],
    });
    out({ scenario, receiptA, defunct: { defunct: defunct.defunct, reason: defunct.reason }, steps,
      events: ws.events().map((e) => ({ type: e.type, reason: e.reason || null, scope: e.scope && e.scope.path })) });
  } else if (scenario === 'chain-control') {
    // IDENTICAL, except A is never undone. Without this the refusal above could be a layer that
    // refuses every descendant.
    const a = await step('A promotes', { rel: 'src/a.js', args: { path: 'src/a.js', content: A_NEW } });
    const b = await step('B assuming an INTACT A', {
      rel: 'src/b.js', args: { path: 'src/b.js', content: B_NEW }, ancestry: [a.lastReceipt] });
    out({ scenario, receiptA: a.lastReceipt, steps });
  } else if (scenario === 'forged-ancestry') {
    // THE MODEL TRIES TO ERASE THE CONDITION. It passes assumedReceipts (and an authority) in tool
    // ARGS, claiming to assume nothing, while the governing layer has declared a defunct predecessor.
    const a = await step('A promotes', { rel: 'src/a.js', args: { path: 'src/a.js', content: A_NEW } });
    writeFileSync(join(workspace, 'src', 'a.js'), 'export const a = 999;\n');
    const b = await step('B with forged args', {
      rel: 'src/b.js', ancestry: [a.lastReceipt],
      args: { path: 'src/b.js', content: B_NEW,
        // none of these are read anywhere: self-issued ancestry and self-issued authority
        assumedReceipts: [], ancestry: [], authority: 'OWNER', baseRevision: null, validation: null },
    });
    out({ scenario, steps });
  } else if (scenario === 'no-workspace') {
    // THE A-4 PATH IS PRESERVED: with no coordination layer installed, the direct executor still runs.
    agent.setRunWorkspace(null);
    const a = await step('A through the direct executor', {
      rel: 'src/a.js', args: { path: 'src/a.js', content: A_NEW } });
    const wrong = await step('wrong target through the direct executor', {
      rel: 'src/a.js', args: { path: 'src/b.js', content: B_NEW } });
    out({ scenario, steps: [a, wrong] });
  } else if (scenario === 'root-mismatch') {
    // A workspace rooted somewhere else must be refused, not silently governed.
    agent.setRunWorkspace(createWorkspace({ root: join(workspace, 'src') }));
    const a = await step('A with a mis-rooted workspace', {
      rel: 'src/a.js', args: { path: 'src/a.js', content: A_NEW } });
    out({ scenario, steps: [a] });
  } else {
    out({ error: 'unknown scenario ' + scenario });
    process.exit(2);
  }
} catch (e) {
  out({ error: String(e && e.stack).slice(0, 600), steps });
  process.exit(3);
}
