// THE TESTING ENTRY POINT. No production module imports this file.
//
// Resolver injection is a trusted-runtime-author capability, not a production call-surface option:
// a caller who can supply the function that DECIDES continuity can replace the check entirely. So
// `replayMerged` pins the contained resolver, and every injection goes through here.
//
// STATED LIMIT: in JavaScript a bypass that exists is callable by anyone who imports it. This
// separates the capability from ordinary use; it does not make it unreachable.
import { replayMergedWithResolver } from './merge.mjs';

/** Replay a merged set with an explicitly supplied continuity resolver. Tests only. */
export function replayMergedForTests(merged, opts, continuityResolver) {
  if (typeof continuityResolver !== 'function') {
    throw new Error('replayMergedForTests requires an explicit resolver; use replayMerged instead');
  }
  return replayMergedWithResolver(merged, opts, continuityResolver);
}
