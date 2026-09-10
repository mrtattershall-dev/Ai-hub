function drawAnimals(cx, cy) {
  // Draw products (pickup items)
  products.forEach(p => {
    const sx = p.x - cx, sy = p.y - cy;
    if (sx < -T*2||sx > canvas.width+T*2||sy < -T*2||sy > canvas.height+T*2) return;
    const bob = Math.sin(Date.now()*.004 + p.id)*3;
    ctx.font = '14px serif'; ctx.textAlign = 'center';
    ctx.fillText(p.icon, sx, sy + bob);
    // Glow ring
    ctx.strokeStyle = 'rgba(240,210,80,.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy+2+bob, 9, 0, Math.PI*2); ctx.stroke();
  });

  // Draw animals
  animals.forEach(a => {
    if (a.hp <= 0) return;
    const sx = a.x - cx, sy = a.y - cy;
    if (sx < -T*2||sx > canvas.width+T*2||sy < -T*2||sy > canvas.height+T*2) return;

    const bob = a.state === 'sleeping' ? 0 : Math.sin(Date.now()*.006 + a.id)*1.5;
    const tint = a.state === 'panic' ? 'rgba(255,60,60,.35)' : null;

    ctx.save();
    ctx.globalAlpha = a.state === 'sleeping' ? 0.7 : 1;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(sx, sy+9, 7, 3, 0, 0, Math.PI*2); ctx.fill();

    // Per-species pixel sprite — no emoji dependency
    const walk = a.state!=='sleeping' ? Math.sin(Date.now()*.009+a.id*1.3)*2 : 0;
    if (a.type === 'chicken') {
      // Body — plump teardrop
      ctx.fillStyle = '#e8c840'; ctx.beginPath();
      ctx.ellipse(sx, sy+bob, 7, 6, 0, 0, Math.PI*2); ctx.fill();
      // Wing shimmer
      ctx.fillStyle = '#c8a820';
      ctx.beginPath(); ctx.ellipse(sx-3, sy+1+bob, 4, 3, -0.4, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#f0d040';
      ctx.beginPath(); ctx.arc(sx+5, sy-6+bob, 5, 0, Math.PI*2); ctx.fill();
      // Beak
      ctx.fillStyle = '#e86020';
      ctx.beginPath(); ctx.moveTo(sx+10, sy-6+bob); ctx.lineTo(sx+13, sy-4+bob); ctx.lineTo(sx+10, sy-3+bob); ctx.fill();
      // Wattle
      ctx.fillStyle = '#e03030';
      ctx.beginPath(); ctx.arc(sx+9, sy-3+bob, 2, 0, Math.PI*2); ctx.fill();
      // Eye
      ctx.fillStyle = '#181010';
      ctx.beginPath(); ctx.arc(sx+7, sy-7+bob, 1.2, 0, Math.PI*2); ctx.fill();
      // Comb
      ctx.fillStyle = '#e03030';
      ctx.fillRect(sx+4, sy-12+bob, 2, 4); ctx.fillRect(sx+7, sy-11+bob, 2, 3);
      // Legs
      ctx.strokeStyle = '#e86020'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx-2, sy+6+bob); ctx.lineTo(sx-3, sy+11+bob+walk); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx+2, sy+6+bob); ctx.lineTo(sx+3, sy+11+bob-walk); ctx.stroke();

    } else if (a.type === 'sheep') {
      // Fluffy wool body — multiple overlapping circles
      ctx.fillStyle = '#e8e8e8';
      ctx.beginPath(); ctx.arc(sx,    sy+bob,   8, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx-5,  sy-1+bob, 6, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx+5,  sy-1+bob, 6, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx,    sy-5+bob, 6, 0, Math.PI*2); ctx.fill();
      // Inner fluff highlight
      ctx.fillStyle = '#f4f4f4';
      ctx.beginPath(); ctx.arc(sx, sy-2+bob, 5, 0, Math.PI*2); ctx.fill();
      // Dark face / head
      ctx.fillStyle = '#504848';
      ctx.beginPath(); ctx.ellipse(sx+8, sy-4+bob, 5, 6, 0.3, 0, Math.PI*2); ctx.fill();
      // Eyes
      ctx.fillStyle = '#f0e060';
      ctx.beginPath(); ctx.arc(sx+10, sy-5+bob, 1.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#100808';
      ctx.beginPath(); ctx.arc(sx+10, sy-5+bob, 0.7, 0, Math.PI*2); ctx.fill();
      // Nose
      ctx.fillStyle = '#e06060';
      ctx.beginPath(); ctx.arc(sx+13, sy-2+bob, 1.2, 0, Math.PI*2); ctx.fill();
      // Ear
      ctx.fillStyle = '#e08080';
      ctx.beginPath(); ctx.ellipse(sx+7, sy-9+bob, 2, 3, 0.5, 0, Math.PI*2); ctx.fill();
      // Legs
      ctx.fillStyle = '#504848';
      ctx.fillRect(sx-6, sy+7+bob, 3, 6+walk); ctx.fillRect(sx-1, sy+7+bob, 3, 6-walk);
      ctx.fillRect(sx+4, sy+7+bob, 3, 6+walk);

    } else if (a.type === 'cow') {
      // Big body
      ctx.fillStyle = '#e8dcc0';
      ctx.beginPath(); ctx.ellipse(sx, sy+bob, 13, 9, 0, 0, Math.PI*2); ctx.fill();
      // Brown patches
      ctx.fillStyle = '#7a4820';
      ctx.beginPath(); ctx.ellipse(sx-4, sy-2+bob, 5, 4, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx+6, sy+2+bob, 4, 3, 0.4, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#e8dcc0';
      ctx.beginPath(); ctx.ellipse(sx+14, sy-2+bob, 7, 6, 0.2, 0, Math.PI*2); ctx.fill();
      // Snout
      ctx.fillStyle = '#d4a080';
      ctx.beginPath(); ctx.ellipse(sx+19, sy-1+bob, 4, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#c06060';
      ctx.beginPath(); ctx.arc(sx+18, sy+bob, 1, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx+21, sy+bob, 1, 0, Math.PI*2); ctx.fill();
      // Eye
      ctx.fillStyle = '#281808';
      ctx.beginPath(); ctx.arc(sx+16, sy-5+bob, 2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx+16.5, sy-5.5+bob, 0.7, 0, Math.PI*2); ctx.fill();
      // Horns
      ctx.strokeStyle = '#c0a040'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx+14, sy-8+bob); ctx.quadraticCurveTo(sx+12, sy-14+bob, sx+10, sy-12+bob); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx+17, sy-8+bob); ctx.quadraticCurveTo(sx+19, sy-14+bob, sx+21, sy-12+bob); ctx.stroke();
      // Ear
      ctx.fillStyle = '#d4a080';
      ctx.beginPath(); ctx.ellipse(sx+11, sy-7+bob, 2, 4, -0.5, 0, Math.PI*2); ctx.fill();
      // Udder
      ctx.fillStyle = '#e8a0a0';
      ctx.beginPath(); ctx.ellipse(sx+2, sy+10+bob, 5, 3, 0, 0, Math.PI*2); ctx.fill();
      // Tail
      ctx.strokeStyle = '#c0a040'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx-13, sy-2+bob); ctx.quadraticCurveTo(sx-18, sy+4+bob, sx-16, sy+10+bob); ctx.stroke();
      // Legs
      ctx.fillStyle = '#c8b890';
      const cl = walk*0.8;
      ctx.fillRect(sx-8, sy+8+bob, 4, 9+cl); ctx.fillRect(sx-1, sy+8+bob, 4, 9-cl);
      ctx.fillRect(sx+6, sy+8+bob, 4, 9+cl);
      // Hooves
      ctx.fillStyle = '#504030';
      ctx.fillRect(sx-8, sy+17+bob+cl, 4, 3); ctx.fillRect(sx-1, sy+17+bob-cl, 4, 3);
      ctx.fillRect(sx+6, sy+17+bob+cl, 4, 3);

    } else if (a.type === 'pig') {
      // Plump pink body
      ctx.fillStyle = '#f0a8a0';
      ctx.beginPath(); ctx.ellipse(sx, sy+bob, 11, 8, 0, 0, Math.PI*2); ctx.fill();
      // Belly highlight
      ctx.fillStyle = '#f8c8c0';
      ctx.beginPath(); ctx.ellipse(sx, sy+2+bob, 6, 4, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#f0a8a0';
      ctx.beginPath(); ctx.ellipse(sx+13, sy-1+bob, 7, 6, 0.1, 0, Math.PI*2); ctx.fill();
      // Snout
      ctx.fillStyle = '#e08080';
      ctx.beginPath(); ctx.ellipse(sx+19, sy+1+bob, 4, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#c05050';
      ctx.beginPath(); ctx.arc(sx+18, sy+1+bob, 1, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx+21, sy+1+bob, 1, 0, Math.PI*2); ctx.fill();
      // Eye
      ctx.fillStyle = '#201010';
      ctx.beginPath(); ctx.arc(sx+15, sy-4+bob, 1.8, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx+15.5, sy-4.5+bob, 0.6, 0, Math.PI*2); ctx.fill();
      // Ear (floppy)
      ctx.fillStyle = '#e89090';
      ctx.beginPath(); ctx.ellipse(sx+12, sy-7+bob, 3, 4, -0.4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx+17, sy-7+bob, 3, 4, 0.4, 0, Math.PI*2); ctx.fill();
      // Curly tail
      ctx.strokeStyle = '#e08080'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx-12, sy-2+bob, 3, 0, Math.PI*1.5); ctx.stroke();
      // Legs
      ctx.fillStyle = '#e09090';
      ctx.fillRect(sx-7, sy+7+bob, 4, 6+walk); ctx.fillRect(sx-1, sy+7+bob, 4, 6-walk);
      ctx.fillRect(sx+5, sy+7+bob, 4, 6+walk);

    } else if (a.type === 'rabbit') {
      // Small compact body
      ctx.fillStyle = '#e0d8c8';
      ctx.beginPath(); ctx.ellipse(sx, sy+2+bob, 7, 6, 0, 0, Math.PI*2); ctx.fill();
      // White belly
      ctx.fillStyle = '#f8f4ec';
      ctx.beginPath(); ctx.ellipse(sx, sy+3+bob, 4, 3.5, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#e0d8c8';
      ctx.beginPath(); ctx.arc(sx+6, sy-3+bob, 5, 0, Math.PI*2); ctx.fill();
      // Long ears
      ctx.fillStyle = '#d4c8b0';
      ctx.beginPath(); ctx.ellipse(sx+4, sy-12+bob, 2, 7, -0.2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx+8, sy-11+bob, 2, 7, 0.2, 0, Math.PI*2); ctx.fill();
      // Inner ear pink
      ctx.fillStyle = '#e89090';
      ctx.beginPath(); ctx.ellipse(sx+4, sy-12+bob, 1, 5, -0.2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx+8, sy-11+bob, 1, 5, 0.2, 0, Math.PI*2); ctx.fill();
      // Nose
      ctx.fillStyle = '#e06060';
      ctx.beginPath(); ctx.arc(sx+11, sy-3+bob, 1.2, 0, Math.PI*2); ctx.fill();
      // Eye
      ctx.fillStyle = '#e03060';
      ctx.beginPath(); ctx.arc(sx+8, sy-5+bob, 1.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx+8.5, sy-5.5+bob, 0.5, 0, Math.PI*2); ctx.fill();
      // Fluffy tail
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx-7, sy+1+bob, 3, 0, Math.PI*2); ctx.fill();
      // Legs (tiny)
      ctx.fillStyle = '#d4c8b0';
      ctx.fillRect(sx-4, sy+6+bob, 3, 5+walk); ctx.fillRect(sx+1, sy+6+bob, 3, 5-walk);

    } else if (a.type === 'goat') {
      // Lean body
      ctx.fillStyle = '#c8c0a0';
      ctx.beginPath(); ctx.ellipse(sx, sy+bob, 10, 7, 0, 0, Math.PI*2); ctx.fill();
      // Back marking
      ctx.fillStyle = '#a09070';
      ctx.beginPath(); ctx.ellipse(sx-3, sy-1+bob, 5, 3, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#c8c0a0';
      ctx.beginPath(); ctx.ellipse(sx+12, sy-2+bob, 6, 5, 0.15, 0, Math.PI*2); ctx.fill();
      // Snout (elongated)
      ctx.fillStyle = '#b8a888';
      ctx.beginPath(); ctx.ellipse(sx+18, sy+bob, 3, 2.5, 0, 0, Math.PI*2); ctx.fill();
      // Beard
      ctx.fillStyle = '#a09070';
      ctx.beginPath(); ctx.ellipse(sx+17, sy+4+bob, 2, 3, 0, 0, Math.PI*2); ctx.fill();
      // Horns
      ctx.strokeStyle = '#806040'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx+11, sy-7+bob); ctx.quadraticCurveTo(sx+9, sy-13+bob, sx+7, sy-10+bob); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx+14, sy-7+bob); ctx.quadraticCurveTo(sx+16, sy-13+bob, sx+18, sy-10+bob); ctx.stroke();
      // Ear (wide)
      ctx.fillStyle = '#d4b8a0';
      ctx.beginPath(); ctx.ellipse(sx+9, sy-6+bob, 2.5, 4, -0.6, 0, Math.PI*2); ctx.fill();
      // Eye
      ctx.fillStyle = '#302010';
      ctx.beginPath(); ctx.arc(sx+14, sy-4+bob, 1.8, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#e0c060';
      ctx.beginPath(); ctx.arc(sx+14, sy-4+bob, 0.8, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#100808';
      ctx.beginPath(); ctx.arc(sx+14, sy-4+bob, 0.4, 0, Math.PI*2); ctx.fill();
      // Legs
      ctx.fillStyle = '#a8a080';
      ctx.fillRect(sx-6, sy+7+bob, 3, 8+walk); ctx.fillRect(sx-1, sy+7+bob, 3, 8-walk);
      ctx.fillRect(sx+4, sy+7+bob, 3, 8+walk);
      ctx.fillStyle = '#504030';
      ctx.fillRect(sx-6, sy+15+bob+walk, 3, 2); ctx.fillRect(sx-1, sy+15+bob-walk, 3, 2);
      ctx.fillRect(sx+4, sy+15+bob+walk, 3, 2);

    } else if (a.type === 'horse') {
      // Large muscular body
      ctx.fillStyle = '#8b5a2b';
      ctx.beginPath(); ctx.ellipse(sx, sy+bob, 16, 10, 0, 0, Math.PI*2); ctx.fill();
      // Belly lighter
      ctx.fillStyle = '#a06830';
      ctx.beginPath(); ctx.ellipse(sx, sy+3+bob, 9, 5, 0, 0, Math.PI*2); ctx.fill();
      // Neck
      ctx.fillStyle = '#8b5a2b';
      ctx.beginPath(); ctx.ellipse(sx+14, sy-5+bob, 6, 8, 0.5, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.beginPath(); ctx.ellipse(sx+20, sy-8+bob, 5, 8, 0.3, 0, Math.PI*2); ctx.fill();
      // Snout
      ctx.fillStyle = '#704818';
      ctx.beginPath(); ctx.ellipse(sx+23, sy-3+bob, 3, 4, 0.1, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#c08060';
      ctx.beginPath(); ctx.arc(sx+22, sy-2+bob, 1, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx+25, sy-2+bob, 1, 0, Math.PI*2); ctx.fill();
      // Eye
      ctx.fillStyle = '#201008';
      ctx.beginPath(); ctx.arc(sx+21, sy-10+bob, 2.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx+21.7, sy-10.7+bob, 0.7, 0, Math.PI*2); ctx.fill();
      // Ear
      ctx.fillStyle = '#7a4820';
      ctx.beginPath(); ctx.ellipse(sx+17, sy-14+bob, 2, 4, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx+21, sy-14+bob, 2, 4, 0.3, 0, Math.PI*2); ctx.fill();
      // Mane (flowing)
      ctx.fillStyle = '#3a2010';
      ctx.beginPath();
      ctx.moveTo(sx+13, sy-12+bob);
      ctx.quadraticCurveTo(sx+8, sy-8+bob, sx+10, sy-2+bob);
      ctx.quadraticCurveTo(sx+6, sy-6+bob, sx+8, sy+2+bob);
      ctx.quadraticCurveTo(sx+4, sy-4+bob, sx+6, sy+4+bob);
      ctx.lineWidth=3; ctx.strokeStyle='#3a2010'; ctx.stroke();
      // Tail
      ctx.beginPath();
      ctx.moveTo(sx-16, sy-2+bob);
      ctx.quadraticCurveTo(sx-22, sy+4+bob, sx-18, sy+12+bob);
      ctx.quadraticCurveTo(sx-24, sy+8+bob, sx-20, sy+16+bob);
      ctx.lineWidth=3; ctx.stroke();
      // Legs (powerful)
      ctx.fillStyle = '#7a4820';
      const hl = walk * 1.2;
      ctx.fillRect(sx-10, sy+9+bob, 5, 11+hl); ctx.fillRect(sx-3, sy+9+bob, 5, 11-hl);
      ctx.fillRect(sx+5, sy+9+bob, 5, 11+hl);
      // Hooves
      ctx.fillStyle = '#201008';
      ctx.fillRect(sx-10, sy+20+bob+hl, 5, 3); ctx.fillRect(sx-3, sy+20+bob-hl, 5, 3);
      ctx.fillRect(sx+5, sy+20+bob+hl, 5, 3);
    }
    // Panic tint overlay
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(sx-14, sy-16+bob, 28, 28); }

    // Health dot
    const hpPct = a.hp / a.maxHp;
    ctx.fillStyle = hpPct > 0.6 ? '#40e040' : hpPct > 0.3 ? '#e0c040' : '#e04020';
    ctx.beginPath(); ctx.arc(sx+8, sy-16+bob, 3, 0, Math.PI*2); ctx.fill();

    // Mood icon (small, above health dot)
    const mood = getAnimalMood(a);
    if (settings.showMoodIcons && mood.score !== 2) { // only show if not neutral
      ctx.font = '8px serif'; ctx.textAlign = 'center';
      ctx.globalAlpha = 0.85;
      ctx.fillText(mood.icon, sx+8, sy-20+bob);
      ctx.globalAlpha = 1;
    }

    // Product ready indicator
    if (a.productReady) {
      const pulse = 0.7 + Math.sin(Date.now()*.005+a.id)*0.3;
      ctx.globalAlpha = pulse;
      ctx.font = '11px serif'; ctx.fillText(ANIMAL_DEFS[a.type].productIcon, sx, sy-22+bob);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  });

  // Draw pen HP bars (only when under attack or damaged)
  pens.forEach(pen => {
    if (pen.hp >= pen.maxHp) return;
    const sx = (pen.x + pen.w/2)*T - cx;
    const sy = pen.y*T - cy - 8;
    const w = pen.w*T - 8;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(sx - w/2, sy, w, 5);
    ctx.fillStyle = pen.hp/pen.maxHp > 0.5 ? '#60d040' : '#e04020';
    ctx.fillRect(sx - w/2, sy, w*(pen.hp/pen.maxHp), 5);
    // Fix 5: Show broken fence visual — draw X marks on fence tiles when hp == 0
    if (pen.hp <= 0) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#e04020';
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      // Top and bottom fence rows
      for (let dx = 0; dx < pen.w; dx++) {
        const fx = (pen.x+dx)*T + T/2 - cx;
        const fy1 = pen.y*T + T/2 - cy;
        const fy2 = (pen.y+pen.h-1)*T + T/2 - cy;
        ctx.fillText('✕', fx, fy1+4);
        ctx.fillText('✕', fx, fy2+4);
      }
      // Left and right fence cols
      for (let dy = 1; dy < pen.h-1; dy++) {
        const fx1 = pen.x*T + T/2 - cx;
        const fx2 = (pen.x+pen.w-1)*T + T/2 - cx;
        const fy = (pen.y+dy)*T + T/2 - cy;
        ctx.fillText('✕', fx1, fy+4);
        ctx.fillText('✕', fx2, fy+4);
      }
      // Repair prompt label
      const lsx = (pen.x + pen.w/2)*T - cx;
      const lsy = pen.y*T - cy - 16;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#e07040'; ctx.font = '8px sans-serif';
      ctx.fillText('BROKEN — [E] gate to repair ($15 stone/wood)', lsx, lsy);
      ctx.restore();
    }
  });

  // Draw per-pen trough fill bars when player is nearby
  for (const pen of pens) {
    const { tx: ptx3, ty: pty3 } = getPenTroughPos(pen);
    const troughWorldX = ptx3*T + T/2, troughWorldY = pty3*T;
    const distToTrough = Math.hypot(player.x - troughWorldX, player.y - (pty3*T+T/2));
    if (distToTrough < 112) {
      const troughSx = troughWorldX - cx, troughSy = troughWorldY - cy;
      const tw = T * 2;
      const pct = (pen.troughFill || 0) / PEN_TROUGH_MAX;
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(troughSx - tw/2, troughSy - 10, tw, 5);
      ctx.fillStyle = pct < 0.3 ? '#e0a020' : pct < 0.6 ? '#d4c040' : '#60c040';
      ctx.fillRect(troughSx - tw/2, troughSy - 10, tw * pct, 5);
      ctx.fillStyle = '#d4b870'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`Feed: ${Math.round(pen.troughFill||0)}%`, troughSx, troughSy - 13);
    }
  }

  // Ghost pen overlay in placement mode
  if (ranchPlacementMode) {
    const size = PEN_SIZES[ranchPlacementType];
    const { w, h } = size;
    const gtx = Math.floor(_mouseWorld.x / T);
    const gty = Math.floor(_mouseWorld.y / T);
    const gsx = gtx * T - cx;
    const gsy = gty * T - cy;
    const pw = w * T, ph = h * T;

    // Validity check for tint
    const inZone = gtx >= 1 && gtx+w <= 33 && gty >= 36 && gty+h <= 70;
    const overlaps = pens.some(p => gtx < p.x+p.w && gtx+w > p.x && gty < p.y+p.h && gty+h > p.y);
    const valid = inZone && !overlaps;

    ctx.save();
    ctx.globalAlpha = 0.55;
    // Fill interior
    ctx.fillStyle = valid ? 'rgba(80,200,80,.18)' : 'rgba(200,60,60,.18)';
    ctx.fillRect(gsx + T, gsy + T, pw - 2*T, ph - 2*T);
    // Fence outline
    ctx.strokeStyle = valid ? '#60e060' : '#e06060';
    ctx.lineWidth = 2;
    ctx.setLineDash([4,3]);
    ctx.strokeRect(gsx + 0.5, gsy + 0.5, pw - 1, ph - 1);
    ctx.setLineDash([]);
    // Animal icon hint
    const icons = ANIMAL_ICONS;
    ctx.globalAlpha = 0.8;
    ctx.font = '18px serif'; ctx.textAlign = 'center';
    ctx.fillText(icons[ranchPlacementType], gsx + pw/2, gsy + ph/2 + 6);
    // Label
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = valid ? '#80f080' : '#f08080';
    ctx.globalAlpha = 1;
    ctx.fillText(valid ? `PLACE ${ranchPlacementType.toUpperCase()} PEN` : 'INVALID — Ranch zone only', gsx + pw/2, gsy - 4);
    ctx.restore();
  }

  // Sprinkler placement ghost — shows 4-tile coverage when sprinkler tool active
  if (player.tool === 'sprinkler' && countItem('sprinkler') > 0 && !gameState.inBadlands && !gameState.inMine) {
    const gtx = Math.floor(_mouseWorld.x / T);
    const gty = Math.floor(_mouseWorld.y / T);
    const _spT = getT(gtx, gty);
    const valid = isFarmTile(gtx, gty) && _spT !== TL.SPRINKLER
      && (_spT === TL.DIRT || _spT === TL.FARM_TILLED || _spT === TL.FARM_WATERED)
      && !(plots[plotKey(gtx,gty)]&&plots[plotKey(gtx,gty)].crop);
    ctx.save();
    // Highlight the 4 adjacent plots that will be watered
    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const nx = gtx+dx, ny = gty+dy;
      if (!isFarmTile(nx, ny)) continue;
      const nsx = nx*T - cx, nsy = ny*T - cy;
      ctx.fillStyle = valid ? 'rgba(96,192,240,0.22)' : 'rgba(200,60,60,0.15)';
      ctx.fillRect(nsx, nsy, T, T);
    }
    // Outline the sprinkler tile itself
    const gsx = gtx*T - cx, gsy = gty*T - cy;
    ctx.strokeStyle = valid ? '#60c0f0' : '#e06060';
    ctx.lineWidth = 2;
    ctx.setLineDash([3,3]);
    ctx.strokeRect(gsx+1, gsy+1, T-2, T-2);
    ctx.setLineDash([]);
    ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = valid ? '#80e0ff' : '#f08080';
    ctx.fillText(valid ? '🚿 PLACE' : 'INVALID', gsx+T/2, gsy-4);
    ctx.restore();
  }
}