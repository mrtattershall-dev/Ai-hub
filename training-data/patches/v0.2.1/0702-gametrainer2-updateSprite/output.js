function updateSprite(s, keys) {
  const GRAV=0.5, FPS_MAP={idle:6,run:10,jump:4,fall:5};
  // Physics
  s.vy += GRAV;
  if (keys[' ']||keys['ArrowUp']||keys['w']||keys['W']) {
    if (s.onGround) { s.vy=-10; s.onGround=false; }
  }
  if (keys['ArrowLeft']||keys['a']||keys['A']) { s.vx=-3.5; }
  else if (keys['ArrowRight']||keys['d']||keys['D']) { s.vx=3.5; }
  else s.vx *= 0.7;
  s.x += s.vx; s.y += s.vy;
  const floor = canvas.height - 70;
  s.onGround = false;
  if (s.y > floor) { s.y=floor; s.vy=0; s.onGround=true; }
  s.x = Math.max(20, Math.min(canvas.width-20, s.x));
  // State machine
  const prev = s.state;
  if (!s.onGround && s.vy < 0) s.state = 'jump';
  else if (!s.onGround && s.vy > 0) s.state = 'fall';
  else if (Math.abs(s.vx) > 0.5) s.state = 'run';
  else s.state = 'idle';
  if (s.state !== prev) { s.frame=0; s.elapsed=0; }
  s.statesSeen.add(s.state);
  // Frame advance
  const fps = FPS_MAP[s.state];
  s.elapsed++;
  if (s.elapsed > 60/fps) {
    const total = {idle:4,run:6,jump:3,fall:3}[s.state];
    s.frame = (s.frame+1) % total;
    s.elapsed=0;
  }
  if (s.statesSeen.size >= 4 && !s.won) s.won=true;
}