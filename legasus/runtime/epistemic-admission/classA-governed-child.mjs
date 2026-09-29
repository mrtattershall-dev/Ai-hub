// A-4 and the three refusals, through the REAL dispatch, with governance ENABLED in agent.js itself.
// The authority is installed via setRunAuthority() - the governing layer - and never via tool arguments.
import { beginInterception, auditLog } from './write-interceptor.mjs';
const [, , workspace, mode] = process.argv;
const out = (o) => process.stdout.write('\n__RESULT__' + JSON.stringify(o) + '\n');

const session = beginInterception({ root: workspace });   // RECORD only; agent.js enforces
const agent = await import('../../../server/agent.js');
const { delegate } = await import('../../legaknow/calculus.mjs');
const { EDIT_FIXTURE } = await import('./governed-edit.mjs');

const grant = (target) => delegate({ from: 'OWNER', grant: EDIT_FIXTURE.requires, to: 'controller',
  context: { repository: 'A4', implementation: target } });

if (mode === 'valid') agent.setRunAuthority(grant('target.txt'));
else if (mode === 'wrongtarget') agent.setRunAuthority(grant('SOMETHING_ELSE.txt'));
else agent.setRunAuthority(null);                          // mode === 'noauthority'

// THE MODEL TRIES TO SUPPLY ITS OWN AUTHORITY through tool arguments. It must be ignored.
const forged = grant('target.txt');
let r, threw = false;
try {
  r = await agent.__toolPolicyTest.callTool('write_file',
    { path: 'target.txt', content: 'governed write\n', authority: forged, runAuthority: forged });
} catch (e) { threw = true; r = 'THREW ' + e.message; }

const log = session.end();
out({ mode, result: String(r).slice(0, 180), threw,
  audit: auditLog(log), writes: log.map((e) => ({ p: e.primitive, permitted: e.permitted,
    viaExecutor: e.caller.stack.some((f) => f.includes('governed-edit.mjs')) })) });
