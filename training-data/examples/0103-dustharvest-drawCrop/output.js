function drawCrop(plot,sx,sy,tx,ty) {
  if (!plot||!plot.tilled||!plot.crop) return;
  const cd=CROPS[plot.crop];
  const g=plot.growthProgress;
  const stage=Math.min(3,Math.floor(g*4));
  const wob=Math.sin(Date.now()*.002+tx+ty)*1.2;
  const t=Date.now();
  const seasonTier = getCropSeasonTier(plot.crop);

  // Helper: pixel block relative to tile
  function px(dx,dy,w,h,color,alpha) {
    if(alpha!==undefined) ctx.globalAlpha=alpha;
    ctx.fillStyle=color;
    ctx.fillRect(sx+dx,sy+dy,w,h);
    if(alpha!==undefined) ctx.globalAlpha=1;
  }

  if(plot.wilted) {
    // Wilted — drooping grey stem + bent head
    px(15,16,2,10,'#5a4a2a');
    px(11,15,4,2,'#6a5a3a',0.6);
    px(17,15,4,2,'#6a5a3a',0.6);
    px(12,13,3,3,'#7a6a4a',0.5);
    ctx.globalAlpha=1;
    return;
  }

  // ─────────────── PER-CROP PIXEL ART ───────────────
  const c=plot.crop;

  if(c==='carrot') {
    // Stage 0: tiny green tufts
    if(stage===0) {
      px(14,20,4,2,'#2a6a1a'); px(13,19,2,2,'#3a8a22'); px(17,19,2,2,'#3a8a22');
    } else if(stage===1) {
      // Stem + small feathery top
      px(15,18,2,8,'#2a6a1a');
      px(12,16,4,2,'#3a9a22'); px(16,15,4,2,'#3a9a22');
      px(14,14,2,2,'#4ab032');
    } else if(stage===2) {
      // Taller feathery green top, hint of orange below soil
      px(15,12,2,14,'#2a6a1a');
      px(11,10,4,2,'#3a9a22'); px(17,10,4,2,'#3a9a22');
      px(13,8,6,3,'#4ab032'); px(14,7,4,2,'#5ac842');
      px(14,24,4,4,'#d0601a',0.5); // carrot peek
    } else {
      // Full: bright orange carrot visible, lush top
      px(15,8,2,14,'#2a7a1a');
      px(10,6,5,2,'#3aaa22'); px(17,6,5,2,'#3aaa22');
      px(12,4,8,3,'#4ab832'); px(14,3,4,2,'#5ad042');
      // Orange carrot body
      px(13,20,6,6,'#e07030'); px(14,26,4,2,'#e07030'); px(15,28,2,2,'#c05020');
      // Harvest shimmer
      const glow=0.4+Math.sin(t*.004)*.25;
      ctx.strokeStyle=`rgba(240,180,60,${glow})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(sx+16,sy+16,12,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='corn') {
    if(stage===0) {
      px(15,20,2,8,'#4a8820'); px(13,19,2,2,'#5aa830'); px(17,19,2,2,'#5aa830');
    } else if(stage===1) {
      px(15,14,2,12,'#3a7018'); px(12,16,4,2,'#4a8a20'); px(17,15,4,2,'#4a8a20');
      px(13,13,4,2,'#5a9a28');
    } else if(stage===2) {
      // Tall stalk, wide leaves
      px(15,8,2,18,'#3a7018');
      px(10,12,5,2,'#4a8a20'); px(17,12,5,2,'#4a8a20');
      px(9,16,6,2,'#5a9a28'); px(17,16,6,2,'#5a9a28');
      px(14,7,4,4,'#6ab030'); // top tassel
    } else {
      // Full corn: cob visible
      px(15,4,2,20,'#3a7018');
      px(9,8,6,2,'#4a9022'); px(17,8,6,2,'#4a9022');
      px(8,14,7,2,'#5aa028'); px(17,14,7,2,'#5aa028');
      // Corn cob
      px(12,10,8,14,'#d0b020'); px(13,9,6,2,'#c0a010');
      px(12,10,2,2,'#c8a818'); px(14,10,2,2,'#d8bc28'); px(16,10,2,2,'#c8a818');
      px(12,12,2,2,'#d8bc28'); px(14,12,2,2,'#c8a818'); px(16,12,2,2,'#d8bc28');
      px(12,14,2,2,'#c8a818'); px(14,14,2,2,'#d8bc28'); px(16,14,2,2,'#c8a818');
      px(12,16,2,2,'#d8bc28'); px(14,16,2,2,'#c8a818'); px(16,16,2,2,'#d8bc28');
      px(13,23,6,1,'#b89010'); // husk tip
      const glow=0.4+Math.sin(t*.004)*.25;
      ctx.strokeStyle=`rgba(240,200,40,${glow})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(sx+16,sy+16,13,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='pumpkin') {
    if(stage===0) {
      px(14,22,4,4,'#5a9020'); px(13,21,2,2,'#4a8018'); px(17,21,2,2,'#4a8018');
    } else if(stage===1) {
      px(15,17,2,8,'#3a7018');
      px(11,20,5,2,'#4a8820'); px(16,19,5,2,'#4a8820');
      px(13,14,6,4,'#e06818',0.7);
    } else if(stage===2) {
      px(15,14,2,12,'#3a7018');
      px(10,17,5,2,'#4a8820'); px(17,17,5,2,'#4a8820');
      // Small pumpkin
      px(11,10,10,8,'#d05c14'); px(12,9,8,2,'#d07020'); px(13,8,6,2,'#c86418');
      px(15,7,2,2,'#5a9020'); // stem
    } else {
      // Big pumpkin
      px(15,5,2,5,'#3a7018'); // vine
      px(8,13,16,10,'#d06018'); px(9,11,14,3,'#d87020'); px(10,10,12,2,'#cc6818');
      // Ribs
      px(11,11,2,11,'#b85010'); px(15,10,2,13,'#b85010'); px(19,11,2,11,'#b85010');
      px(12,21,8,2,'#b85010'); // bottom
      px(14,6,4,5,'#2a6010'); // stem
      const glow=0.4+Math.sin(t*.004)*.25;
      ctx.strokeStyle=`rgba(220,150,40,${glow})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(sx+16,sy+16,13,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='glowroot') {
    // Bioluminescent root — purple glow
    if(stage===0) {
      px(14,22,4,4,'#5a3a80'); px(13,21,2,2,'#7a50a0',0.8); px(17,21,2,2,'#7a50a0',0.8);
    } else if(stage===1) {
      px(15,16,2,10,'#4a2a70');
      px(11,18,4,2,'#6a40a0'); px(17,18,4,2,'#6a40a0');
      px(14,14,4,3,'#8a60b0',0.7);
    } else if(stage===2) {
      px(15,10,2,14,'#4a2a70');
      px(10,14,5,2,'#6a40a0'); px(17,14,5,2,'#6a40a0');
      px(13,9,6,3,'#8a60b0'); px(14,8,4,2,'#a070c0');
      // Glowing root peek
      px(13,22,6,4,'#7040c0',0.6);
      const gA=0.2+Math.sin(t*.003+tx)*.15;
      ctx.save(); ctx.globalAlpha=gA; ctx.fillStyle='#c090ff';
      ctx.beginPath(); ctx.arc(sx+16,sy+24,5,0,Math.PI*2); ctx.fill(); ctx.restore();
    } else {
      px(15,6,2,14,'#4a2a70');
      px(9,10,6,2,'#7a4ab0'); px(17,10,6,2,'#7a4ab0');
      px(11,7,4,4,'#9060c0'); px(17,7,4,4,'#9060c0');
      px(13,5,6,3,'#b080d0'); px(14,4,4,2,'#c090e0');
      // Glowing underground root
      px(12,20,8,8,'#6040c0'); px(13,19,6,2,'#7050d0');
      px(14,18,4,2,'#8060e0');
      const gA=0.35+Math.sin(t*.003)*.2;
      ctx.save(); ctx.globalAlpha=gA; ctx.fillStyle='#d0a0ff';
      ctx.beginPath(); ctx.arc(sx+16,sy+24,7,0,Math.PI*2); ctx.fill(); ctx.restore();
      const glow=0.5+Math.sin(t*.004)*.3;
      ctx.strokeStyle=`rgba(180,100,255,${glow})`; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(sx+16,sy+16,12,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='tomato') {
    if(stage===0) {
      px(15,20,2,8,'#3a7a20'); px(13,19,2,2,'#4a9028'); px(17,19,2,2,'#4a9028');
    } else if(stage===1) {
      px(15,15,2,11,'#3a7020');
      px(11,18,4,2,'#4a8a28'); px(17,17,4,2,'#4a8a28');
      px(14,13,4,3,'#d04040',0.6);
    } else if(stage===2) {
      px(15,10,2,14,'#3a7020');
      px(10,13,5,2,'#4a8a28'); px(17,13,5,2,'#4a8a28');
      px(13,9,6,4,'#c03030',0.8);
      px(14,8,4,2,'#5a9a30');
    } else {
      px(15,6,2,14,'#3a7a20');
      px(9,10,6,2,'#4a9028'); px(17,10,6,2,'#4a9028');
      // Ripe tomato cluster
      px(10,8,12,12,'#d03020'); px(11,7,10,2,'#c83028'); px(13,6,6,2,'#e04030');
      px(14,5,4,2,'#4a9028'); // calyx
      px(12,8,2,2,'#e85040'); px(18,8,2,2,'#e85040'); // highlight
      const glow=0.4+Math.sin(t*.004)*.25;
      ctx.strokeStyle=`rgba(240,80,60,${glow})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(sx+16,sy+14,10,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='dustwheat') {
    if(stage===0) {
      px(15,20,2,8,'#8a7830'); px(13,19,2,2,'#9a8838'); px(17,19,2,2,'#9a8838');
    } else if(stage===1) {
      px(14,14,2,12,'#7a6828'); px(16,15,2,11,'#7a6828');
      px(12,16,2,2,'#9a8838'); px(18,15,2,2,'#9a8838');
    } else if(stage===2) {
      // Multiple stalks
      px(13,10,2,16,'#8a7830'); px(16,9,2,17,'#7a6828'); px(19,11,2,15,'#8a7830');
      px(11,14,2,2,'#a09040'); px(15,13,2,2,'#a09040'); px(21,15,2,2,'#a09040');
      // Small heads
      px(12,8,4,3,'#c0a840'); px(15,7,4,3,'#c0a840'); px(18,9,4,3,'#c0a840');
    } else {
      // Full wheat field look
      px(11,6,2,20,'#8a7830'); px(14,5,2,21,'#7a6828'); px(17,6,2,20,'#8a7830'); px(20,7,2,19,'#9a7830');
      // Wheat heads drooping
      px(10,4,4,4,'#d0b040'); px(13,3,4,4,'#c8a838'); px(16,4,4,4,'#d0b040'); px(19,5,4,4,'#c8a838');
      px(9,6,2,2,'#e0c050'); px(12,5,2,2,'#e0c050'); px(15,6,2,2,'#e0c050'); px(18,7,2,2,'#e0c050');
      const glow=0.4+Math.sin(t*.004)*.25;
      ctx.strokeStyle=`rgba(220,190,60,${glow})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(sx+16,sy+14,13,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='sunblossom') {
    if(stage===0) {
      px(15,20,2,8,'#3a7820'); px(13,19,2,2,'#4a9028'); px(17,19,2,2,'#4a9028');
    } else if(stage===1) {
      px(15,14,2,12,'#3a7820');
      px(12,16,4,2,'#4a9028'); px(17,15,4,2,'#4a9028');
      // Tiny flower bud
      px(14,12,4,3,'#d0c020',0.7);
    } else if(stage===2) {
      px(15,8,2,16,'#3a7820');
      px(10,13,5,2,'#4a9028'); px(17,13,5,2,'#4a9028');
      // Opening flower
      px(12,5,8,8,'#e0c820'); px(14,4,4,2,'#f0d830'); // petals
      px(10,7,4,2,'#e8c820'); px(18,7,4,2,'#e8c820');
      px(13,3,6,2,'#e0c820');
      px(13,6,6,6,'#8a4010'); // center
    } else {
      px(15,4,2,20,'#3a7820');
      px(8,12,6,2,'#4a9028'); px(18,11,6,2,'#4a9028');
      // Full sunflower head
      // Petals (8 directions)
      px(13,1,6,4,'#f0d020'); px(13,9,6,4,'#f0d020'); // top/bottom petals
      px(7,4,4,6,'#f0d020');  px(21,4,4,6,'#f0d020');  // side petals
      px(8,2,4,4,'#e8c820');  px(20,2,4,4,'#e8c820');   // diagonal
      px(8,8,4,4,'#e8c820');  px(20,8,4,4,'#e8c820');
      // Center disc
      px(11,4,10,8,'#6a3208'); px(12,3,8,2,'#7a3e10'); px(12,11,8,2,'#7a3e10');
      // Center seeds
      px(12,5,2,2,'#3a1a04'); px(15,5,2,2,'#3a1a04'); px(18,5,2,2,'#3a1a04');
      px(13,7,2,2,'#3a1a04'); px(16,7,2,2,'#3a1a04');
      px(12,9,2,2,'#3a1a04'); px(15,9,2,2,'#3a1a04'); px(18,9,2,2,'#3a1a04');
      const glow=0.45+Math.sin(t*.004)*.28;
      ctx.strokeStyle=`rgba(255,220,40,${glow})`; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(sx+16,sy+7,11,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='pepper') {
    if(stage===0) {
      px(15,20,2,8,'#2a6a18'); px(13,19,2,2,'#3a8020'); px(17,19,2,2,'#3a8020');
    } else if(stage===1) {
      px(15,15,2,11,'#2a6a18');
      px(12,18,3,2,'#3a8020'); px(17,17,3,2,'#3a8020');
      px(14,13,4,3,'#c82020',0.6);
    } else if(stage===2) {
      px(15,10,2,14,'#2a6a18');
      px(10,14,4,2,'#3a8020'); px(18,13,4,2,'#3a8020');
      // 2 peppers
      px(12,8,4,8,'#d02010'); px(16,9,4,8,'#d02010');
      px(13,7,2,2,'#2a6a18'); px(17,8,2,2,'#2a6a18'); // stems
    } else {
      px(15,5,2,14,'#2a7a18');
      px(8,10,6,2,'#3a8820'); px(18,9,6,2,'#3a8820');
      // Multiple ripe red peppers
      px(10,6,5,10,'#e02010'); px(17,5,5,10,'#e02010');
      px(14,8,4,8,'#d81a08');
      px(11,5,2,2,'#2a7a18'); px(18,4,2,2,'#2a7a18'); px(15,7,2,2,'#2a7a18');
      px(11,6,2,2,'#f04030'); px(18,5,2,2,'#f04030'); // highlights
      const glow=0.4+Math.sin(t*.004)*.25;
      ctx.strokeStyle=`rgba(240,60,40,${glow})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(sx+16,sy+14,11,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='melon') {
    if(stage===0) {
      px(14,22,4,4,'#3a8020'); px(13,21,2,2,'#2a6a18'); px(17,21,2,2,'#2a6a18');
    } else if(stage===1) {
      px(15,17,2,8,'#3a8020');
      px(11,20,4,2,'#2a6a18'); px(17,19,4,2,'#2a6a18');
      px(12,14,8,6,'#5a9830',0.7);
    } else if(stage===2) {
      px(15,14,2,10,'#3a8020');
      px(10,17,4,2,'#2a6a18'); px(18,16,4,2,'#2a6a18');
      // Small melon
      px(10,9,12,10,'#60a030'); px(11,8,10,2,'#70b038');
      px(10,12,2,4,'#4a8820'); px(20,12,2,4,'#4a8820'); // stripes
    } else {
      // Big melon on the vine
      px(14,4,2,6,'#3a8020'); // curly vine
      px(6,12,20,14,'#60a030'); px(7,10,18,3,'#70b038'); px(8,9,16,2,'#80c040');
      // Stripes
      px(8,12,2,12,'#4a8820'); px(12,11,2,14,'#4a8820'); px(16,11,2,14,'#4a8820'); px(20,12,2,12,'#4a8820');
      px(24,12,2,12,'#4a8820');
      const glow=0.4+Math.sin(t*.004)*.25;
      ctx.strokeStyle=`rgba(120,200,60,${glow})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(sx+16,sy+18,13,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='potato') {
    if(stage===0) {
      px(14,20,4,4,'#6a8a28'); px(13,19,2,2,'#5a7a20'); px(17,19,2,2,'#5a7a20');
    } else if(stage===1) {
      px(15,15,2,10,'#5a7a20');
      px(11,18,4,2,'#6a8a28'); px(17,17,4,2,'#6a8a28');
      px(13,13,4,3,'#7a9a30',0.7);
    } else if(stage===2) {
      px(15,10,2,14,'#5a7a20');
      px(10,13,4,2,'#6a8a28'); px(18,13,4,2,'#6a8a28');
      px(12,8,8,5,'#7a9a30');
      // Underground hints
      px(11,22,10,6,'#c09040',0.5);
    } else {
      px(15,6,2,14,'#5a8020');
      px(9,10,5,2,'#6a9028'); px(18,9,5,2,'#6a9028');
      px(11,7,10,5,'#7aaa30'); px(13,5,6,3,'#8ab838');
      // Potato clump underground
      px(9,20,6,6,'#c09040'); px(17,21,6,5,'#b88838'); px(12,23,8,4,'#c8a050');
      px(10,22,2,2,'#a07830'); px(19,22,2,2,'#a07830'); // eyes
      const glow=0.4+Math.sin(t*.004)*.25;
      ctx.strokeStyle=`rgba(200,160,60,${glow})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(sx+16,sy+16,13,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='lavender') {
    if(stage===0) {
      px(15,20,2,8,'#5a7040'); px(13,19,2,2,'#6a8050'); px(17,19,2,2,'#6a8050');
    } else if(stage===1) {
      px(14,14,2,12,'#5a7040'); px(16,15,2,11,'#5a7040');
      px(12,16,2,2,'#6a8050'); px(18,15,2,2,'#6a8050');
      px(13,12,2,3,'#9070c0',0.6); px(17,11,2,3,'#9070c0',0.6);
    } else if(stage===2) {
      // Multiple stems
      px(12,8,2,18,'#5a7040'); px(15,7,2,19,'#5a7040'); px(18,9,2,17,'#5a7040');
      px(10,14,2,2,'#6a8050'); px(16,12,2,2,'#6a8050'); px(20,15,2,2,'#6a8050');
      // Spike tops
      px(11,5,4,5,'#9060c0'); px(14,4,4,5,'#9878c8'); px(17,6,4,5,'#9060c0');
    } else {
      // Full lavender bush
      px(10,6,2,20,'#5a7040'); px(13,4,2,22,'#5a7040'); px(16,5,2,21,'#5a7040'); px(19,7,2,19,'#5a7040');
      px(8,12,2,2,'#6a8050'); px(14,11,2,2,'#6a8050'); px(20,13,2,2,'#6a8050');
      // Purple flower spikes
      px(9,3,4,6,'#9060c0'); px(12,2,4,5,'#a870d0'); px(15,2,4,6,'#9060c0'); px(18,4,4,5,'#a870d0');
      px(8,6,2,2,'#c090e0'); px(12,4,2,2,'#c090e0'); px(16,4,2,2,'#c090e0'); px(20,7,2,2,'#c090e0');
      const glow=0.35+Math.sin(t*.003)*.2;
      ctx.strokeStyle=`rgba(180,100,240,${glow})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(sx+16,sy+12,13,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='cactusFruit') {
    if(stage===0) {
      px(14,18,4,10,'#3a8830'); px(13,18,2,2,'#2a6820'); px(17,18,2,2,'#2a6820');
      // Tiny spines
      px(12,20,2,1,'#d0c0a0'); px(18,20,2,1,'#d0c0a0');
    } else if(stage===1) {
      // Short stubby cactus
      px(13,12,6,14,'#3a8830');
      px(11,14,2,6,'#3a8830'); px(19,15,2,5,'#3a8830'); // arms nubs
      // Spines
      px(11,13,2,1,'#c8b890'); px(11,17,2,1,'#c8b890');
      px(19,14,2,1,'#c8b890'); px(19,18,2,1,'#c8b890');
      px(13,11,2,1,'#c8b890'); px(17,11,2,1,'#c8b890');
    } else if(stage===2) {
      // Taller, arms growing
      px(13,8,6,18,'#3a8830');
      px(8,12,5,4,'#3a8830'); px(19,14,5,4,'#3a8830');
      // Spine dots
      px(11,10,2,1,'#c8b890'); px(11,14,2,1,'#c8b890'); px(11,18,2,1,'#c8b890');
      px(19,12,2,1,'#c8b890'); px(19,16,2,1,'#c8b890'); px(19,20,2,1,'#c8b890');
      px(13,7,2,1,'#c8b890'); px(17,7,2,1,'#c8b890');
      // Tiny red fruit buds
      px(12,7,2,2,'#cc2020',0.7); px(18,7,2,2,'#cc2020',0.7);
    } else {
      // Full cactus with fruit
      px(13,5,6,22,'#3a9030');
      px(6,10,7,4,'#3a9030'); px(19,12,7,4,'#3a9030');
      // Spines
      for(let i=0;i<5;i++){px(11,6+i*4,2,1,'#c8b890'); px(19,8+i*4,2,1,'#c8b890'); px(13,4+i*4,2,1,'#c8b890'); px(17,4+i*4,2,1,'#c8b890');}
      px(5,10,2,1,'#c8b890'); px(5,13,2,1,'#c8b890'); px(20,12,2,1,'#c8b890'); px(20,15,2,1,'#c8b890');
      // Red cactus fruit
      px(11,5,4,4,'#e02020'); px(17,5,4,4,'#e02020');
      px(12,4,2,2,'#f03030'); px(18,4,2,2,'#f03030');
      const glow=0.4+Math.sin(t*.004)*.25;
      ctx.strokeStyle=`rgba(220,80,40,${glow})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(sx+16,sy+14,13,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='blueberry') {
    if(stage===0) {
      px(14,22,4,4,'#3a6828'); px(13,21,2,2,'#2a5820'); px(17,21,2,2,'#2a5820');
    } else if(stage===1) {
      // Low bush sprout
      px(13,18,6,8,'#3a6828');
      px(11,20,2,2,'#2a5820'); px(19,20,2,2,'#2a5820');
      px(14,16,4,3,'#4a7a30',0.7);
    } else if(stage===2) {
      // Bush with leaves
      px(10,14,12,10,'#3a6828'); px(9,15,14,7,'#4a7a30');
      px(8,17,3,2,'#3a6828'); px(21,17,3,2,'#3a6828');
      // Small unripe berries
      px(11,13,3,3,'#5050a0',0.6); px(15,12,3,3,'#5050a0',0.6); px(19,13,3,3,'#5050a0',0.6);
    } else {
      // Full bush with ripe blueberries
      px(8,14,16,12,'#3a7030'); px(7,16,18,8,'#4a8038');
      px(6,18,3,2,'#3a6828'); px(23,18,3,2,'#3a6828');
      // Berry clusters
      px(9,12,4,4,'#3040c0'); px(14,11,4,4,'#3040c0'); px(19,12,4,4,'#3040c0');
      px(11,10,4,4,'#4050d0'); px(16,10,4,4,'#4050d0');
      // Berry highlights
      px(10,12,1,1,'#8090e0'); px(15,11,1,1,'#8090e0'); px(20,12,1,1,'#8090e0');
      px(12,10,1,1,'#8090e0'); px(17,10,1,1,'#8090e0');
      const glow=0.4+Math.sin(t*.004)*.25;
      ctx.strokeStyle=`rgba(80,80,220,${glow})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(sx+16,sy+14,13,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='garlic') {
    if(stage===0) {
      px(14,22,4,4,'#7a9a40'); px(13,21,2,2,'#6a8a38'); px(17,21,2,2,'#6a8a38');
    } else if(stage===1) {
      px(14,14,2,12,'#7a9a40'); px(17,15,2,11,'#7a9a40');
      px(12,17,2,2,'#8aaa48'); px(19,16,2,2,'#8aaa48');
    } else if(stage===2) {
      px(13,8,2,16,'#7a9a40'); px(16,7,2,17,'#7a9a40'); px(19,10,2,14,'#7a9a40');
      px(11,13,2,2,'#8aaa48'); px(17,11,2,2,'#8aaa48'); px(21,15,2,2,'#8aaa48');
      px(12,6,3,4,'#9aba50'); px(15,5,3,4,'#9aba50'); px(18,8,3,4,'#9aba50');
    } else {
      // Full garlic — white bulb visible
      px(12,5,2,18,'#8aaa40'); px(15,4,2,19,'#7a9a38'); px(18,6,2,17,'#8aaa40');
      px(10,11,2,2,'#9aba48'); px(16,9,2,2,'#9aba48'); px(20,13,2,2,'#9aba48');
      // Bulb
      px(10,22,12,6,'#dcd8c0'); px(11,21,10,2,'#e8e4cc'); px(12,20,8,2,'#f0ecd8');
      // Clove divisions
      px(15,22,1,5,'#c0bc98'); px(12,23,1,4,'#c0bc98'); px(18,23,1,4,'#c0bc98');
      const glow=0.4+Math.sin(t*.004)*.25;
      ctx.strokeStyle=`rgba(200,200,140,${glow})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(sx+16,sy+24,8,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='strawberry') {
    if(stage===0) {
      px(14,22,4,4,'#3a7828'); px(13,21,2,2,'#2a6820'); px(17,21,2,2,'#2a6820');
    } else if(stage===1) {
      px(13,17,6,9,'#3a7828');
      px(11,20,2,2,'#2a6820'); px(19,20,2,2,'#2a6820');
      px(14,15,4,3,'#4a8830',0.7);
    } else if(stage===2) {
      // Low leafy plant
      px(9,15,14,9,'#3a7828'); px(8,17,16,6,'#4a8830');
      // Small unripe berries
      px(11,13,4,5,'#d05050',0.6); px(17,12,4,5,'#d05050',0.6);
      px(12,12,2,2,'#3a7828'); px(18,11,2,2,'#3a7828'); // crowns
    } else {
      px(8,14,16,10,'#3a8030'); px(7,16,18,7,'#4a9038');
      // Ripe strawberries
      px(10,10,5,7,'#e03050'); px(17,9,5,7,'#e03050'); px(13,8,5,6,'#d82848');
      // Hearts/seeds
      px(11,12,1,1,'#f8e0a0'); px(13,13,1,1,'#f8e0a0'); px(15,11,1,1,'#f8e0a0');
      px(18,11,1,1,'#f8e0a0'); px(20,12,1,1,'#f8e0a0');
      px(14,9,1,1,'#f8e0a0'); px(16,10,1,1,'#f8e0a0');
      // Crowns
      px(11,9,2,2,'#3a8030'); px(18,8,2,2,'#3a8030'); px(14,7,2,2,'#3a8030');
      const glow=0.4+Math.sin(t*.004)*.25;
      ctx.strokeStyle=`rgba(240,60,100,${glow})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(sx+16,sy+14,13,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='onion') {
    if(stage===0) {
      px(14,20,4,6,'#8aaa48'); px(13,19,2,2,'#7a9a40'); px(17,19,2,2,'#7a9a40');
    } else if(stage===1) {
      px(14,13,2,13,'#8aaa48'); px(17,14,2,12,'#7a9a40');
      px(12,16,2,2,'#9aba50'); px(19,15,2,2,'#9aba50');
    } else if(stage===2) {
      px(13,7,2,17,'#8aaa48'); px(16,6,2,18,'#7a9a40'); px(19,9,2,15,'#8aaa48');
      // Leaf tips
      px(12,5,3,3,'#9aba50'); px(15,4,3,3,'#9aba50'); px(18,7,3,3,'#9aba50');
      // Onion bulge
      px(11,22,10,4,'#c09860',0.6);
    } else {
      // Full onion
      px(12,4,2,18,'#8aaa48'); px(15,3,2,19,'#7a9a40'); px(18,5,2,17,'#8aaa48');
      px(11,2,3,3,'#9aba50'); px(14,2,3,3,'#9aba50'); px(17,4,3,3,'#9aba50');
      // Bulb
      px(9,20,14,8,'#c8a060'); px(10,19,12,2,'#d8b070'); px(11,18,10,2,'#e0b878');
      // Layers
      px(13,20,1,7,'#a88048'); px(16,20,1,7,'#a88048'); px(19,21,1,6,'#a88048');
      const glow=0.4+Math.sin(t*.004)*.25;
      ctx.strokeStyle=`rgba(210,170,90,${glow})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(sx+16,sy+24,9,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='watermelon') {
    if(stage===0) {
      px(14,22,4,4,'#3a8028'); px(13,21,2,2,'#2a7020'); px(17,21,2,2,'#2a7020');
    } else if(stage===1) {
      px(15,17,2,9,'#3a8028');
      px(10,20,5,2,'#2a7020'); px(17,19,5,2,'#2a7020');
      px(11,14,10,6,'#4a9030',0.7);
    } else if(stage===2) {
      px(15,14,2,12,'#3a8028');
      px(9,17,5,2,'#2a7020'); px(18,16,5,2,'#2a7020');
      // Medium melon
      px(8,8,16,12,'#4a9030'); px(9,7,14,2,'#5aa038'); px(10,6,12,2,'#60b040');
      // Stripes
      px(10,8,2,10,'#3a7028'); px(14,7,2,12,'#3a7028'); px(18,8,2,10,'#3a7028');
    } else {
      // Huge watermelon
      px(15,3,2,8,'#3a8028'); // vine
      px(4,10,24,18,'#4a9030'); px(5,8,22,4,'#5aa038'); px(6,7,20,2,'#68b840');
      // Stripes
      px(6,10,2,16,'#368026'); px(10,9,2,18,'#368026'); px(14,8,2,20,'#368026'); px(18,9,2,18,'#368026'); px(22,10,2,16,'#368026');
      // Cut hint — the red interior peeking
      px(12,24,8,4,'#e02840',0.5); px(14,23,4,1,'#f03050',0.4);
      const glow=0.4+Math.sin(t*.004)*.25;
      ctx.strokeStyle=`rgba(80,200,60,${glow})`; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(sx+16,sy+18,14,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='rosehip') {
    if(stage===0) {
      px(15,20,2,8,'#4a7028'); px(13,19,2,2,'#3a6020'); px(17,19,2,2,'#3a6020');
    } else if(stage===1) {
      px(14,14,2,12,'#4a7028'); px(17,15,2,11,'#4a7028');
      // Tiny thorns
      px(12,17,2,1,'#a0a060'); px(19,16,2,1,'#a0a060');
      px(13,12,3,3,'#c04050',0.5);
    } else if(stage===2) {
      px(13,8,2,16,'#4a7028'); px(16,7,2,17,'#4a7028');
      // Leaves with thorns
      px(10,12,3,4,'#5a8030'); px(19,11,3,4,'#5a8030');
      px(9,12,2,1,'#a0a060'); px(22,11,2,1,'#a0a060'); // thorns
      // Opening buds
      px(11,6,4,5,'#d03050'); px(17,5,4,5,'#c02040');
    } else {
      px(12,4,2,20,'#4a7028'); px(16,3,2,21,'#4a7028');
      // Branch with thorns
      px(8,10,4,6,'#5a8030'); px(20,9,4,6,'#5a8030');
      px(7,11,2,1,'#a8a868'); px(7,14,2,1,'#a8a868'); px(24,10,2,1,'#a8a868'); px(24,13,2,1,'#a8a868');
      // Rosehips (oval red berries)
      px(10,5,5,6,'#c82030'); px(17,4,5,6,'#c82030'); px(13,3,5,5,'#d83040');
      px(11,4,2,2,'#e84050'); px(18,3,2,2,'#e84050'); px(14,2,2,2,'#e84050'); // highlights
      // Calyx
      px(11,10,2,2,'#3a6020'); px(18,9,2,2,'#3a6020'); px(14,7,2,2,'#3a6020');
      const glow=0.4+Math.sin(t*.004)*.25;
      ctx.strokeStyle=`rgba(220,60,80,${glow})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(sx+16,sy+10,13,0,Math.PI*2); ctx.stroke();
    }
  }

  else if(c==='moonshroom') {
    if(stage===0) {
      px(14,24,4,4,'#6a5090'); px(13,23,2,2,'#4a3070',0.8);
    } else if(stage===1) {
      // Small pale mushroom
      px(15,20,2,7,'#c8c0d8');
      px(12,17,8,5,'#7a60a8'); px(13,16,6,2,'#8a70b8'); // cap
      px(13,21,6,2,'#b0a8c0',0.5); // gills
    } else if(stage===2) {
      // Medium mushroom cluster
      px(15,14,2,11,'#c8c0d8'); px(12,13,2,8,'#b8b0c8');
      // Caps
      px(10,10,10,6,'#7a60a8'); px(9,9,12,2,'#8a70b8'); px(10,8,10,2,'#9a80c0');
      px(8,13,8,5,'#6a50a0'); px(7,12,10,2,'#7a60b0');
      // Moon glow spots
      const gA=0.3+Math.sin(t*.003)*.2;
      px(11,9,2,2,'#e0d8f0',gA); px(15,8,2,2,'#e0d8f0',gA); px(9,13,2,2,'#e0d8f0',gA);
    } else {
      // Full moonshroom — big glowing cluster
      px(15,8,2,18,'#c8c0d8'); px(11,10,2,12,'#b8b0c8'); px(19,11,2,11,'#b8b0c8');
      // Large caps
      px(8,4,16,8,'#7a60a8'); px(7,3,18,2,'#8a70b8'); px(8,2,16,2,'#9a80c0'); px(10,1,12,2,'#aa90d0');
      px(6,10,12,6,'#6a50a0'); px(5,9,14,2,'#7a60b0'); px(6,8,12,2,'#8a70c0');
      px(17,11,10,5,'#7054a8'); px(16,10,12,2,'#8064b8');
      // Glowing bioluminescent spots
      const gA=0.4+Math.sin(t*.003)*.25;
      ctx.save(); ctx.globalAlpha=gA;
      for(const [dx,dy] of [[9,4],[13,3],[17,4],[7,11],[11,11],[19,12],[15,6],[21,12]]){
        ctx.fillStyle='#e8e0ff'; ctx.fillRect(sx+dx,sy+dy,2,2);
      }
      ctx.restore();
      // Aura glow
      const auraA=0.2+Math.sin(t*.002)*.15;
      ctx.save(); ctx.globalAlpha=auraA; ctx.fillStyle='#c0a0ff';
      ctx.beginPath(); ctx.arc(sx+16,sy+12,16,0,Math.PI*2); ctx.fill(); ctx.restore();
      const glow=0.45+Math.sin(t*.004)*.28;
      ctx.strokeStyle=`rgba(160,120,255,${glow})`; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(sx+16,sy+12,14,0,Math.PI*2); ctx.stroke();
    }
  }

  else {
    // Fallback for any unlisted crop — generic plant pixel art
    if(stage===0) {
      px(15,20,2,8,'#4a7028'); px(13,19,2,2,'#5a8830'); px(17,19,2,2,'#5a8830');
    } else if(stage===1) {
      px(15,14,2,12,'#3a5820');
      px(11,16,4,2,'#4a7028'); px(17,15,4,2,'#4a7028');
      ctx.globalAlpha=0.65;
      ctx.font='11px serif'; ctx.textAlign='center';
      ctx.fillText(cd.icon, sx+T/2, sy+T/2+wob);
      ctx.globalAlpha=1;
    } else if(stage===2) {
      px(15,10,2,14,'#3a5820');
      px(10,14,5,1,'#4a7028'); px(17,13,5,1,'#4a7028');
      ctx.globalAlpha=0.85;
      ctx.font='16px serif'; ctx.textAlign='center';
      ctx.fillText(cd.icon, sx+T/2, sy+T/2-2+wob);
      ctx.globalAlpha=1;
    } else {
      px(15,6,2,16,'#3a5820');
      px(9,11,6,1,'#4a7028'); px(17,10,6,1,'#4a7028');
      ctx.font='20px serif'; ctx.textAlign='center';
      ctx.fillText(cd.icon, sx+T/2, sy+T/2-4+wob);
    }
  }

  // ─── Growth progress bar ───
  ctx.fillStyle='rgba(0,0,0,.4)'; ctx.fillRect(sx+3,sy+T-6,T-6,3);
  const barColor = plot.harvestReady
    ? `rgba(120,220,60,${.7+Math.sin(t*.005)*.2})`
    : seasonTier==='banned' ? '#5080c0'
    : seasonTier==='slow'   ? '#c07820'
    : seasonTier==='best'   ? '#90e040'
    : stage===0 ? '#5a7a30'
    : stage===1 ? '#6a9a30'
    : '#80b840';
  ctx.fillStyle=barColor;
  ctx.fillRect(sx+3,sy+T-6,Math.floor((T-6)*g),3);

  // ─── Seasonal overlays ───
  if (seasonTier === 'banned' || seasonTier === 'slow') {
    const frostAlpha = seasonTier === 'banned' ? 0.22 : 0.10;
    ctx.save(); ctx.globalAlpha=frostAlpha; ctx.fillStyle='#a8c8ff';
    ctx.fillRect(sx,sy,T,T); ctx.restore();
    if (stage <= 1 && !plot.harvestReady) {
      ctx.save(); ctx.globalAlpha=0.75; ctx.font='9px serif'; ctx.textAlign='center';
      ctx.fillText('❄', sx+T-5, sy+9); ctx.restore();
    }
  } else if (seasonTier === 'best' && !plot.wilted) {
    const peakA = 0.06+Math.abs(Math.sin(t*.002+tx+ty))*0.06;
    ctx.save(); ctx.globalAlpha=peakA; ctx.fillStyle='#ffe080';
    ctx.fillRect(sx,sy,T,T); ctx.restore();
    if (plot.harvestReady) {
      ctx.save(); ctx.globalAlpha=0.8; ctx.font='8px serif'; ctx.textAlign='center';
      ctx.fillText('★', sx+T-5, sy+9); ctx.restore();
    }
  }
}