function drawMerchant(cx, cy) {
  if (!merchantPresent) return;
  const sx = MERCHANT_X - cx, sy = MERCHANT_Y - cy;
  if (sx < -T*2 || sx > canvas.width+T*2) return;
  const bob = Math.sin(Date.now()*.0015)*1.5;

  // Shadow
  ctx.globalAlpha=.22; ctx.fillStyle='#000';
  ctx.beginPath(); ctx.ellipse(sx,sy+8,8,3,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;

  // Boots — trail-worn
  ctx.fillStyle='#2a1a08'; ctx.fillRect(sx-5,sy+4+bob,4,6); ctx.fillRect(sx+1,sy+4+bob,4,6);
  ctx.fillStyle='#1a1006'; ctx.fillRect(sx-6,sy+8+bob,4,2); ctx.fillRect(sx+2,sy+8+bob,4,2);

  // Trousers — dusty grey
  ctx.fillStyle='#484038'; ctx.fillRect(sx-5,sy-4+bob,4,10); ctx.fillRect(sx+1,sy-4+bob,4,10);

  // Long duster coat — sun-bleached ochre, road dust on hem
  ctx.fillStyle='#a08050'; ctx.fillRect(sx-8,sy-16+bob,16,22);
  // Coat lapels
  ctx.fillStyle='#8a6838'; ctx.fillRect(sx-8,sy-16+bob,4,12); ctx.fillRect(sx+4,sy-16+bob,4,12);
  // Coat buttons
  ctx.fillStyle='#c0a050';
  ctx.fillRect(sx-1,sy-14+bob,1,1); ctx.fillRect(sx-1,sy-11+bob,1,1); ctx.fillRect(sx-1,sy-8+bob,1,1);
  // Dust on coat hem — lighter
  ctx.fillStyle='rgba(200,180,120,.2)'; ctx.fillRect(sx-8,sy+2+bob,16,4);
  // Belt
  ctx.fillStyle='#3a2410'; ctx.fillRect(sx-8,sy-4+bob,16,2);
  ctx.fillStyle='#c0a040'; ctx.fillRect(sx-1,sy-4+bob,3,2); // belt buckle

  // Arms
  ctx.fillStyle='#a08050'; ctx.fillRect(sx-12,sy-14+bob,5,12); ctx.fillRect(sx+7,sy-14+bob,5,12);
  // Hands with goods
  ctx.fillStyle='#c09868'; ctx.fillRect(sx-12,sy-4+bob,5,4); ctx.fillRect(sx+7,sy-4+bob,5,4);
  // Saddlebag strap across body
  ctx.fillStyle='#5a3818';
  ctx.fillRect(sx-8,sy-16+bob,2,18);

  // Neck
  ctx.fillStyle='#c09868'; ctx.fillRect(sx-2,sy-20+bob,5,5);

  // Head — lean, road-weathered
  ctx.fillStyle='#c09868'; ctx.fillRect(sx-5,sy-30+bob,10,11);
  // Squint lines — lots of sun
  ctx.fillStyle='rgba(60,30,10,.3)';
  ctx.fillRect(sx-5,sy-24+bob,3,1); ctx.fillRect(sx+2,sy-24+bob,3,1);
  // Eyes — watchful
  ctx.fillStyle='#406050'; ctx.fillRect(sx-3,sy-27+bob,2,2); ctx.fillRect(sx+1,sy-27+bob,2,2);
  ctx.fillStyle='#000'; ctx.fillRect(sx-2,sy-27+bob,1,1); ctx.fillRect(sx+2,sy-27+bob,1,1);
  // Nose
  ctx.fillStyle='#a87040'; ctx.fillRect(sx-1,sy-25+bob,2,3);
  // Thin lips — neutral
  ctx.fillStyle='#8a5030'; ctx.fillRect(sx-2,sy-21+bob,5,1);

  // Wide-brim hat — trail hat, brown, dusty
  ctx.fillStyle='#4a3018'; ctx.fillRect(sx-10,sy-33+bob,20,3); // brim
  ctx.fillStyle='#5a3c20'; ctx.fillRect(sx-6,sy-42+bob,12,10); // crown
  ctx.fillStyle='#3a2410'; ctx.fillRect(sx-6,sy-34+bob,12,2); // hat band
  // Dust line on brim
  ctx.fillStyle='rgba(180,150,80,.25)'; ctx.fillRect(sx-10,sy-33+bob,20,1);
  // Chin cord hanging loose
  ctx.strokeStyle='#3a2410'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(sx-5,sy-33+bob); ctx.lineTo(sx-7,sy-22+bob); ctx.stroke();

  // Name tag
  const label = '🐪 Merchant';
  const nw = label.length * 5.0 + 10;
  ctx.fillStyle='rgba(0,0,0,.7)'; ctx.fillRect(sx-nw/2,sy-50+bob,nw,12);
  ctx.fillStyle='#c8b060'; ctx.font='8px sans-serif'; ctx.textAlign='center';
  ctx.fillText(label, sx, sy-41+bob);

  // Proximity prompt
  if (Math.hypot(player.x - MERCHANT_X, player.y - MERCHANT_Y) < MERCHANT_INTERACT_RADIUS) {
    const pulse = 0.6 + Math.sin(Date.now()*.005)*0.4;
    ctx.globalAlpha = pulse;
    ctx.fillStyle='#e8c858'; ctx.font='7px sans-serif';
    ctx.fillText('[E] Trade', sx, sy-58+bob);
    ctx.globalAlpha = 1;
  }
}