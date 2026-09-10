function drawMinerNPC(cx, cy) {
  const sx = MINER_X - cx, sy = MINER_Y - cy;
  if (sx < -T*2 || sx > canvas.width+T*2 || sy < -T*2 || sy > canvas.height+T*2) return;
  const bob = Math.sin(Date.now() * 0.0011) * 0.8; // barely bobs — old and still

  ctx.save();

  // Shadow
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(sx, sy+10, 9, 3, 0, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  // ── Crate seat ──
  ctx.fillStyle = '#5a3a18'; ctx.fillRect(sx-8, sy+6+bob, 16, 8);
  ctx.fillStyle = '#4a2c10'; ctx.fillRect(sx-8, sy+6+bob, 16, 2);
  ctx.strokeStyle = '#3a2008'; ctx.lineWidth = 1;
  ctx.strokeRect(sx-8, sy+6+bob, 16, 8);

  // ── Legs ──
  ctx.fillStyle = '#3a2c1a'; // worn canvas trousers
  ctx.fillRect(sx-5, sy+4+bob, 4, 10);
  ctx.fillRect(sx+1, sy+4+bob, 4, 10);

  // ── Heavy boots ──
  ctx.fillStyle = '#281808';
  ctx.fillRect(sx-6, sy+12+bob, 5, 4);
  ctx.fillRect(sx+1, sy+12+bob, 5, 4);

  // ── Body — canvas shirt, suspenders ──
  ctx.fillStyle = '#7a6040'; // faded tan shirt
  ctx.fillRect(sx-7, sy-10+bob, 14, 16);
  // Suspenders
  ctx.fillStyle = '#4a2808';
  ctx.fillRect(sx-3, sy-10+bob, 2, 14);
  ctx.fillRect(sx+1, sy-10+bob, 2, 14);
  // Shirt pocket
  ctx.fillStyle = '#6a5030';
  ctx.fillRect(sx-6, sy-6+bob, 5, 4);

  // ── Arms — resting on pickaxe shaft ──
  ctx.fillStyle = '#7a6040';
  ctx.fillRect(sx-10, sy-6+bob, 4, 10); // left arm
  ctx.fillRect(sx+6,  sy-6+bob, 4, 10); // right arm

  // ── Pickaxe across knees ──
  ctx.fillStyle = '#5a3818'; // wood handle
  ctx.fillRect(sx-14, sy+2+bob, 28, 3);
  ctx.fillStyle = '#708090'; // iron head
  ctx.fillRect(sx-14, sy+bob, 6, 5);
  ctx.fillRect(sx+8,  sy+bob, 4, 5);

  // ── Neck ──
  ctx.fillStyle = '#b88050';
  ctx.fillRect(sx-3, sy-16+bob, 6, 7);

  // ── Head — weathered, older ──
  ctx.fillStyle = '#a07040';
  ctx.fillRect(sx-5, sy-24+bob, 10, 10);
  // Deep-set wrinkles
  ctx.fillStyle = 'rgba(50,25,5,0.4)';
  ctx.fillRect(sx-4, sy-20+bob, 8, 1); // under-eye
  ctx.fillRect(sx-3, sy-17+bob, 6, 1); // jaw line
  // Eyes — tired, steady
  ctx.fillStyle = '#8090a0'; // pale grey eyes
  ctx.fillRect(sx-3, sy-21+bob, 2, 2);
  ctx.fillRect(sx+1, sy-21+bob, 2, 2);
  ctx.fillStyle = '#000';
  ctx.fillRect(sx-2, sy-21+bob, 1, 1);
  ctx.fillRect(sx+2, sy-21+bob, 1, 1);
  // Grey stubble
  ctx.fillStyle = 'rgba(180,160,140,0.35)';
  ctx.fillRect(sx-4, sy-18+bob, 8, 3);
  // Nose
  ctx.fillStyle = '#906030';
  ctx.fillRect(sx-1, sy-19+bob, 2, 3);

  // ── Miner's helmet — dented, worn ──
  ctx.fillStyle = '#c09020'; // battered yellow
  ctx.fillRect(sx-6, sy-28+bob, 12, 6);
  ctx.fillRect(sx-4, sy-32+bob, 8, 5);
  // Dent
  ctx.fillStyle = '#a07010';
  ctx.fillRect(sx+2, sy-31+bob, 3, 3);
  // Headlamp (dark — off duty)
  ctx.fillStyle = '#303030';
  ctx.fillRect(sx-2, sy-30+bob, 4, 3);
  ctx.fillStyle = 'rgba(220,200,100,0.15)';
  ctx.fillRect(sx-1, sy-29+bob, 2, 2);

  // ── Name tag ──
  const metSilas = minerTalkSeen.has('who_are_you');
  const label = metSilas ? '⛏ Silas' : '⛏ Old Miner';
  const nw = label.length * 4.8 + 10;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(sx - nw/2, sy-40+bob, nw, 12);
  ctx.fillStyle = '#c0a050';
  ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, sx, sy-31+bob);

  // Proximity prompt
  if (Math.hypot(player.x - MINER_X, player.y - MINER_Y) < MINER_INTERACT_RADIUS) {
    const pulse = 0.65 + Math.sin(Date.now()*.006)*0.35;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#f0d060'; ctx.font = '7px sans-serif';
    ctx.fillText('[E] Talk', sx, sy-48+bob);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}