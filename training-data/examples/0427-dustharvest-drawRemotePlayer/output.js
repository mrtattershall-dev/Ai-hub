function drawRemotePlayer(p, color) {
  const cam = gameState.camera;
  // Initialise render position on first sight
  if (!_remoteRenderPos[p._pid]) _remoteRenderPos[p._pid] = { x: p.x, y: p.y };
  const rp = _remoteRenderPos[p._pid];
  rp.x += (p.x - rp.x) * _LERP_FACTOR;
  rp.y += (p.y - rp.y) * _LERP_FACTOR;
  // Snap if very close (avoids infinite micro-drift)
  if (Math.abs(p.x - rp.x) < 0.5) rp.x = p.x;
  if (Math.abs(p.y - rp.y) < 0.5) rp.y = p.y;
  const sx = Math.round(rp.x - cam.x);
  const sy = Math.round(rp.y - cam.y);
  const vw = canvas.width/ZOOM, vh = canvas.height/ZOOM;
  if (sx<-60||sx>vw+60||sy<-80||sy>vh+20) return;

  ctx.save(); ctx.scale(ZOOM, ZOOM);
  // Shadow
  ctx.save(); ctx.globalAlpha=.28; ctx.fillStyle='#000';
  ctx.beginPath(); ctx.ellipse(sx,sy+2,10,4,0,0,Math.PI*2); ctx.fill(); ctx.restore();
  // Character
  const cfg={
    gender:p.gender??'male', skinTone:p.skinTone??0,
    hairStyle:p.hairStyle??0, hairColor:p.hairColor??0,
    shirtStyle:p.shirtStyle??0, shirtColor:p.shirtColor??2,
    pantsColor:p.pantsColor??1, hatColor:p.hatColor??2,
  };
  if (typeof drawCharacter==='function') {
    drawCharacter(ctx,sx,sy,p.facing||'down',p.walkFrame||0,false,cfg);
  } else {
    ctx.fillStyle=color; ctx.fillRect(sx-9,sy-20,18,22);
    ctx.fillStyle='#c09870'; ctx.fillRect(sx-5,sy-31,10,12);
  }
  // Tool icon
  const icons={till:'⛏',water:'💧',plant:'🌱',harvest:'🌾'};
  const icon=icons[p.tool]||'';
  if (icon){ctx.font='13px serif';ctx.textAlign='center';ctx.fillText(icon,sx,sy-44);}
  // Name tag
  const name=(p.name||'Partner').slice(0,16);
  const nw=name.length*4.5+14;
  ctx.fillStyle='rgba(10,25,50,.82)'; ctx.fillRect(sx-nw/2,sy-54,nw,13);
  ctx.fillStyle=color; ctx.fillRect(sx-nw/2,sy-54,nw,2);
  ctx.fillStyle='#a8ccff'; ctx.font='9px sans-serif'; ctx.textAlign='center';
  ctx.fillText(name,sx,sy-45);
  ctx.restore();
}