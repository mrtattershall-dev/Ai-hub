// ═══════════════════════════════════════════════════════
//  INPUT MODULE  –  Keyboard + optional gamepad
// ═══════════════════════════════════════════════════════
const Input = (() => {
  const keys = {};
  const prev = {};

  function init() {
    window.addEventListener('keydown', e => {
      if (!keys[e.code]) {
        keys[e.code] = true;
        handleKeyDown(e.code, e);
      }
    });
    window.addEventListener('keyup', e => {
      keys[e.code] = false;
    });
  }

  function handleKeyDown(code, e) {
    // Always prevent Space from scrolling or clicking focused buttons
    if (code === 'Space') {
      e.preventDefault();
    }
    // Pause toggle — only while racing
    if ((code === 'KeyP' || code === 'Escape') && Game && Game.state === 'racing') {
      e.preventDefault();
      Game.togglePause();
    }
  }

  function update() {
    Object.assign(prev, keys);
  }

  function clear() {
    Object.keys(keys).forEach(k => { keys[k] = false; });
    Object.keys(prev).forEach(k => { prev[k] = false; });
  }

  // Raw key state
  const isDown   = code => !!keys[code];
  const justDown = code => !!keys[code] && !prev[code];

  // ── Semantic inputs ───────────────────────────────────
  const accel  = () => isDown('ArrowUp')    || isDown('KeyW');
  const brake  = () => isDown('ArrowDown')  || isDown('KeyS');
  const left   = () => isDown('ArrowLeft')  || isDown('KeyA');
  const right  = () => isDown('ArrowRight') || isDown('KeyD');
  const boost  = () => isDown('Space') && Game && Game.state === 'racing';
  const pause  = () => justDown('KeyP') || justDown('Escape');

  return { init, update, clear, isDown, justDown, accel, brake, left, right, boost, pause };
})();
