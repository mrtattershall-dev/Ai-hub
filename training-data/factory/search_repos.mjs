/**
 * search_repos.mjs - find permissively-licensed game repos worth harvesting.
 *
 *   node factory/search_repos.mjs --out repos.json
 *   node factory/search_repos.mjs --out repos.json --min-stars 0
 *
 * WHY THE STAR FLOOR WAS THE PROBLEM
 * ----------------------------------
 * The first survey searched `stars:>60` and found ~75 permissive Phaser repos, which put a
 * 10k-row harvest out of reach. But a star floor selects for frameworks, templates and
 * tutorials - the very things that are NOT complete games - and excludes the game-jam and
 * hobby repos that are single-file, self-contained and exactly the shape a training row
 * needs. This searches without that bias and reports the real population.
 *
 * Licence filtering is not optional: the highest-yield Phaser repos on GitHub
 * (phaserjs/examples, 1.6k stars) carry NO licence, which means all rights reserved.
 *
 * Unauthenticated search is 10 requests/minute, so queries are spaced. Set GITHUB_TOKEN
 * for 30/min and deeper paging.
 */
import { writeFileSync } from 'fs';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i > -1 && args[i + 1] ? args[i + 1] : d; };
const OUT = flag('out', null);
const MIN_STARS = Number(flag('min-stars', 0));
const TOKEN = process.env.GITHUB_TOKEN || '';

const OK_LICENCE = new Set(['mit', 'apache-2.0', 'bsd-2-clause', 'bsd-3-clause', 'isc',
  'unlicense', 'cc0-1.0', '0bsd', 'mpl-2.0', 'zlib', 'wtfpl']);

// Phaser first, then the fantasy/RPG slant that matches the asset library, then the
// jam/small-game shapes that are most likely to be one self-contained file.
// Swap in a different query set with --set godot. The `OR` operator is deliberately
// absent everywhere: a bare `OR` in `phaser topdown OR top-down` matched 2.1M repos and
// pulled ohmyzsh and public-apis into a list of "harvestable game repos".
const SETS = {
  godot: [
    'topic:godot language:GDScript',
    'topic:godot-engine language:GDScript',
    'topic:gdscript',
    'topic:godot4 language:GDScript',
    'topic:godot-game language:GDScript',
    'topic:godot language:GDScript topic:rpg',
    'topic:godot language:GDScript topic:2d',
    'topic:godot-plugin language:GDScript',
    'topic:godot-addon language:GDScript',
  ],
};

const QUERIES = SETS[flag('set', '')] || [
  // TOPIC QUERIES ONLY. Keyword queries drift: with a token paging 4x deeper they pulled
  // reactjs-interview-questions and awesome-shell into a list of harvestable game repos,
  // and a bare OR once matched 2,118,666 repos. A topic is applied by the repo owner and
  // means what it says.
  'topic:phaser',
  'topic:phaser3',
  'topic:phaserjs',
  'topic:html5-game language:JavaScript',
  'topic:html5-games language:JavaScript',
  'topic:canvas-game language:JavaScript',
  'topic:game-jam language:JavaScript',
  'topic:js13kgames',
  'topic:ludum-dare language:JavaScript',
  'topic:gamedev language:JavaScript',
  'topic:game-development language:JavaScript',
  'topic:roguelike language:JavaScript',
  'topic:rpg language:JavaScript',
  'topic:2d-game language:JavaScript',
  'topic:browser-game language:JavaScript',
  'topic:pixel-art language:JavaScript',
  'topic:tilemap language:JavaScript',
  'topic:javascript-game',
  'topic:game language:TypeScript',
  'topic:phaser language:TypeScript',
];

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'hub-harvest-survey',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const seen = new Map();
const totals = [];

for (const q of QUERIES) {
  const full = MIN_STARS > 0 ? `${q} stars:>${MIN_STARS}` : q;
  let got = 0;
  let reported = 0;
  for (let page = 1; page <= (TOKEN ? 4 : 1); page++) {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(full)}`
      + `&sort=stars&order=desc&per_page=100&page=${page}`;
    let r;
    try { r = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) }); }
    catch (e) { console.log(`  ! ${q}: ${e.message}`); break; }
    if (r.status === 403 || r.status === 429) {
      console.log(`  … rate limited on "${q}", backing off`);
      await sleep(65_000);
      page--;
      continue;
    }
    if (!r.ok) { console.log(`  ! ${q}: HTTP ${r.status}`); break; }
    const j = await r.json();
    reported = j.total_count || 0;
    for (const it of j.items || []) {
      if (seen.has(it.full_name)) continue;
      seen.set(it.full_name, {
        name: it.full_name,
        stars: it.stargazers_count,
        license: it.license?.spdx_id || null,
        licenseKey: it.license?.key || null,
        mb: Math.round((it.size / 1024) * 10) / 10,
        pushed: (it.pushed_at || '').slice(0, 10),
        desc: String(it.description || '').slice(0, 90),
        query: q,
      });
      got++;
    }
    if ((j.items || []).length < 100) break;
    await sleep(TOKEN ? 2500 : 7000);
  }
  totals.push({ q, reported, new: got });
  console.log(`  ${String(reported).padStart(6)} matches  +${String(got).padStart(4)} new  ${q}`);
  await sleep(TOKEN ? 2500 : 7000);
}

/**
 * GitHub reports `license: null` when there is no LICENSE *file*, even when the README
 * states terms plainly. phaserjs/examples - the single highest-yield Phaser source on
 * GitHub, hundreds of self-contained scenes - says "The source code in this repo is
 * released under the MIT license" in its README and was excluded twice as all-rights-
 * reserved. 484 repos were dropped on that field alone, so the README is checked before
 * anything is discarded.
 */
async function licenceFromReadme(name) {
  try {
    const r = await fetch(`https://api.github.com/repos/${name}/readme`, {
      headers: { ...headers, Accept: 'application/vnd.github.raw' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) return null;
    const t = await r.text();
    const m = t.match(/^.*\b(released|licen[cs]ed|available)\b.*\blicen[cs]e[sd]?\b.*$/im)
      || t.match(/^.*\blicen[cs]e[sd]?\b.*\b(MIT|Apache|BSD|ISC|CC0|Unlicense|zlib|MPL)\b.*$/im);
    if (!m) return null;
    const line = m[0];
    for (const [rx, key] of [[/MIT/i, 'mit'], [/Apache/i, 'apache-2.0'],
      [/BSD/i, 'bsd-3-clause'], [/ISC/i, 'isc'], [/CC0/i, 'cc0-1.0'],
      [/Unlicense/i, 'unlicense'], [/zlib/i, 'zlib'], [/MPL/i, 'mpl-2.0']]) {
      if (rx.test(line)) return { key, evidence: line.trim().slice(0, 140) };
    }
    return null;
  } catch { return null; }
}

const all = [...seen.values()];
let recovered = 0;
if (!args.includes('--no-readme-check')) {
  const noFile = all.filter((r) => !r.licenseKey);
  console.log(`
checking README of ${noFile.length} repo(s) GitHub reports as unlicensed…`);
  for (const r of noFile) {
    const hit = await licenceFromReadme(r.name);
    if (hit) {
      r.licenseKey = hit.key;
      r.license = hit.key.toUpperCase();
      r.licenceFrom = 'readme';
      r.licenceEvidence = hit.evidence;
      recovered++;
    }
    await sleep(TOKEN ? 90 : 1200);
  }
  console.log(`  recovered ${recovered} repo(s) whose terms are stated in the README`);
}

const permissive = all.filter((r) => r.licenseKey && OK_LICENCE.has(r.licenseKey));
const unlicensed = all.filter((r) => !r.licenseKey);

console.log(`\n${all.length} distinct repos seen`);
console.log(`  ${permissive.length} permissively licensed  <- harvestable`);
console.log(`  ${unlicensed.length} with NO licence (all rights reserved) - excluded`);
console.log(`  ${all.length - permissive.length - unlicensed.length} other/copyleft - excluded`);

const byStars = (n) => permissive.filter((r) => r.stars >= n).length;
console.log(`\n  permissive by stars:  >=100 ${byStars(100)}   >=10 ${byStars(10)}   >=1 ${byStars(1)}   any ${permissive.length}`);
console.log(`  measured yield was ~16 complete standalone programs per repo`);
console.log(`  => ceiling roughly ${(permissive.length * 16).toLocaleString()} rows from this set`);

console.log('\n  top permissive repos:');
for (const r of permissive.sort((a, b) => b.stars - a.stars).slice(0, 15)) {
  console.log(`    ${String(r.stars).padStart(6)} ${(r.license || '').padEnd(12)} ${r.name.padEnd(44)} ${r.desc.slice(0, 40)}`);
}

if (OUT) {
  // Persist EVERY repo, not just the permissive ones. Saving only the survivors meant the
  // 3,164 repos discarded on a null licence field were gone from disk, so licence recovery
  // could not be run over them without repeating the whole search. Throwing away the
  // rejects also throws away the ability to question the rejection.
  writeFileSync(OUT, JSON.stringify({ permissive, all, totals, scanned: all.length }, null, 2), 'utf8');
  console.log(`\n  -> ${OUT}`);
}
