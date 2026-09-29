function initBouncingBall() {
  return {
    balls: Array.from({length: 5}, (_, i) => ({
      x: 80 + i * 120, y: 60 + Math.random()*100,
      vx: (Math.random()-0.5)*4+1.5,
      vy: (Math.random()-0.5)*4+2,
      r: 14 + i*4,
      color: ['#7c6bff','#38d9c0','#f5a623','#3dd68c','#ff5a5a'][i]
    })),
    frameCount: 0
  };
}