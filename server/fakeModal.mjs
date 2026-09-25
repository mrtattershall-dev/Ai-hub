/**
 * fakeModal.mjs - a STAND-IN for the `modal` CLI, for testing gpuWatchdog.mjs without a GPU.
 *
 *   node server/fakeModal.mjs app list --json
 *   node server/fakeModal.mjs app stop --yes <app>
 *
 * State lives in FAKE_MODAL_STATE (a JSON file) so separate invocations see each other, exactly
 * as the real CLI's calls all see the same remote app. Fault modes, from the state file:
 *   failStopsBefore: N   stop calls numbered below N exit 1 with an error (transient failure)
 *   neverStops: true     stop exits 0 but the app stays deployed (the failure the watchdog
 *                        must REPORT rather than assume away)
 * Every invocation is appended to FAKE_MODAL_LOG.
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const STATE = process.env.FAKE_MODAL_STATE;
if (!STATE) { console.error('FAKE_MODAL_STATE unset'); process.exit(2); }
const load = () => JSON.parse(readFileSync(STATE, 'utf8'));
const save = (s) => writeFileSync(STATE, JSON.stringify(s), 'utf8');
const log = (e) => { if (process.env.FAKE_MODAL_LOG) appendFileSync(process.env.FAKE_MODAL_LOG, JSON.stringify({ at: Date.now(), ...e }) + '\n'); };

const argv = process.argv.slice(2);
const st = load();
if (argv[0] === 'app' && argv[1] === 'list') {
  st.listCalls = (st.listCalls || 0) + 1; save(st); log({ cmd: 'list' });
  if (!argv.includes('--json')) { console.log('(table output)'); process.exit(0); }
  console.log(JSON.stringify([{ app_id: 'ap-fake', description: st.app, state: st.state, tasks: st.state === 'stopped' ? '0' : '1', created_at: '2026-09-25 00:00:00-05:00', stopped_at: st.stopped_at || null }]));
  process.exit(0);
}
if (argv[0] === 'app' && argv[1] === 'stop') {
  const name = argv.filter((a) => !a.startsWith('-')).slice(2)[0];
  st.stopCalls = (st.stopCalls || 0) + 1; save(st); log({ cmd: 'stop', name, yes: argv.includes('--yes'), n: st.stopCalls });
  if (!argv.includes('--yes')) { console.error('Are you sure? [y/N]: Aborted.'); process.exit(1); }
  if (name !== st.app) { console.error(`Error: App '${name}' not found`); process.exit(1); }
  if (st.failStopsBefore && st.stopCalls < st.failStopsBefore) { console.error('Error: transient failure talking to modal'); process.exit(1); }
  if (st.state === 'stopped') { console.log(`App ${name} is already stopped`); process.exit(0); }
  if (!st.neverStops) { st.state = 'stopped'; st.stopped_at = new Date().toISOString(); save(st); }
  console.log(`App ${name} stopped`);
  process.exit(0);
}
console.error(`fakeModal: unsupported ${argv.join(' ')}`);
process.exit(2);
