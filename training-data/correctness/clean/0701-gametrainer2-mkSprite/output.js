function mkSprite() {
  // We'll draw pixel-art frames procedurally — no image needed
  const STATES = ['idle','run','jump','fall'];
  const frameData = {
    idle:  { frames:4, color:'#e8a832' },
    run:   { frames:6, color:'#5ecf7a' },
    jump:  { frames:3, color:'#5a9ee0' },
    fall:  { frames:3, color:'#e05a4a' }
  };
  return {
    x:100, y:0, vx:0, vy:0, onGround:false,
    state:'idle', frame:0, elapsed:0,
    statesSeen: new Set(['idle']),
    FPS:10, won:false,
    get stateInfo() { return frameData[this.state]; }
  };
}