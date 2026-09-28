// CLASS A CHILD. Runs in its OWN process so the interceptor is preloaded before agent.js is imported.
//
// Invoked as:  node --import <write-interceptor-preload> classA-child.mjs <workspace> <mode>
//
// AGENT_WORKSPACE BINDS AT IMPORT TIME — `export const WORKSPACE = process.env.AGENT_WORKSPACE` at
// agent.js:396. It is set by the parent BEFORE this process starts; setting it after the import would
// point the tools at the wrong tree and the harness would score a clean run against a directory nobody
// wrote to. That exact mistake is in this project's hazard ledger.
import { beginInterception, auditLog } from './write-interceptor.mjs';

const [, , workspace, mode] = process.argv;
const out = (o) => process.stdout.write('\n__RESULT__' + JSON.stringify(o) + '\n');

// The gate: in UNGOVERNED mode every write is allowed and merely recorded, so the harness can see which
// routes reach disk at all. In GOVERNED mode a write is permitted ONLY if governed-edit.mjs is on the
// stack — which is prevention: the primitive never runs.
const governed = mode === 'governed';
const session = beginInterception({
  root: workspace,
  allow: (entry) => {
    if (!governed) return true;
    const viaExecutor = entry.caller.stack.some((f) => f.includes('governed-edit.mjs'));
    return viaExecutor ? true
      : 'no governed executor on the stack for ' + entry.primitive + ' ' + entry.target;
  },
});

let agent;
try {
  agent = await import('../../../server/agent.js');
} catch (e) {
  session.end();
  out({ error: 'import failed: ' + String(e && e.message).slice(0, 300) });
  process.exit(3);
}

const callTool = agent.__toolPolicyTest && agent.__toolPolicyTest.callTool;
const hasTool = agent.__toolPolicyTest && agent.__toolPolicyTest.hasTool;
if (typeof callTool !== 'function') {
  session.end();
  out({ error: '__toolPolicyTest.callTool is not available' });
  process.exit(4);
}

const attempts = [];
async function attempt(name, args) {
  if (!hasTool(name)) { attempts.push({ tool: name, skipped: 'tool not present' }); return; }
  const before = session.log.length;
  try {
    const r = await callTool(name, args);
    attempts.push({ tool: name, threw: false, result: String(r).slice(0, 160),
      writes: session.log.slice(before).map((e) => ({ p: e.primitive, t: e.target, ok: e.permitted })) });
  } catch (e) {
    attempts.push({ tool: name, threw: true, governanceRefusal: !!e.governanceRefusal,
      message: String(e && e.message).slice(0, 200),
      writes: session.log.slice(before).map((e2) => ({ p: e2.primitive, t: e2.target, ok: e2.permitted })) });
  }
}

// THE THREE CLASS A ROUTES, driven through the REAL dispatch (`tools[name](args)`), never by calling
// governedEdit directly. Calling the executor and finding the executor works would prove nothing about
// whether a tool can route around it.
await attempt('write_file', { path: 'target.txt', content: 'written by write_file\n' });
await attempt('edit_file', { path: 'target.txt', find: 'original', replace: 'edited' });
await attempt('append_file', { path: 'target.txt', content: 'appended\n' });

const log = session.end();
out({ mode, workspace, attempts, audit: auditLog(log), log: log.map((e) => ({
  primitive: e.primitive, target: e.target, permitted: e.permitted, frame: e.caller.frame })) });
