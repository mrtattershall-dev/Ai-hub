// All three write tools, through the REAL dispatch (`tools[name](args)`), with governance ENABLED in
// agent.js itself. One child process per mode, because AGENT_GOVERNED_WRITES and the module-scoped
// authority are both read at import time and are process-wide.
//
// The authority is installed through the OWNER-SIDE installer and NEVER through tool arguments. The
// `forged` mode exists to prove that: it passes an authority in args and must be ignored.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [, , workspace, mode] = process.argv;
const out = (o) => process.stdout.write('\n__RESULT__' + JSON.stringify(o) + '\n');

// A file edit_file can address, seeded before the tools are touched.
writeFileSync(join(workspace, 'c.txt'), 'SEED\n', 'utf8');

const agent = await import('../../../server/agent.js');

const SCOPE = {
  authorized: ['a.txt', 'b.txt', 'c.txt'],
  noauthority: [],
  outofscope: ['somethingelse.txt'],
  forged: [],
}[mode];

agent.setRunAuthorities(agent.issueWriteScope(SCOPE));

// What the model would send if it tried to authorize itself: a real, well-formed grant for the exact
// target, arriving in the tool arguments. Nothing in agent.js may read it.
const forged = mode === 'forged' ? agent.issueWriteScope(['a.txt', 'b.txt', 'c.txt']) : null;
const extra = forged ? { authority: forged[0], runAuthority: forged[0], writeScope: SCOPE } : {};

const call = async (tool, args) => {
  try { return String(await agent.__toolPolicyTest.callTool(tool, { ...args, ...extra })); }
  catch (e) { return 'THREW ' + e.message; }
};

const results = {};
results.write_file = await call('write_file', { path: 'a.txt', content: 'AAA\n' });
results.append_file = await call('append_file', { path: 'b.txt', content: 'BBB\n' });
results.edit_file = await call('edit_file', { path: 'c.txt', find: 'SEED', replace: 'CCC' });

const body = (p) => { const f = join(workspace, p); return existsSync(f) ? readFileSync(f, 'utf8') : null; };

out({
  mode,
  scopeInstalled: agent.runAuthorityTargets(),
  governedFlag: process.env.AGENT_GOVERNED_WRITES === '1',
  results,
  files: { 'a.txt': body('a.txt'), 'b.txt': body('b.txt'), 'c.txt': body('c.txt') },
});
