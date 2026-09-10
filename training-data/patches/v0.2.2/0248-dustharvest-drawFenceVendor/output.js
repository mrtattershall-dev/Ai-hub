function drawFenceVendor(sx, sy) {
  const bob = Math.sin(Date.now() * 0.0014) * 1.2;

  ctx.save();

  // Shadow
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(sx, sy+10, 8, 3, 0, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  // ── Legs ──
  ctx.fillStyle = '#2a1a08'; // dark leather trousers
  ctx.fillRect(sx-5, sy+4+bob, 4, 9);
  ctx.fillRect(sx+1, sy+4+bob, 4, 9);

  // ── Boots ──
  ctx.fillStyle = '#1a0e04';
  ctx.fillRect(sx-6, sy+12+bob, 5, 3);
  ctx.fillRect(sx+1, sy+12+bob, 5, 3);
  // Boot buckles
  ctx.fillStyle = '#c0a020';
  ctx.fillRect(sx-5, sy+12+bob, 2, 2);
  ctx.fillRect(sx+2, sy+12+bob, 2, 2);

  // ── Poncho / body ── (heavy dark poncho, asymmetric drape)
  ctx.fillStyle = '#3a2210'; // dark brown base
  ctx.fillRect(sx-8, sy-10+bob, 16, 16);
  // Poncho drape — left side hangs lower
  ctx.fillStyle = '#2e1a08';
  ctx.beginPath();
  ctx.moveTo(sx-8, sy-2+bob);
  ctx.lineTo(sx-12, sy+8+bob);
  ctx.lineTo(sx-5, sy+6+bob);
  ctx.closePath(); ctx.fill();
  // Poncho drape — right side
  ctx.beginPath();
  ctx.moveTo(sx+8, sy-2+bob);
  ctx.lineTo(sx+10, sy+6+bob);
  ctx.lineTo(sx+5, sy+5+bob);
  ctx.closePath(); ctx.fill();
  // Poncho collar / neck opening
  ctx.fillStyle = '#4a2c12';
  ctx.fillRect(sx-3, sy-10+bob, 6, 4);
  // Faded stripe detail on poncho (horizontal band)
  ctx.fillStyle = 'rgba(180,120,40,0.28)';
  ctx.fillRect(sx-8, sy-4+bob, 16, 2);

  // ── Neck ──
  ctx.fillStyle = '#c0906a';
  ctx.fillRect(sx-3, sy-16+bob, 6, 7);

  // ── Head ──
  ctx.fillStyle = '#b07848';
  ctx.fillRect(sx-5, sy-24+bob, 10, 10);
  // Jaw shadow / stubble
  ctx.fillStyle = 'rgba(60,30,10,0.45)';
  ctx.fillRect(sx-4, sy-18+bob, 8, 4);
  // Eyes — narrowed, suspicious
  ctx.fillStyle = '#c8a060'; // pale amber eyes
  ctx.fillRect(sx-3, sy-21+bob, 2, 2);
  ctx.fillRect(sx+1, sy-21+bob, 2, 2);
  ctx.fillStyle = '#000';
  ctx.fillRect(sx-2, sy-21+bob, 1, 1); // pupils
  ctx.fillRect(sx+2, sy-21+bob, 1, 1);
  // Brow crease (suspicious squint)
  ctx.fillStyle = 'rgba(40,20,5,0.6)';
  ctx.fillRect(sx-4, sy-23+bob, 3, 1);
  ctx.fillRect(sx+1, sy-23+bob, 3, 1);
  // Nose
  ctx.fillStyle = '#a06838';
  ctx.fillRect(sx-1, sy-19+bob, 2, 3);

  // ── Wide-brim hat — dusty and battered ──
  // Brim
  ctx.fillStyle = '#1e1208';
  ctx.fillRect(sx-10, sy-26+bob, 20, 4);
  // Crown
  ctx.fillStyle = '#281808';
  ctx.fillRect(sx-6, sy-33+bob, 12, 8);
  // Hat dent (crease at top)
  ctx.fillStyle = '#1a1006';
  ctx.fillRect(sx-2, sy-33+bob, 4, 2);
  // Hat band — red/rust colour, faded
  ctx.fillStyle = '#8a2808';
  ctx.fillRect(sx-6, sy-26+bob, 12, 2);
  // A small coin/token tucked in the band
  ctx.fillStyle = '#c0a020';
  ctx.fillRect(sx+3, sy-26+bob, 2, 2);
  // Brim highlight (worn edge)
  ctx.fillStyle = 'rgba(200,160,80,0.18)';
  ctx.fillRect(sx-10, sy-26+bob, 20, 1);

  // ── Arms ── leaning pose: left arm crossed over body, right arm slightly out
  // Left arm (crossed)
  ctx.fillStyle = '#3a2210';
  ctx.fillRect(sx-8, sy-8+bob, 4, 10);
  // Right arm (slightly open, holding satchel)
  ctx.fillRect(sx+4, sy-8+bob, 4, 8);

  // ── Satchel / bag in right hand ──
  ctx.fillStyle = '#5a3818';
  ctx.fillRect(sx+7, sy-2+bob, 7, 8);
  // Bag flap
  ctx.fillStyle = '#4a2c10';
  ctx.fillRect(sx+7, sy-2+bob, 7, 3);
  // Bag clasp
  ctx.fillStyle = '#c0a020';
  ctx.fillRect(sx+9, sy-1+bob, 3, 2);
  // Bag strap
  ctx.fillStyle = '#3a2008';
  ctx.fillRect(sx+4, sy-8+bob, 4, 2);

  // ── Name tag ──
  const label = blTalkSeen.has('who_are_you') ? '🤝 Crane' : '🤝 Stranger';
  const nw = label.length * 4.8 + 10;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(sx - nw/2, sy-40+bob, nw, 12);
  ctx.fillStyle = '#c09050';
  ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, sx, sy-31+bob);

  ctx.restore();
}