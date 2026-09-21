/**
 * redirect-hooks.mjs - loader hooks: serve a mutant wherever the subject is imported.
 *
 * Registered by preload.mjs with { from, to } as file: URLs. Only an exact match on the
 * resolved URL is redirected, so nothing else in the process is touched.
 */
let FROM = null;
let TO = null;

export async function initialize(data) {
  FROM = data.from;
  TO = data.to;
}

export async function resolve(specifier, context, nextResolve) {
  const r = await nextResolve(specifier, context);
  if (FROM && r.url === FROM) return { ...r, url: TO, shortCircuit: true };
  return r;
}
