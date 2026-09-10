function _drawJGAnimals(cx, cy, c) {
  const now = Date.now();
  for (const animal of jgAnimals) {
    if (animal.hp <= 0) continue;
    const enc = jgEnclosures.find(e => e.id === animal.enclosureId);
    if (!enc) continue;
    // Only draw if enclosure tile is explored
    if (!exploredJungle[enc.ty * JG_W + enc.tx]) continue;

    const sx = Math.round(animal.x - cx);
    const sy = Math.round(animal.y - cy);
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) continue;
    const W = canvas.width / ZOOM, H = canvas.height / ZOOM;
    if (sx < -JG_T * 2 || sx > W + JG_T * 2 || sy < -JG_T * 2 || sy > H + JG_T * 2) continue;

    const def = JG_ANIMAL_DEFS[animal.type];
    const bob = Math.sin(now * 0.002 + animal.id * 0.7) * 1.5;

    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.beginPath(); c.ellipse(sx, sy + 8, 8, 3, 0, 0, Math.PI * 2); c.fill();

    // Per-type pixel art
    switch (animal.type) {
      case 'jungleParrot': {
        // Bright body
        c.fillStyle = '#e03020'; c.fillRect(sx - 4, sy - 10 + bob, 9, 10); // body
        c.fillStyle = '#20b060'; c.fillRect(sx - 6, sy - 8  + bob, 4, 6);  // wing
        c.fillStyle = '#f0d020'; c.fillRect(sx - 2, sy - 13 + bob, 7, 5);  // head
        c.fillStyle = '#404040'; c.fillRect(sx + 2, sy - 12 + bob, 3, 2);  // beak
        // Tail
        c.fillStyle = '#2060e0'; c.fillRect(sx + 1, sy - 2 + bob, 2, 7);
        break;
      }
      case 'riverTortoise': {
        // Low, wide, deliberate
        c.fillStyle = '#405020'; c.beginPath(); c.ellipse(sx, sy + bob, 11, 8, 0, 0, Math.PI * 2); c.fill(); // shell
        c.fillStyle = '#304010'; c.beginPath(); c.ellipse(sx, sy - 2 + bob, 9, 6, 0, 0, Math.PI * 2); c.fill(); // dome
        // Shell pattern
        c.strokeStyle = '#20280a'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(sx - 5, sy + bob); c.lineTo(sx, sy - 4 + bob); c.lineTo(sx + 5, sy + bob); c.stroke();
        c.beginPath(); c.moveTo(sx - 4, sy + 4 + bob); c.lineTo(sx, sy - 2 + bob); c.lineTo(sx + 4, sy + 4 + bob); c.stroke();
        c.lineWidth = 1;
        // Head poking out
        c.fillStyle = '#506030'; c.fillRect(sx - 2, sy - 10 + bob, 6, 6);
        break;
      }
      case 'forestBoar': {
        // Stocky, low, slightly friendly now
        c.fillStyle = '#704838'; c.beginPath(); c.ellipse(sx, sy + bob, 12, 8, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#604030'; c.beginPath(); c.ellipse(sx + 10, sy - 2 + bob, 6, 5, 0.3, 0, Math.PI * 2); c.fill(); // head
        c.fillStyle = '#503020'; c.fillRect(sx + 13, sy - 4 + bob, 3, 3); // snout
        // Friendly ear twitch
        const earTwitch = Math.sin(now * 0.003 + animal.id) * 2;
        c.fillStyle = '#804848'; c.fillRect(sx + 8, sy - 8 + bob + earTwitch, 4, 4);
        // Spot on flank (domesticated marking)
        c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(sx - 4, sy - 2 + bob, 5, 4);
        break;
      }
      case 'silkMoth': {
        // Delicate, wings flutter
        const flutter = Math.sin(now * 0.006 + animal.id * 0.5);
        const wingSpread = 8 + flutter * 3;
        // Wings
        c.fillStyle = 'rgba(240, 220, 180, 0.85)';
        c.beginPath(); c.ellipse(sx - wingSpread, sy - 3 + bob, wingSpread * 0.7, 6, -0.3, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(sx + wingSpread, sy - 3 + bob, wingSpread * 0.7, 6,  0.3, 0, Math.PI * 2); c.fill();
        // Wing pattern dots
        c.fillStyle = 'rgba(160, 120, 60, 0.7)';
        c.beginPath(); c.arc(sx - wingSpread * 0.5, sy - 3 + bob, 2, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(sx + wingSpread * 0.5, sy - 3 + bob, 2, 0, Math.PI * 2); c.fill();
        // Body
        c.fillStyle = '#806040'; c.fillRect(sx - 2, sy - 6 + bob, 4, 8);
        // Antennae
        c.strokeStyle = '#a08060'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(sx, sy - 6 + bob); c.lineTo(sx - 4, sy - 12 + bob); c.stroke();
        c.beginPath(); c.moveTo(sx, sy - 6 + bob); c.lineTo(sx + 4, sy - 12 + bob); c.stroke();
        c.lineWidth = 1;
        break;
      }
    }

    // Name/status on proximity
    const dist = Math.hypot(player.x - animal.x, player.y - animal.y);
    if (dist < 80) {
      c.fillStyle = 'rgba(10,20,10,.75)';
      c.fillRect(sx - 22, sy - 20 + bob, 44, 9);
      c.fillStyle = animal.fedToday ? '#78c888' : '#e08040';
      c.font = '6px sans-serif'; c.textAlign = 'center';
      c.fillText(def.name + (animal.fedToday ? '' : ' 😟'), sx, sy - 13 + bob);
    }
  }
}