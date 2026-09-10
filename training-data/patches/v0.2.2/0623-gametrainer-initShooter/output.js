function initShooter() {
  const enemies = [];
  for (let i = 0; i < 6; i++) {
    enemies.push({ x: 60 + i*(Math.floor(canvas.width/6)), y:60 + (i%2)*60, w:34, h:28, alive:true, hit:0 });
  }
  return { player:{ x:canvas.width/2, y:canvas.height-50, w:28, h:20 }, bullets:[], enemies, killed:0, cooldown:0, won:false };
}