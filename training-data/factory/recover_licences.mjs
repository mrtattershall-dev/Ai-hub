/**
 * recover_licences.mjs - find licence terms GitHub's detector misses.
 *
 *   node factory/recover_licences.mjs <repos.json> --out enriched.json
 *   node factory/recover_licences.mjs <repos.json> --out enriched.json --only-null
 *
 * WHY
 * ---
 * GitHub reports `license: null` when a repo has no conventional LICENSE *file*, which is
 * not the same as having no terms. Three separate misses in two days, all the same shape:
 *
 *   CraftPix packs        License.txt containing only a URL
 *   Franuka icon pack     the file is called "License and index.txt"
 *   phaserjs/examples     terms stated in the README; api says null
 *
 * The last one cost the most: excluded twice as all-rights-reserved, it then produced
 * 8,274 rows - more than the entire 397-repo search built around it. 484 repos were
 * dropped on that null field alone.
 *
 * WHERE TERMS HIDE, and which to BELIEVE when they disagree:
 *   1. a root licence file   - deliberate, strongest
 *   2. the README            - a human sentence someone chose to write
 *   3. package.json          - weakest: `npm init -y` writes "license": "ISC" by default
 *
 * That order is not arbitrary. phaserjs/examples reports api=null, package.json=ISC,
 * README=MIT. Checking package.json first would have recorded ISC - an untouched npm
 * default - over an explicit "released under the MIT license" in the README. All sources
 * are collected and disagreements are reported rather than silently resolved.
 *
 * Every recovery records WHERE it was found and the exact sentence, so a later reader can
 * check the claim instead of trusting this script.
 */
import { readFileSync, writeFileSync } from 'fs';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i > -1 && args[i + 1] ? args[i + 1] : d; };
const IN = args.find((a) => !a.startsWith('--') && /\.json$/i.test(a));
const OUT = flag('out', null);
const ONLY_NULL = args.includes('--only-null');
const TOKEN = process.env.GITHUB_TOKEN || '';
if (!IN || !OUT) {
  console.error('usage: node factory/recover_licences.mjs <repos.json> --out <enriched.json>');
  process.exit(1);
}

const OK = new Set(['mit', 'apache-2.0', 'bsd-2-clause', 'bsd-3-clause', 'isc', 'unlicense',
  'cc0-1.0', '0bsd', 'mpl-2.0', 'zlib', 'wtfpl', 'cc-by-4.0']);

const SPDX = [
  [/\bMIT\b/i, 'mit'],
  [/\bApache[\s-]*2/i, 'apache-2.0'],
  [/\bBSD[\s-]*3/i, 'bsd-3-clause'],
  [/\bBSD[\s-]*2/i, 'bsd-2-clause'],
  [/\bBSD\b/i, 'bsd-3-clause'],
  [/\bISC\b/i, 'isc'],
  [/\bCC0\b/i, 'cc0-1.0'],
  [/\bUnlicense\b/i, 'unlicense'],
  [/\b0BSD\b/i, '0bsd'],
  [/\bMPL[\s-]*2/i, 'mpl-2.0'],
  [/\bzlib\b/i, 'zlib'],
  [/\bWTFPL\b/i, 'wtfpl'],
  [/\bCC[\s-]?BY[\s-]?4/i, 'cc-by-4.0'],
  [/\bGPL\b/i, 'gpl'],          // detected so it can be EXCLUDED knowingly, not silently
  [/\bAGPL\b/i, 'agpl'],
];

const spdxOf = (text) => {
  for (const [rx, key] of SPDX) if (rx.test(text)) return key;
  return null;
};

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'hub-licence-recovery',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};
const raw = { ...headers, Accept: 'application/vnd.github.raw' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, h = headers) {
  try {
    const r = await fetch(url, { headers: h, signal: AbortSignal.timeout(30_000) });
    if (!r.ok) return null;
    return h === raw ? await r.text() : await r.json();
  } catch { return null; }
}

/** package.json "license" - the most common declaration in a JS repo with no LICENSE file. */
async function fromPackageJson(name) {
  const t = await get(`https://api.github.com/repos/${name}/contents/package.json`, raw);
  if (!t) return null;
  let j;
  try { j = JSON.parse(t); } catch { return null; }
  const lic = typeof j.license === 'string' ? j.license
    : (j.license && j.license.type) || (Array.isArray(j.licenses) && j.licenses[0]?.type);
  if (!lic) return null;
  const key = spdxOf(String(lic));
  return key ? { key, where: 'package.json', evidence: `"license": ${JSON.stringify(lic)}` } : null;
}

async function fromReadme(name) {
  const t = await get(`https://api.github.com/repos/${name}/readme`, raw);
  if (!t) return null;
  const line = t.match(/^.*\b(released|licen[cs]ed|available|distributed)\b.*\blicen[cs]e[sd]?\b.*$/im)
    || t.match(/^.*\blicen[cs]e[sd]?\b.*\b(MIT|Apache|BSD|ISC|CC0|Unlicense|zlib|MPL|WTFPL|GPL)\b.*$/im);
  if (!line) return null;
  const key = spdxOf(line[0]);
  return key ? { key, where: 'readme', evidence: line[0].trim().slice(0, 160) } : null;
}

/** Any root file that looks like it carries terms, whatever it is named. */
async function fromRootFile(name) {
  const tree = await get(`https://api.github.com/repos/${name}/contents/`);
  if (!Array.isArray(tree)) return null;
  const cands = tree.filter((f) => f.type === 'file'
    && /^(licen[cs]|copying|terms|notice|legal)/i.test(f.name)
    && f.size > 0 && f.size < 200_000);
  for (const c of cands) {
    const t = await get(`https://api.github.com/repos/${name}/contents/${encodeURIComponent(c.name)}`, raw);
    if (!t) continue;
    const key = spdxOf(t.slice(0, 4000));
    if (key) {
      const line = t.split('\n').find((l) => spdxOf(l)) || c.name;
      return { key, where: c.name, evidence: line.trim().slice(0, 160) };
    }
    // A file that only points elsewhere still tells us terms EXIST - record it rather than
    // reporting "no terms", which is a different and stronger claim.
    const url = t.match(/https?:\/\/\S+/);
    if (url) return { key: null, where: c.name, evidence: `terms by reference: ${url[0].slice(0, 120)}` };
  }
  return null;
}

const data = JSON.parse(readFileSync(IN, 'utf8'));
const repos = data.permissive || data.repos || data;
const targets = ONLY_NULL ? repos.filter((r) => !r.licenseKey) : repos;
console.log(`checking ${targets.length} of ${repos.length} repo(s)\n`);

const found = { 'package.json': 0, readme: 0, rootfile: 0, reference: 0 };
const conflicts = [];
let recovered = 0;
let excludedCopyleft = 0;

for (const [i, r] of targets.entries()) {
  if (r.licenseKey) continue;
  // Collect every source, then decide. Strongest evidence wins, and a disagreement is
  // recorded instead of being hidden by whichever check happened to run first.
  const sources = [];
  const rootHit = await fromRootFile(r.name);
  if (rootHit && rootHit.key) sources.push(rootHit);
  const readmeHit = await fromReadme(r.name);
  if (readmeHit) sources.push(readmeHit);
  const pkgHit = await fromPackageJson(r.name);
  if (pkgHit) sources.push(pkgHit);

  const keys = new Set(sources.map((s2) => s2.key));
  if (keys.size > 1) {
    conflicts.push({ repo: r.name, saw: sources.map((s2) => `${s2.where}=${s2.key}`).join(' ') });
  }
  const hit = sources[0] || (rootHit && !rootHit.key ? rootHit : null);
  if (hit) {
    if (hit.key) {
      r.licenseKey = hit.key;
      r.license = hit.key.toUpperCase();
      r.licenceFrom = hit.where;
      r.licenceEvidence = hit.evidence;
      recovered++;
      found[hit.where === 'package.json' ? 'package.json' : hit.where === 'readme' ? 'readme' : 'rootfile']++;
      if (!OK.has(hit.key)) excludedCopyleft++;
      console.log(`  + ${r.name.padEnd(46)} ${hit.key.padEnd(12)} via ${hit.where}`);
    } else {
      r.licenceFrom = hit.where;
      r.licenceEvidence = hit.evidence;
      found.reference++;
    }
  }
  await sleep(TOKEN ? 80 : 900);
  if ((i + 1) % 50 === 0) console.log(`  … ${i + 1}/${targets.length}, ${recovered} recovered`);
}

const permissive = repos.filter((r) => r.licenseKey && OK.has(r.licenseKey));
console.log(`\nrecovered ${recovered} repo(s):`);
console.log(`  package.json ${found['package.json']}   readme ${found.readme}   root file ${found.rootfile}`);
console.log(`  ${found.reference} more state terms BY REFERENCE (a URL) - not auto-classified`);
console.log(`  ${excludedCopyleft} of the recovered are copyleft and stay excluded - now knowingly`);
if (conflicts.length) {
  console.log(`
  ${conflicts.length} repo(s) where sources DISAGREE (strongest was taken):`);
  for (const c of conflicts.slice(0, 15)) console.log(`    ${c.repo.padEnd(44)} ${c.saw}`);
}
console.log(`\npermissive total: ${permissive.length} (was ${repos.filter((r) => r.licenceFrom === undefined && r.licenseKey && OK.has(r.licenseKey)).length})`);

writeFileSync(OUT, JSON.stringify({ permissive, all: repos }, null, 2), 'utf8');
console.log(`-> ${OUT}`);
