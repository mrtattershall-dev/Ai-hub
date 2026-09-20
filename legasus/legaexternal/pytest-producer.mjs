// r4 — PRODUCER #3: pytest. Selected by the rule frozen in 0baca08.
//
// Chosen for the coordinate Legasus HAS NO NAME FOR. Producer #2 asked what happens when a producer has
// FEWER coordinates than Legasus names. This asks the harder question:
//
//     COLLECTION COHORT. "test T passed" is true RELATIVE TO WHICH OTHER TESTS WERE COLLECTED in the
//     same session, because module- and session-scoped fixtures are built once and REUSED. The verdict is
//     about T, but it is scoped by a SET THAT T IS NOT THE ONLY MEMBER OF.
//
// None of repository / environment / history / criterion / invocation / implementation names that set.
// Two runs can agree on ALL SIX and still disagree on the verdict - which means the closed dimension set
// can admit a CONTRADICTION it has no vocabulary to explain. That is strictly worse than dropping a
// coordinate, and it is why this producer was worth running.
//
// The report is produced by pytest's OWN hook API (pytest_runtest_logreport) rather than by parsing its
// human-readable output, so Legasus is not reimplementing pytest semantics.
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const NL = String.fromCharCode(10);

// A pytest plugin, in pytest's own vocabulary. It records the COHORT as a first-class part of every
// record, because the producer genuinely knows it and hiding it here would be the adapter's sin moved
// upstream.
const PLUGIN = [
  'import json, os',
  '_records = []',
  '_collected = []',
  'def pytest_collection_modifyitems(session, config, items):',
  '    _collected.extend(sorted(i.nodeid for i in items))',
  'def pytest_runtest_logreport(report):',
  '    if report.when != "call" and not (report.when == "setup" and report.outcome != "passed"):',
  '        return',
  '    _records.append({"nodeid": report.nodeid, "when": report.when,',
  '                     "outcome": report.outcome.upper()})',
  'def pytest_sessionfinish(session, exitstatus):',
  '    out = {"exitstatus": int(exitstatus), "cohort": list(_collected),',
  '           "plugins": sorted(n for n, _ in session.config.pluginmanager.list_name_plugin()),',
  '           "records": _records}',
  '    with open(os.environ["LEGA_PYTEST_OUT"], "w", encoding="utf-8") as fh:',
  '        json.dump(out, fh)',
].join(NL);

export function runPytestProducer({ dir, select = [], outPath }) {
  const pluginPath = join(dir, '_lega_plugin.py');
  const reportPath = outPath || join(dir, '_lega_report.json');
  writeFileSync(pluginPath, PLUGIN, 'utf8');
  if (existsSync(reportPath)) rmSync(reportPath, { force: true });

  let version = null;
  try {
    version = execFileSync('python', ['-c', 'import pytest;print(pytest.__version__)'],
      { encoding: 'utf8', timeout: 30000 }).trim();
  } catch (e) {
    return { ok: false, producerFailed: true,
      why: 'pytest could not be run. That is a fact about the PRODUCER and carries no evidential force'
        + ' about the subject.' };
  }

  const args = ['-m', 'pytest', '-p', 'no:cacheprovider', '-p', '_lega_plugin', '-q', '--tb=no',
    ...select];
  try {
    execFileSync('python', args, { cwd: dir, encoding: 'utf8', timeout: 120000, stdio: 'ignore',
      env: { ...process.env, PYTHONPATH: dir, LEGA_PYTEST_OUT: reportPath,
        PYTHONDONTWRITEBYTECODE: '1' } });
  } catch (e) { /* a non-zero exit means tests FAILED, which is evidence, not producer failure */ }

  if (!existsSync(reportPath)) {
    return { ok: false, producerFailed: true,
      why: 'pytest ran but produced no report. NON-KNOWLEDGE: this says nothing about the subject.' };
  }
  const raw = JSON.parse(readFileSync(reportPath, 'utf8'));

  // THE COHORT IS PART OF THE IDENTITY, because the producer's own semantics make it so. A record that
  // dropped it would be asserting a verdict the producer never issued unconditionally.
  const cohortKey = raw.cohort.join(' ');
  const records = raw.records.map((r) => ({
    nodeid: r.nodeid,
    nativeResult: r.when === 'setup' ? 'SETUP_' + r.outcome : r.outcome,
    nativeDetails: { when: r.when, cohortSize: raw.cohort.length },
    identity: {
      producer: 'pytest',
      producerVersion: version,
      invocation: r.nodeid,
      // THE TWO FOREIGN COORDINATES, carried in the producer's own terms.
      collectionCohort: cohortKey,
      pluginSet: raw.plugins.join(' '),
    },
  }));
  return { ok: true, producer: 'pytest', producerVersion: version,
    cohort: raw.cohort, plugins: raw.plugins, records };
}

export const pytestIdentity = (rec) =>
  ['pytest', rec.identity.producerVersion, rec.identity.invocation,
    rec.identity.collectionCohort].join('|');
