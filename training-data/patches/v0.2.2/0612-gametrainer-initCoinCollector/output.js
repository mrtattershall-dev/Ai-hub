function initCoinCollector() {
  const s = {
    player: { x: canvas.width/2, y: canvas.height/2, r: 14 },
    coins: [],
    score: 0,
    won: false
  };
  for (let i = 0; i < 8; i++) {
    s.coins.push({
      x: 60 + Math.random()*(canvas.width-120),
      y: 60 + Math.random()*(canvas.height-120),
      r: 9, collected: false
    });
  }
  return s;
}