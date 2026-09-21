/**
 * coverage.mjs - read "did this witness execute the region?" out of V8 coverage.
 *
 * One implementation, used by the in-process tracer (preload.mjs) and by the runners
 * reading NODE_V8_COVERAGE files, so the two cannot answer differently.
 *
 * V8 block coverage gives, per function, a list of ranges with counts; ranges[0] is the
 * whole function, later ranges are nested blocks. Two readings are taken:
 *
 *   fnCount    executions of the function itself
 *   siteCount  count of the INNERMOST range containing the mutation site - i.e. whether
 *              the affected block ran, which is what BIND's rule 3 asks
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parse } from '../node_modules/acorn/dist/acorn.mjs';

/** Counts for `region` from one script's coverage `functions` array. */
export function regionCounts(functions, region) {
  let fnCount = 0;
  let siteCount = 0;
  let siteRangeLen = Infinity;
  for (const fn of functions) {
    const outer = fn.ranges[0];
    if (outer && Math.abs(outer.startOffset - region.fnStart) <= 1 && outer.endOffset >= region.fnEnd - 1) {
      fnCount = Math.max(fnCount, outer.count);
    }
    for (const r of fn.ranges) {
      if (r.startOffset <= region.site && r.endOffset >= region.site) {
        const len = r.endOffset - r.startOffset;
        if (len < siteRangeLen) { siteRangeLen = len; siteCount = r.count; }
      }
    }
  }
  return { fnCount, siteCount };
}

/** Sum the region counts over every NODE_V8_COVERAGE file in `files` for `servedUrl`. */
export function regionCountsFromFiles(files, servedUrl, region) {
  let fnCount = 0;
  let siteCount = 0;
  let scriptSeen = false;
  let unreadable = 0;
  for (const f of files) {
    let json;
    try { json = JSON.parse(readFileSync(f, 'utf8')); } catch { unreadable++; continue; }
    for (const s of json.result || []) {
      if (s.url !== servedUrl) continue;
      scriptSeen = true;
      const c = regionCounts(s.functions, region);
      fnCount += c.fnCount;
      siteCount += c.siteCount;
    }
  }
  return { fnCount, siteCount, scriptSeen, unreadable };
}

/**
 * Locate `function <name>(...)` in a source file by PARSING it - never by line number.
 * Returns byte offsets of the function node and of its body block.
 */
export function locateFunction(source, name) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  for (const node of ast.body) {
    const decl = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
    if (decl && decl.type === 'FunctionDeclaration' && decl.id && decl.id.name === name) {
      return { node: decl, fnStart: decl.start, fnEnd: decl.end, bodyStart: decl.body.start, bodyEnd: decl.body.end };
    }
  }
  return null;
}

export const fileUrl = (p) => pathToFileURL(p).href;
