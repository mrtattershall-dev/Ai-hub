// The application-corpus search, per APPLICATION-CORPUS_PREREG.md.
// Frozen filter, frozen budget, three outcomes kept separate, both denominators reported.
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { analyse, makeLinter, RULE } from './adapter-eslint-repaired.mjs';

const CORPUS = process.argv[2];
const REPOS = process.argv.slice(3);
const BUDGET_FILES = 6000;
const EXCLUDE = /(^|[\\/])(node_modules|dist|build|out|coverage|\.git)[\\/]/;

const eligible = (root) => {
  const found = [];
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d); } catch { return; }
    for (const n of entries.sort()) {
      const p = join(d, n);
      if (EXCLUDE.test(p + '/')) continue;
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p);
      else if (/\.(js|mjs|cjs)$/.test(n) && !/\.min\.js$/.test(n)) found.push(p);
    }
  };
  walk(root);
  return found;
};

const slash = (p) => p.split('\\').join('/');

const linter = makeLinter();
const tally = { EVALUATED: 0, INCOMPLETE: 0, EXCLUDED: 0, VIOLATION: 0 };
const byRepo = {};
const candidates = [];
const incompleteReasons = {};
let scanned = 0;
const t0 = Date.now();

for (const repo of REPOS) {
  const root = join(CORPUS, repo);
  const files = eligible(root);
  byRepo[repo] = { eligibleOnDisk: files.length, EVALUATED: 0, INCOMPLETE: 0, EXCLUDED: 0,
    VIOLATION: 0, notScannedBudget: 0 };
  for (const f of files) {
    if (scanned >= BUDGET_FILES) { byRepo[repo].notScannedBudget++; continue; }
    scanned++;
    let rep;
    try {
      rep = await analyse(f, linter);
    } catch (err) {
      rep = { conditions: { analysisIncomplete: 'threw: ' + err.message }, findings: [], basis: {} };
    }
    let bucket;
    if (rep.conditions.excluded) bucket = 'EXCLUDED';
    else if (rep.conditions.analysisIncomplete || rep.conditions.coverageIncomplete
      || rep.conditions.ruleNotRun) bucket = 'INCOMPLETE';
    else if (rep.findings.length) bucket = 'VIOLATION';
    else bucket = 'EVALUATED';
    tally[bucket]++;
    byRepo[repo][bucket]++;
    if (bucket === 'INCOMPLETE') {
      const why = rep.conditions.analysisIncomplete ? 'analysisIncomplete'
        : rep.conditions.coverageIncomplete ? 'coverageIncomplete' : 'ruleNotRun';
      incompleteReasons[why] = (incompleteReasons[why] || 0) + 1;
    }
    if (bucket === 'VIOLATION') {
      candidates.push({ repo, file: slash(relative(CORPUS, f)), findings: rep.findings });
    }
    if (scanned % 250 === 0) {
      process.stdout.write('  ... ' + scanned + ' scanned, '
        + Math.round((Date.now() - t0) / 1000) + 's, candidates=' + candidates.length + '\n');
    }
  }
}

const out = { rule: RULE, budgetFiles: BUDGET_FILES, scanned, tally, byRepo, incompleteReasons,
  candidates, seconds: Math.round((Date.now() - t0) / 1000) };
writeFileSync('corpus-result-' + REPOS.join('_') + '.json', JSON.stringify(out, null, 2));
console.log('\n=== TALLY ===');
console.log(JSON.stringify(tally));
console.log('=== INCOMPLETE REASONS ===');
console.log(JSON.stringify(incompleteReasons));
console.log('=== PER REPO ===');
console.log(JSON.stringify(byRepo, null, 2));
console.log('=== CANDIDATE FINDINGS: ' + candidates.length + ' ===');
for (const c of candidates.slice(0, 30)) {
  console.log('  ' + c.file);
  for (const f of c.findings) console.log('      line ' + f.line + ': ' + f.message);
}
