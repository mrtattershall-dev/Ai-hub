/**
 * Why did every FIND miss? Three hypotheses, each checkable offline against the stored replies:
 *   H1 indentation   the model's lines are right but not at the file's indentation
 *   H2 ordering      the model reordered or merged lines that are not adjacent in the file
 *   H3 content       the model quoted lines that are not in the file at all
 */
import { readFileSync } from 'node:fs';
const W = process.argv[2];
const { parseEditBlocks } = await import('file:///C:/Users/tatte/Projects/ai-coding-hub-phase1/server/localEdit.mjs');

const norm = (t) => t.split('\n').map((l) => l.trim()).filter((l) => l.length).join('\n');

for (const s of [2, 3, 4, 5]) {
  const rep = JSON.parse(readFileSync(`${W}/repair_seed${s}.json`, 'utf8'));
  const file = JSON.parse(readFileSync(`C:/Users/tatte/Projects/ai-coding-hub-phase1/legasus/screen/MODEL-CMP-1_armB_seed${s}.json`, 'utf8')).candidate.text;
  const fileNorm = norm(file);
  console.log(`\n=== candidate seed ${s} ===`);
  for (const r of rep.rounds.filter((x) => x.round > 0)) {
    const blocks = parseEditBlocks(r.rawReply || '').blocks;
    if (!blocks.length) { console.log(`  round ${r.round}: no block parsed`); continue; }
    for (const [i, b] of blocks.entries()) {
      const exact = file.split(b.find).length - 1;
      const n = norm(b.find);
      const normCount = n.length ? fileNorm.split(n).length - 1 : 0;
      // Which quoted lines exist in the file at all, ignoring indentation?
      const lines = b.find.split('\n').map((l) => l.trim()).filter((l) => l.length);
      const fileLines = new Set(file.split('\n').map((l) => l.trim()));
      const missing = lines.filter((l) => !fileLines.has(l));
      const verdict = exact === 1 ? 'would have applied'
        : normCount === 1 ? 'H1/H2: every line exists and the sequence is unique ONCE INDENTATION IS IGNORED'
          : missing.length ? `H3: ${missing.length} of ${lines.length} quoted lines are not in the file`
            : `H2: all lines exist but the sequence appears ${normCount} time(s) when normalised`;
      console.log(`  round ${r.round} block ${i + 1}: ${lines.length} lines, exact ${exact}, normalised ${normCount} -> ${verdict}`);
      if (missing.length) console.log(`      first line not in the file: ${JSON.stringify(missing[0].slice(0, 90))}`);
    }
  }
}
