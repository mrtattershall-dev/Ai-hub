function pollGamepad() {
  if (_gamepadDead) return;
  const pads = navigator.getGamepads();
  const pad = pads[0];
  if (!pad) return;

  /* Standard gamepad layout mapping */
  const axes = pad.axes;
  const btns = pad.buttons;

  /* D-pad via axes (deadzone ±0.5) or digital buttons */
  const DEAD = 0.5;
  _applyGPBtn('LEFT',   (axes[0] < -DEAD) || (btns[14] && btns[14].pressed));
  _applyGPBtn('RIGHT',  (axes[0] >  DEAD) || (btns[15] && btns[15].pressed));
  _applyGPBtn('UP',     (axes[1] < -DEAD) || (btns[12] && btns[12].pressed));
  _applyGPBtn('DOWN',   (axes[1] >  DEAD) || (btns[13] && btns[13].pressed));

  /* Face buttons: A=Cross(0), B=Circle(1), Start=Options(9), Select=Share(8) */
  _applyGPBtn('A',      btns[0] && btns[0].pressed);
  _applyGPBtn('B',      btns[1] && btns[1].pressed);
  _applyGPBtn('START',  btns[9] && btns[9].pressed);
  _applyGPBtn('SELECT', btns[8] && btns[8].pressed);
}