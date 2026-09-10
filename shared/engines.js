/**
 * engines.js - the single source of truth for Game-tab engines.
 *
 * Lives outside client/ and server/ because BOTH need it: the client builds the
 * iframe preview from it, the server builds the Chromium verification page from it.
 * They were duplicated with a "keep in sync" comment, which meant adding an engine
 * required editing two files - and forgetting the second made the verifier silently
 * check the code against the wrong library.
 */
export const ENGINES = {
  phaser: {
    label: 'Phaser',
    cdn: 'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js',
    global: 'Phaser',
  },
  pixi: {
    label: 'PixiJS',
    cdn: 'https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js',
    global: 'PIXI',
  },
  three: {
    label: 'Three.js',
    cdn: 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.min.js',
    global: 'THREE',
  },
};

export const ENGINE_IDS = Object.keys(ENGINES);
export const engineOr = (id) => ENGINES[id] || ENGINES.phaser;

// The <head> both sides share: engine script + the page chrome a game expects.
export function engineHead(id) {
  const e = engineOr(id);
  return '<meta charset="utf-8">\n'
    + '<style>html,body{margin:0;height:100%;background:#0c0d11;overflow:hidden}'
    + 'canvas{display:block;margin:0 auto}</style>\n'
    + '<script src="' + e.cdn + '"><\/script>';
}
