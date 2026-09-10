function initPlatformer() {
  const platforms = [
    { x: 60, y: canvas.height*0.7, w: 120, h: 12 },
    { x: 230, y: canvas.height*0.55, w: 110, h: 12 },
    { x: 400, y: canvas.height*0.4, w: 120, h: 12 }
  ];
  return {
    player: { x: 80, y: canvas.height*0.7 - 30, w: 22, h: 30, vx:0, vy:0, onGround: false },
    platforms, platformsTouched: new Set(), won: false
  };
}