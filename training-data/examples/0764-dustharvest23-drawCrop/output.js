function drawCrop(plot,sx,sy,tx,ty) {
  if (!plot||!plot.tilled||!plot.crop) return;
  const cd=CROPS[plot.crop];
  const g=plot.growthProgress;
  const stage=Math.min(3,Math.floor(g*4)); // 0=seedling 1=sprout 2=growing 3=ready
  const wob=Math.sin(Date.now()*.002+tx+ty)*1.2;
  const seasonTier = getCropSeasonTier(plot.crop);

  if(plot.wilted){
    // Wilted — drooping, desaturated
    ctx.globalAlpha=0.5;
    ctx.font='12px serif'; ctx.textAlign='center';
    ctx.fillText('🥀', sx+T/2, sy+T/2+5+wob);
    ctx.globalAlpha=1;
  } else if(stage===0){
    // Stage 0 — seedling: tiny sprout, no icon yet
    ctx.fillStyle='#4a7028';
    ctx.fillRect(sx+T/2-1,sy+T-10,2,6); // stem
    ctx.fillRect(sx+T/2-3,sy+T-12,3,2); // left leaf
    ctx.fillRect(sx+T/2+1,sy+T-12,3,2); // right leaf
    ctx.fillStyle='#5a8830';
    ctx.fillRect(sx+T/2-2,sy+T-13,2,1);
    ctx.fillRect(sx+T/2+1,sy+T-13,2,1);
  } else if(stage===1){
    // Stage 1 — sprout: small icon, half transparent, stem showing
    ctx.fillStyle='#3a5820';
    ctx.fillRect(sx+T/2-1,sy+T-14,2,10);
    // Small side leaves
    ctx.fillStyle='#4a7028';
    ctx.fillRect(sx+T/2-4,sy+T-16,4,2);
    ctx.fillRect(sx+T/2+1,sy+T-15,4,2);
    ctx.globalAlpha=0.65;
    ctx.font='11px serif'; ctx.textAlign='center';
    ctx.fillText(cd.icon, sx+T/2, sy+T/2+wob);
    ctx.globalAlpha=1;
  } else if(stage===2){
    // Stage 2 — growing: visible stem, medium icon
    ctx.fillStyle='#3a5820';
    ctx.fillRect(sx+T/2-1,sy+T-18,2,14);
    ctx.fillRect(sx+T/2-5,sy+T-18,5,1);
    ctx.fillRect(sx+T/2+1,sy+T-16,5,1);
    ctx.globalAlpha=0.85;
    ctx.font='16px serif'; ctx.textAlign='center';
    ctx.fillText(cd.icon, sx+T/2, sy+T/2-2+wob);
    ctx.globalAlpha=1;
  } else {
    // Stage 3 — ready: full size, golden shimmer
    ctx.fillStyle='#3a5820';
    ctx.fillRect(sx+T/2-1,sy+T-20,2,16);
    ctx.fillRect(sx+T/2-6,sy+T-20,6,1);
    ctx.fillRect(sx+T/2+1,sy+T-18,6,1);
    ctx.font='20px serif'; ctx.textAlign='center';
    ctx.fillText(cd.icon, sx+T/2, sy+T/2-4+wob);
    // Harvest glow ring
    const glow=0.4+Math.sin(Date.now()*.004)*0.25;
    ctx.strokeStyle=`rgba(240,220,80,${glow})`;
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(sx+T/2,sy+T/2-4,13,0,Math.PI*2); ctx.stroke();
    // Sparkle corners
    ctx.fillStyle=`rgba(255,240,100,${glow})`;
    ctx.fillRect(sx+4,sy+4,2,2); ctx.fillRect(sx+T-6,sy+4,2,2);
  }

  // Growth progress bar — always visible on tilled soil
  ctx.fillStyle='rgba(0,0,0,.4)'; ctx.fillRect(sx+3,sy+T-6,T-6,3);
  const barColor = plot.harvestReady
    ? `rgba(120,220,60,${.7+Math.sin(Date.now()*.005)*.2})`
    : seasonTier==='banned' ? '#5080c0'
    : seasonTier==='slow'   ? '#c07820'
    : seasonTier==='best'   ? '#90e040'
    : stage===0 ? '#5a7a30'
    : stage===1 ? '#6a9a30'
    : '#80b840';
  ctx.fillStyle=barColor;
  ctx.fillRect(sx+3,sy+T-6,Math.floor((T-6)*g),3);

  // Seasonal crop overlays
  if (seasonTier === 'banned' || seasonTier === 'slow') {
    // Frost overlay — blue-white wash over the tile
    const frostAlpha = seasonTier === 'banned' ? 0.22 : 0.10;
    ctx.save();
    ctx.globalAlpha = frostAlpha;
    ctx.fillStyle = '#a8c8ff';
    ctx.fillRect(sx, sy, T, T);
    ctx.restore();
    // ❄ indicator on seedling/sprout stages
    if (stage <= 1 && !plot.harvestReady) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.font = '9px serif'; ctx.textAlign = 'center';
      ctx.fillText('❄', sx + T - 5, sy + 9);
      ctx.restore();
    }
  } else if (seasonTier === 'best' && !plot.wilted) {
    // Peak season — subtle warm golden glow on growing crops
    const peakA = 0.06 + Math.abs(Math.sin(Date.now()*.002 + tx + ty)) * 0.06;
    ctx.save();
    ctx.globalAlpha = peakA;
    ctx.fillStyle = '#ffe080';
    ctx.fillRect(sx, sy, T, T);
    ctx.restore();
    // ★ on ready crops
    if (plot.harvestReady) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.font = '8px serif'; ctx.textAlign = 'center';
      ctx.fillText('★', sx + T - 5, sy + 9);
      ctx.restore();
    }
  }
}