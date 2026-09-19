// LEGADOMAIN — DECLARED DOMAIN KNOWLEDGE, as data with authority levels attached.
//
// The first family uses SAVE across two domains, because the surface word tells you almost nothing. Both
// are "persistence"; the obligations barely overlap. If a layer can derive different contracts from the
// same operation name under different declared domains - and derive NO difference where the domain has
// no bearing - it is reasoning about meaning rather than matching a keyword.
//
// EVERY FACT CARRIES ITS AUTHORITY, and the distribution is deliberately uneven:
//
//     DOMAIN_INVARIANT   things that would make the operation WRONG if violated
//     DOMAIN_DEFAULT     what such systems usually do, and which repository evidence may defeat
//     DOMAIN_POLICY      subjective objectives, inert until an owner declares them
//
// Nothing here is allowed to be a "best practice" with no level. A fact whose authority is unstated is a
// fact that cannot be argued with, and this whole layer exists to be arguable.
import { AUTHORITY } from './authority.mjs';

export const DOMAINS = {
  GAME: {
    id: 'GAME',
    operations: {
      SAVE: {
        // Violating these makes the save wrong, not merely unidiomatic.
        invariants: [
          { subject: 'persist:progression', requirement: 'MUST_PERSIST',
            why: 'a save that loses progression has not saved the thing the player owns' },
          { subject: 'persist:world_flags', requirement: 'MUST_PERSIST',
            why: 'world state decides what the restored session is allowed to show' },
          { subject: 'persist:renderer_handles', requirement: 'MUST_NOT_PERSIST',
            why: 'renderer handles are transient and invalid in any later process' },
          { subject: 'persist:frame_cache', requirement: 'MUST_NOT_PERSIST',
            why: 'a frame cache is derived state and restoring it can contradict the world' },
        ],
        defaults: [
          { subject: 'persist:inventory', requirement: 'MUST_PERSIST',
            why: 'inventory is normally player-owned progression' },
        ],
        policies: [
          { subject: 'save:interval', requirement: 'AUTOSAVE_EVERY_5_MIN',
            why: 'a product decision about cadence, not a property of correctness' },
          { subject: 'save:size', requirement: 'MINIMIZE',
            why: 'an optimization objective on some platforms and irrelevant on others' },
        ],
      },
    },
  },

  BUSINESS: {
    id: 'BUSINESS',
    operations: {
      SAVE: {
        invariants: [
          { subject: 'persist:durable_record', requirement: 'MUST_PERSIST',
            why: 'the record is the artifact the system exists to keep' },
          { subject: 'persist:ownership', requirement: 'MUST_PERSIST',
            why: 'a record whose owner is not stored cannot be authorized later' },
          { subject: 'persist:audit_state', requirement: 'MUST_PERSIST',
            why: 'audit-relevant state is legally part of the record' },
          { subject: 'persist:form_ui_state', requirement: 'MUST_NOT_PERSIST',
            why: 'form state is a view concern and is not part of the record' },
          { subject: 'persist:cached_view', requirement: 'MUST_NOT_PERSIST',
            why: 'a cached view is derived and can contradict the record it was built from' },
        ],
        defaults: [],
        policies: [
          { subject: 'save:retention', requirement: 'RETAIN_7_YEARS',
            why: 'a jurisdictional choice, not something a coding layer may assume' },
        ],
      },
    },
  },
};

// Operations where the declared domain has NO bearing. This list is as important as the ones above: a
// layer that changes its answer when the domain changes for an operation the domain does not touch is
// generating domain-flavoured noise.
export const DOMAIN_IRRELEVANT_OPERATIONS = new Set(['CLAMP_NUMERIC_RANGE', 'FORMAT_TIMESTAMP',
  'SORT_ASCENDING']);

export function knowledgeFor(domainId, operation) {
  const d = DOMAINS[domainId];
  if (!d) return { known: false, why: 'domain ' + domainId + ' is not declared to this layer' };
  const op = d.operations[operation];
  if (!op) return { known: false, why: 'domain ' + domainId + ' declares nothing about ' + operation };
  return { known: true, ...op };
}

export const AUTHORITY_OF = {
  invariants: AUTHORITY.DOMAIN_INVARIANT,
  defaults: AUTHORITY.DOMAIN_DEFAULT,
  policies: AUTHORITY.DOMAIN_POLICY,
};
