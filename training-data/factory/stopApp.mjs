/**
 * stopApp.mjs - stop a Modal app and PROVE it stopped. Rule 7 of the GPU spend rule, made
 * mechanical instead of remembered.
 *
 *   node training-data/factory/stopApp.mjs <app-name>
 *
 *   exit 0  the app list confirms nothing by that name is still deployed
 *   exit 1  it is still deployed, the list could not be read, or no such app exists -
 *           in every one of those cases a GPU may still be billing, and an ALARM is raised
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-09-10 a 30-minute GPU run overran because `python -m modal app stop <app>` prompts
 * "[y/N]" and ABORTS with exit 1 in a non-interactive shell. A manual stop, the 30-minute
 * watchdog and an `echo y |` retry all ran, and not one of them stopped anything. Only
 * `--yes` did. Every stop before that was a one-off command, so the fix lived in prose and
 * the next watchdog would have been written from scratch by someone who had to remember the
 * flag. This is the one path, so nobody has to remember.
 *
 * AND LOGGING WAS NOT ENOUGH
 * --------------------------
 * That watchdog DID fire, and it DID log the failure: "Aborted!", "stop exit 1" (committed in
 * measurements/2026-09-10-14b-30min/watchdog.log, 33cbc11). Nothing acted on it until someone
 * re-listed apps by hand. A failure written where nobody looks is indistinguishable from a
 * success. So a failed stop here is RETRIED, and a stop that still fails raises an ALARM in
 * the one file every session reads (COORD.md) as well as on stderr - not just a return code.
 *
 * THE LIST IS THE TRUTH
 * ---------------------
 * Success is NOT "the stop command exited 0". It is "afterwards, `modal app list` shows no app
 * with this name in state 'deployed'". The command is wrong in both directions: it can exit 0
 * while the list still lags, and it can exit non-zero because the app was already stopped.
 *
 * With one exception that matters more than the rest: a name that matches NOTHING is a
 * failure, not a success. "Nothing called coder14b-bse is deployed" is true, and it is
 * exactly what a typo looks like while coder14b-base keeps billing.
 *
 * AND THE REPORT MUST BE ABOUT THE APP IT STOPPED
 * -----------------------------------------------
 * Modal keeps stopped apps in the list, so one name can have several records. The first
 * version reported the newest `stopped_at` across ALL of them; when the app it had just
 * stopped had not had its `stopped_at` written yet, it reported the PREVIOUS run's stop time -
 * true data, wrong record (Session A, 2026-09-10: "21:10:17" reported for an app that stopped
 * at 22:01:49). So the ids that were deployed are captured BEFORE the stop, the stop time is
 * read from those records only, and it is NEVER borrowed from another record: if Modal has not
 * written it yet, the report says so and gives none.
 */
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PYTHON = process.env.PYTHON || 'python';
const DEFAULT_ALARM_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'COORD.md');

/** Run `python -m modal <args>`. stdin is closed, so a prompt aborts instead of hanging. */
export function runModal(args, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(PYTHON, ['-m', 'modal', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    const timer = setTimeout(() => { try { child.kill(); } catch { /* already gone */ } }, timeoutMs);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? 1, out, err }); });
    child.on('error', (e) => { clearTimeout(timer); resolve({ code: 1, out, err: String((e && e.message) || e) }); });
  });
}

/**
 * Say it where it will be read. A banner on stderr for whoever is watching, and an entry in
 * COORD.md for every session that is not - the file each of them reads, and the captain
 * audits. The file is read from the environment at CALL time, so a test can point it at a
 * scratch path and can never write into the real COORD.
 */
export function defaultAlarm(name, result) {
  const when = new Date().toISOString();
  const line = `GPU MAY STILL BE BILLING: stop of "${name}" FAILED (${result.stage}) at ${when} - ${result.detail}`;
  const bar = '!'.repeat(78);
  console.error(`\n${bar}\n!!! ${line}\n${bar}\n`);
  const file = process.env.STOPAPP_ALARM_FILE || DEFAULT_ALARM_FILE;
  try {
    appendFileSync(file,
      `\n\n## ALARM (stopApp) — ${line}\n` +
      `Rule 7: re-list apps and retry with \`node training-data/factory/stopApp.mjs ${name}\`, or tell tatte.\n`);
  } catch { /* the stderr banner above is the fallback */ }
}

/** The apps in `modal app list --json` output whose name is `name`. Null if it is unreadable. */
export function appsNamed(listJson, name) {
  let apps;
  try { apps = JSON.parse(listJson); } catch { return null; }
  if (!Array.isArray(apps)) return null;
  return apps.filter((a) => (a.description || a.Description) === name);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const snippet = (r) => String((r && (r.err || r.out)) || '').trim().slice(0, 200);
const idOf = (a) => a.app_id || a['App ID'] || null;

/**
 * Stop `name` and confirm it from the app list.
 *
 * Returns { ok, stage?, stopExit, stopAttempts, appIds?, stoppedAt?, detail }. `ok` is true
 * ONLY when the list shows at least one app by this name and none of them deployed. Every
 * result with ok:false raises the alarm exactly once. `run` and `alarm` are injectable so the
 * logic can be tested without touching a real Modal account or the real COORD.
 */
export async function stopApp(name, {
  run = runModal, alarm = defaultAlarm, retries = 5, waitMs = 2000, stopRetries = 3,
} = {}) {
  let stopAttempts = 0;
  const fail = (r) => {
    const out = { ok: false, stopAttempts, ...r };
    alarm(name, out);
    return out;
  };

  if (!name || typeof name !== 'string') {
    // A watchdog with no name stops nothing, which is a GPU left running. Alarm on it too.
    return fail({ stage: 'input', stopExit: null, detail: 'an app name is required - nothing was stopped' });
  }

  // Which records are we about to stop? Captured BEFORE the stop so the report can name them
  // and not a same-named record from an earlier run. An unreadable list here does not block
  // the stop - stopping the GPU matters more than a precise report about it.
  const before = await run(['app', 'list', '--json']);
  const beforeNamed = before.code === 0 ? appsNamed(before.out, name) : null;
  const targets = beforeNamed
    ? beforeNamed.filter((a) => a.state === 'deployed').map(idOf).filter(Boolean)
    : null;

  // --yes is the reason this file exists. Without it the command asks a question nobody can
  // answer and exits 1 having done nothing.
  const stopArgs = ['app', 'stop', '--yes', name];
  let stop = await run(stopArgs);
  stopAttempts = 1;

  let lagChecks = 0;
  for (;;) {
    const list = await run(['app', 'list', '--json']);
    const named = list.code === 0 ? appsNamed(list.out, name) : null;

    if (named === null) {
      if (lagChecks++ >= retries) {
        return fail({ stage: 'verify', stopExit: stop.code, detail: `could not read the app list: ${snippet(list)}` });
      }
    } else if (named.length === 0) {
      // A typo, or an app that never existed. Reporting success here would be the most
      // dangerous thing this function could do.
      return fail({
        stage: 'input', stopExit: stop.code,
        detail: `no app named "${name}" is in the app list - check the name; nothing is known to have stopped`,
      });
    } else {
      const live = named.filter((a) => a.state === 'deployed');
      if (live.length === 0) {
        let stoppedAt = null;
        let unrecorded = false;
        if (targets && targets.length) {
          // Only the records THIS call stopped. Never another record's time.
          const mine = named.filter((a) => targets.includes(idOf(a)));
          unrecorded = mine.length === 0 || mine.some((a) => !a.stopped_at);
          if (unrecorded && lagChecks++ < retries) { await sleep(waitMs); continue; }
          stoppedAt = mine.map((a) => a.stopped_at).filter(Boolean).sort().pop() || null;
        } else {
          // Nothing was deployed when we looked: it was already stopped. Report the most
          // recently CREATED record's stop, which is the last run under this name.
          const newest = [...named].sort((x, y) => String(x.created_at || '').localeCompare(String(y.created_at || ''))).pop();
          stoppedAt = (newest && newest.stopped_at) || null;
        }
        const note = unrecorded ? ' (Modal had not yet recorded stopped_at for the app stopped - none reported rather than borrow another record\'s)' : '';
        return {
          ok: true, stopExit: stop.code, stopAttempts, appIds: targets || [], stoppedAt,
          detail: (stop.code !== 0
            ? 'the stop command failed, but the app list shows nothing deployed - it was already stopped'
            : stopAttempts > 1
              ? `stopped on attempt ${stopAttempts}, and confirmed by the app list`
              : 'stopped, and confirmed by the app list') + note,
        };
      }
      if (stop.code !== 0) {
        // With --yes there is no prompt left to fail on, so a non-zero exit is a real error
        // (network, auth, a Modal hiccup) and is worth another try before anyone is woken.
        if (stopAttempts > stopRetries) {
          return fail({
            stage: 'stop', stopExit: stop.code, stillDeployed: live.length,
            detail: `the stop command failed ${stopAttempts} time(s), last exit ${stop.code}, and the app is still deployed: ${snippet(stop)}`,
          });
        }
        await sleep(waitMs);
        stop = await run(stopArgs);
        stopAttempts++;
        continue;
      }
      if (lagChecks++ >= retries) {
        return fail({
          stage: 'verify', stopExit: stop.code, stillDeployed: live.length,
          detail: 'the stop command exited 0 but the app list still shows it deployed',
        });
      }
    }
    await sleep(waitMs);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await stopApp(process.argv[2]);
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}
