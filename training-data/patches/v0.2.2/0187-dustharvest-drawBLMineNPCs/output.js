function drawBLMineNPCs(cx, cy) {
  const fl = gameState.blMineFloor;
  for (const npc of BL_MINE_NPCS) {
    if (npc.floor !== fl) continue;
    if (!isBLMineExplored(fl, npc.tx, npc.ty)) continue;
    const sx = npc.tx*T+T/2 - cx, sy = npc.ty*T+T/2 - cy;
    if (sx<-60||sx>canvas.width/ZOOM+60||sy<-60||sy>canvas.height/ZOOM+60) continue;
    ctx.save();
    const bob = Math.sin(Date.now()*0.0009 + npc.tx*0.3) * 0.5;
    const OL = '#101010';

    // Shadow
    ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(sx, sy+10, 9, 3, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    if (npc.id === 'briggs') {
      // BRIGGS — survey assistant. Seated against the wall, knees up.
      // Gaunt, still. Survey vest over worn shirt. Headlamp (off).
      // He's been here 3 years. His clothes are intact but wrong somehow.

      // Legs — drawn up, knees at chest level
      ctx.fillStyle = '#2a3040'; // dark survey trousers
      ctx.fillRect(sx-6, sy+2+bob, 5, 12);
      ctx.fillRect(sx+1, sy+2+bob, 5, 12);
      // Boots
      ctx.fillStyle = OL;
      ctx.fillRect(sx-7, sy+12+bob, 6, 4);
      ctx.fillRect(sx+1, sy+12+bob, 6, 4);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(sx-6, sy+12+bob, 5, 3);
      ctx.fillRect(sx+2, sy+12+bob, 4, 3);

      // Body — survey vest over shirt
      ctx.fillStyle = '#4a5060'; // grey-green survey shirt
      ctx.fillRect(sx-7, sy-12+bob, 14, 16);
      // Vest (darker, structured)
      ctx.fillStyle = '#303840';
      ctx.fillRect(sx-6, sy-12+bob, 5, 14);
      ctx.fillRect(sx+1, sy-12+bob, 5, 14);
      // Vest pocket
      ctx.fillStyle = '#283030';
      ctx.fillRect(sx-5, sy-8+bob, 3, 4);
      // Arms — resting on knees
      ctx.fillStyle = '#4a5060';
      ctx.fillRect(sx-10, sy-4+bob, 4, 8);
      ctx.fillRect(sx+6, sy-4+bob, 4, 8);
      // Hands on knees
      ctx.fillStyle = '#b08060';
      ctx.fillRect(sx-9, sy+4+bob, 4, 3);
      ctx.fillRect(sx+5, sy+4+bob, 4, 3);

      // Neck
      ctx.fillStyle = '#a87858';
      ctx.fillRect(sx-2, sy-16+bob, 4, 5);

      // Head — gaunt, hollowed
      ctx.fillStyle = OL; ctx.fillRect(sx-5, sy-26+bob, 10, 11);
      ctx.fillStyle = '#9a7050'; // pallid — 3 years underground
      ctx.fillRect(sx-4, sy-25+bob, 8, 9);
      ctx.fillStyle = '#aa8060';
      ctx.fillRect(sx-4, sy-25+bob, 8, 2); // forehead highlight
      // Hollow cheeks — shadow
      ctx.fillStyle = 'rgba(30,15,5,.45)';
      ctx.fillRect(sx-4, sy-21+bob, 2, 4);
      ctx.fillRect(sx+2, sy-21+bob, 2, 4);
      // Eyes — clear but fixed. He's listening.
      ctx.fillStyle = '#708090';
      ctx.fillRect(sx-3, sy-22+bob, 2, 2);
      ctx.fillRect(sx+1, sy-22+bob, 2, 2);
      ctx.fillStyle = '#000';
      ctx.fillRect(sx-2, sy-22+bob, 1, 1);
      ctx.fillRect(sx+2, sy-22+bob, 1, 1);
      // Stubble — three years' worth
      ctx.fillStyle = 'rgba(60,40,20,.5)';
      ctx.fillRect(sx-4, sy-18+bob, 8, 3);
      // Nose
      ctx.fillStyle = '#906040';
      ctx.fillRect(sx-1, sy-20+bob, 2, 3);

      // Survey helmet — dented, scuffed. Headlamp OFF.
      ctx.fillStyle = '#606870'; // grey-green survey helmet
      ctx.fillRect(sx-5, sy-30+bob, 10, 5);
      ctx.fillRect(sx-4, sy-33+bob, 8, 4);
      ctx.fillStyle = '#505860';
      ctx.fillRect(sx+1, sy-32+bob, 3, 3); // dent
      // Headlamp — dead
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(sx-2, sy-31+bob, 4, 3);
      ctx.fillStyle = 'rgba(80,70,50,.2)'; // faint — almost nothing
      ctx.fillRect(sx-1, sy-30+bob, 2, 2);

      // Survey notebook — in lap
      ctx.fillStyle = '#6a5030';
      ctx.fillRect(sx-4, sy+4+bob, 8, 6);
      ctx.fillStyle = '#8a7050';
      ctx.fillRect(sx-3, sy+5+bob, 6, 1);
      ctx.fillRect(sx-3, sy+7+bob, 6, 1);

    } else {
      // ELSBETH — Silas's partner. Cross-legged on the floor, facing partly away.
      // Still. Completely at ease. Her clothes are worn but she's maintained them.
      // She chose to be here. It shows.

      // Legs — cross-legged on floor
      ctx.fillStyle = '#4a3828'; // worn canvas
      ctx.fillRect(sx-8, sy+4+bob, 16, 6);
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(sx-8, sy+4+bob, 16, 2);
      // Boots visible at sides
      ctx.fillStyle = '#281808';
      ctx.fillRect(sx-10, sy+6+bob, 4, 4);
      ctx.fillRect(sx+6, sy+6+bob, 4, 4);

      // Body — practical miner's shirt, kept clean
      ctx.fillStyle = '#3a4a58'; // slate blue-grey
      ctx.fillRect(sx-6, sy-12+bob, 12, 18);
      ctx.fillStyle = '#4a5a68';
      ctx.fillRect(sx-6, sy-12+bob, 12, 2); // shoulder
      // Arms resting in lap, relaxed
      ctx.fillStyle = '#3a4a58';
      ctx.fillRect(sx-9, sy-6+bob, 4, 12);
      ctx.fillRect(sx+5, sy-6+bob, 4, 12);
      // Hands — folded
      ctx.fillStyle = '#b89070';
      ctx.fillRect(sx-4, sy+4+bob, 8, 3);

      // Neck
      ctx.fillStyle = '#b89070';
      ctx.fillRect(sx-2, sy-16+bob, 4, 5);

      // Head — calm, upright. Not broken. Decided.
      ctx.fillStyle = OL; ctx.fillRect(sx-5, sy-27+bob, 10, 12);
      ctx.fillStyle = '#c8a080';
      ctx.fillRect(sx-4, sy-26+bob, 8, 10);
      ctx.fillStyle = '#d8b090';
      ctx.fillRect(sx-4, sy-26+bob, 8, 2);
      // Eyes — open, level. She's not staring at nothing.
      ctx.fillStyle = '#607080';
      ctx.fillRect(sx-3, sy-22+bob, 2, 2);
      ctx.fillRect(sx+1, sy-22+bob, 2, 2);
      ctx.fillStyle = '#000';
      ctx.fillRect(sx-2, sy-22+bob, 1, 1);
      ctx.fillRect(sx+2, sy-22+bob, 1, 1);
      // Highlight — catches lantern light differently than Briggs
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      ctx.fillRect(sx-1, sy-23+bob, 1, 1);
      ctx.fillRect(sx+3, sy-23+bob, 1, 1);
      // Nose
      ctx.fillStyle = '#a87848';
      ctx.fillRect(sx-1, sy-20+bob, 2, 3);
      // Hair — dark, tied back loosely
      ctx.fillStyle = OL; ctx.fillRect(sx-5, sy-30+bob, 10, 5);
      ctx.fillStyle = '#1a1008';
      ctx.fillRect(sx-4, sy-29+bob, 8, 4);
      ctx.fillStyle = '#2a1810';
      ctx.fillRect(sx-4, sy-29+bob, 5, 2);
      // Small lantern on ground beside her — lit, warm
      ctx.fillStyle = '#5a4020';
      ctx.fillRect(sx+8, sy+2+bob, 6, 8);
      ctx.fillStyle = '#3a2810';
      ctx.fillRect(sx+8, sy+2+bob, 6, 2);
      // Lantern glow — soft
      const lg = 0.15 + Math.sin(Date.now()*0.0018)*0.05;
      ctx.fillStyle = `rgba(255,200,80,${lg})`;
      ctx.beginPath(); ctx.ellipse(sx+11, sy+6+bob, 10, 7, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f0c040';
      ctx.fillRect(sx+10, sy+4+bob, 2, 2); // flame core
    }

    // Name + role nametag
    const tagLabel = npc.id === 'briggs' ? 'Briggs · Survey Asst.' : 'Elsbeth · Miner';
    const nw = tagLabel.length * 4.5 + 10;
    ctx.fillStyle = 'rgba(0,0,0,.75)';
    ctx.fillRect(sx - nw/2, sy-42+bob, nw, 12);
    ctx.fillStyle = npc.id === 'briggs' ? '#8090a0' : '#a09070';
    ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(tagLabel, sx, sy-33+bob);

    // Proximity prompt
    const dist = Math.hypot(player.x-(npc.tx*T+T/2), player.y-(npc.ty*T+T/2));
    if (dist < T*3) {
      const pulse = 0.65 + Math.sin(Date.now()*.006)*0.35;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#c0a860'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('[E] ' + npc.name, sx, sy-48+bob);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}