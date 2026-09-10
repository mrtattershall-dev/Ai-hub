// ═══════════════════════════════════════════════════════
//  RENDERER MODULE  –  All canvas drawing
// ═══════════════════════════════════════════════════════
const Renderer = (() => {

  let canvas, ctx, minimapCanvas, minimapCtx;
  let W, H;

  // Camera
  const cam = { x: 0, y: 0, targetX: 0, targetY: 0, zoom: 1 };
  const CAM_SMOOTH = 6;

  function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    minimapCanvas = document.getElementById('minimap');
    minimapCtx = minimapCanvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;
  }

  function setCamera(targetX, targetY, dt, player) {
    // Look-ahead: camera leads slightly in the direction of travel
    const lookAheadDist = player ? Math.min(60, player.speed * 0.12) : 0;
    const lookX = player ? Math.cos(player.angle) * lookAheadDist : 0;
    const lookY = player ? Math.sin(player.angle) * lookAheadDist : 0;
    cam.targetX = targetX + lookX;
    cam.targetY = targetY + lookY;
    cam.x += (cam.targetX - cam.x) * Math.min(1, CAM_SMOOTH * dt);
    cam.y += (cam.targetY - cam.y) * Math.min(1, CAM_SMOOTH * dt);
  }

  // World → screen
  function toScreen(wx, wy) {
    return {
      x: (wx - cam.x) * cam.zoom + W/2,
      y: (wy - cam.y) * cam.zoom + H/2,
    };
  }

  // ── Draw track ────────────────────────────────────────
  function drawTrack(track) {
    const pts = track.pts;
    const hw = track.halfWidth;

    // Background fill (whole canvas)
    ctx.fillStyle = track.bgColor;
    ctx.fillRect(0, 0, W, H);

    // Grid overlay
    ctx.save();
    ctx.strokeStyle = 'rgba(0,245,255,0.04)';
    ctx.lineWidth = 1;
    const gSize = 60 * cam.zoom;
    const offX = ((-cam.x * cam.zoom + W/2) % gSize + gSize) % gSize;
    const offY = ((-cam.y * cam.zoom + H/2) % gSize + gSize) % gSize;
    for (let x = offX; x < W; x += gSize) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = offY; y < H; y += gSize) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.restore();

    // Build road polygon (offset both sides)
    const leftPts  = [], rightPts = [];
    for (let i = 0; i < pts.length; i++) {
      const next = pts[(i+1) % pts.length];
      const ang  = Math.atan2(next.y - pts[i].y, next.x - pts[i].x);
      const perp = ang + Math.PI/2;
      const s = toScreen(pts[i].x, pts[i].y);
      leftPts.push({
        x: s.x + Math.cos(perp) * hw * cam.zoom,
        y: s.y + Math.sin(perp) * hw * cam.zoom,
      });
      rightPts.push({
        x: s.x - Math.cos(perp) * hw * cam.zoom,
        y: s.y - Math.sin(perp) * hw * cam.zoom,
      });
    }

    // Road surface
    ctx.beginPath();
    ctx.moveTo(leftPts[0].x, leftPts[0].y);
    for (const p of leftPts) ctx.lineTo(p.x, p.y);
    for (let i = rightPts.length-1; i >= 0; i--) ctx.lineTo(rightPts[i].x, rightPts[i].y);
    ctx.closePath();
    ctx.fillStyle = track.roadColor;
    ctx.fill();

    // Road border lines
    ctx.strokeStyle = track.borderColor;
    ctx.lineWidth = 3 * cam.zoom;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(leftPts[0].x, leftPts[0].y);
    for (const p of leftPts) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rightPts[0].x, rightPts[0].y);
    for (const p of rightPts) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Center dashes
    ctx.setLineDash([16 * cam.zoom, 24 * cam.zoom]);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2 * cam.zoom;
    ctx.beginPath();
    const s0 = toScreen(pts[0].x, pts[0].y);
    ctx.moveTo(s0.x, s0.y);
    for (let i = 1; i < pts.length; i++) {
      const s = toScreen(pts[i].x, pts[i].y);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Start/finish line
    drawStartFinish(track);

    // Checkpoints (subtle)
    for (const gate of track.gates) {
      const s1 = toScreen(gate.x1, gate.y1);
      const s2 = toScreen(gate.x2, gate.y2);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,100,0.2)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6,6]);
      ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Boost pads
    drawBoostPads(track);
  }

  function drawStartFinish(track) {
    const pts = track.pts;
    const hw = track.halfWidth;
    const ang = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    const perp = ang + Math.PI/2;
    const s = toScreen(pts[0].x, pts[0].y);
    const lx = s.x + Math.cos(perp)*hw*cam.zoom, ly = s.y + Math.sin(perp)*hw*cam.zoom;
    const rx = s.x - Math.cos(perp)*hw*cam.zoom, ry = s.y - Math.sin(perp)*hw*cam.zoom;

    // Checkerboard pattern
    const segCount = 8;
    const len = Math.sqrt((lx-rx)**2+(ly-ry)**2);
    const segLen = len / segCount;
    const dx = (rx-lx)/len, dy = (ry-ly)/len;
    const bw = 8 * cam.zoom;

    for (let i = 0; i < segCount; i++) {
      const sx = lx + dx * segLen * i;
      const sy = ly + dy * segLen * i;
      const ex = lx + dx * segLen * (i+1);
      const ey = ly + dy * segLen * (i+1);
      ctx.beginPath();
      ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
      ctx.strokeStyle = i%2===0 ? '#fff' : '#000';
      ctx.lineWidth = bw;
      ctx.stroke();
    }
    // Finish line label
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `bold ${Math.max(8, 11*cam.zoom)}px 'Orbitron', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('START / FINISH', 0, -hw*cam.zoom - 8);
    ctx.restore();
  }

  function drawBoostPads(track) {
    for (const pad of track.boosts) {
      const s = toScreen(pad.x, pad.y);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(pad.angle);
      const pw = pad.width * cam.zoom, ph = pad.height * cam.zoom;

      if (pad.active) {
        // Glowing arrow pad
        const grad = ctx.createLinearGradient(0, -ph/2, 0, ph/2);
        grad.addColorStop(0, 'rgba(255,0,110,0)');
        grad.addColorStop(0.5, 'rgba(255,0,110,0.7)');
        grad.addColorStop(1, 'rgba(255,190,11,0.9)');
        ctx.fillStyle = grad;
        ctx.fillRect(-pw/2, -ph/2, pw, ph);

        // Arrow chevrons
        ctx.strokeStyle = '#ffbe0b';
        ctx.lineWidth = 2 * cam.zoom;
        ctx.globalAlpha = 0.9;
        for (let i = 0; i < 3; i++) {
          const oy = -ph/4 + i * ph/4;
          ctx.beginPath();
          ctx.moveTo(-pw/2 + 4*cam.zoom, oy);
          ctx.lineTo(0, oy + ph/8);
          ctx.lineTo(pw/2 - 4*cam.zoom, oy);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else {
        // Recharging
        ctx.fillStyle = 'rgba(60,60,60,0.4)';
        ctx.fillRect(-pw/2, -ph/2, pw, ph);
        const pct = pad.timer / 5;
        ctx.fillStyle = 'rgba(255,190,11,0.3)';
        ctx.fillRect(-pw/2, ph/2 - ph*pct, pw, ph*pct);
      }

      ctx.restore();
    }
  }

  // ── Draw skid marks ──────────────────────────────────
  function drawSkids() {
    const skids = Particles.getSkids();
    for (const s of skids) {
      if (s.life <= 0) continue;
      const sc = toScreen(s.x, s.y);
      ctx.save();
      ctx.translate(sc.x, sc.y);
      ctx.rotate(s.angle + Math.PI/2);
      ctx.fillStyle = `rgba(0,0,0,${s.life * 0.55})`;
      ctx.fillRect(-4*cam.zoom, -3*cam.zoom, 8*cam.zoom, 6*cam.zoom);
      ctx.restore();
    }
  }

  // ── Draw sparks/particles ─────────────────────────────
  function drawSparks() {
    const sparks = Particles.getSparks();
    for (const s of sparks) {
      if (!s.active) continue;
      const sc = toScreen(s.x, s.y);
      const alpha = Math.max(0, s.life / s.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (s.isDust) {
        ctx.fillStyle = s.color + (alpha * 0.5) + ')';
      } else {
        ctx.fillStyle = s.color;
      }
      const sz = s.size * cam.zoom;
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, sz/2, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Draw a car ───────────────────────────────────────
  function drawCar(car, track, isPlayer) {
    if (car.finished && !isPlayer) {
      // Draw a faded ghost silhouette for finished AI cars
      const s = toScreen(car.x, car.y);
      const cw = (car.carW || Physics.BASE.carW) * cam.zoom;
      const ch = (car.carH || Physics.BASE.carH) * cam.zoom;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(car.angle + Math.PI/2);
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = car.color || '#888';
      roundRect(ctx, -cw/2, -ch/2, cw, ch, 4*cam.zoom);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    // Eliminated cars: render as dim faded wreck, no glow
    if (car.eliminated) {
      const s = toScreen(car.x, car.y);
      const cw = (car.carW || Physics.BASE.carW) * cam.zoom;
      const ch = (car.carH || Physics.BASE.carH) * cam.zoom;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(car.angle + Math.PI/2 + 0.4); // slightly askew
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#444';
      roundRect(ctx, -cw/2, -ch/2, cw, ch, 3*cam.zoom);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    const s = toScreen(car.x, car.y);
    const cw = (car.carW || Physics.BASE.carW) * cam.zoom;
    const ch = (car.carH || Physics.BASE.carH) * cam.zoom;
    const cls = Physics.CAR_CLASSES[car.carClass] || Physics.CAR_CLASSES.speedster;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(car.angle + Math.PI/2);

    // Body glow
    if (isPlayer) {
      ctx.shadowBlur  = car.boostActive ? 28 : 12;
      ctx.shadowColor = car.color;
    } else {
      ctx.shadowBlur = 4;
      ctx.shadowColor = car.color;
    }

    // Class-specific body shapes
    ctx.fillStyle = car.color;
    if (car.carClass === 'speedster') {
      // Sleek pointed nose
      ctx.beginPath();
      ctx.moveTo(0, -ch/2);
      ctx.lineTo(cw/2, -ch*0.25);
      ctx.lineTo(cw/2, ch*0.45);
      ctx.lineTo(-cw/2, ch*0.45);
      ctx.lineTo(-cw/2, -ch*0.25);
      ctx.closePath();
      ctx.fill();
    } else if (car.carClass === 'drifter') {
      // Wide, low profile with flared fenders
      roundRect(ctx, -cw/2, -ch/2, cw, ch, 3*cam.zoom);
      ctx.fill();
      ctx.fillStyle = car.color + 'aa';
      ctx.fillRect(-cw*0.6, -ch*0.1, cw*0.12, ch*0.4); // left fender
      ctx.fillRect( cw*0.48, -ch*0.1, cw*0.12, ch*0.4); // right fender
    } else if (car.carClass === 'bruiser') {
      // Chunky block body
      roundRect(ctx, -cw/2, -ch/2, cw, ch, 2*cam.zoom);
      ctx.fill();
      // Bull bars
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(-cw*0.45, -ch/2, cw*0.9, ch*0.08);
    } else {
      roundRect(ctx, -cw/2, -ch/2, cw, ch, 4*cam.zoom);
      ctx.fill();
    }

    // Cockpit
    ctx.shadowBlur = 0;
    ctx.fillStyle = isPlayer ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)';
    roundRect(ctx, -cw*0.3, -ch*0.15, cw*0.6, ch*0.38, 2*cam.zoom);
    ctx.fill();

    // Headlights
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-cw*0.38, -ch*0.44, cw*0.18, ch*0.09);
    ctx.fillRect( cw*0.2,  -ch*0.44, cw*0.18, ch*0.09);

    // Tail lights
    ctx.fillStyle = '#ff3333';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(-cw*0.38, ch*0.36, cw*0.18, ch*0.08);
    ctx.fillRect( cw*0.2,  ch*0.36, cw*0.18, ch*0.08);

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Boost flame
    if (car.boostActive) {
      const grad = ctx.createLinearGradient(0, ch*0.4, 0, ch*0.9);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, car.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      const fw = cw * 0.4;
      const fh = (ch * 0.3 + Math.random() * ch * 0.25) * cam.zoom;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(-fw/2, ch*0.42, fw, fh);
      ctx.globalAlpha = 1;
    }

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = `bold ${Math.max(5, 7*cam.zoom)}px 'Orbitron', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isPlayer ? cls.icon : car.aiName || 'AI', 0, 0);

    ctx.restore();

    // Skid marks
    if (car.skidding && car.speed > 40) {
      const perp = car.angle + Math.PI/2;
      const rearX = car.x - Math.cos(car.angle) * (car.carH||Physics.BASE.carH)/2;
      const rearY = car.y - Math.sin(car.angle) * (car.carH||Physics.BASE.carH)/2;
      Particles.addSkid(rearX + Math.cos(perp)*(car.carW||Physics.BASE.carW)*0.4, rearY + Math.sin(perp)*(car.carW||Physics.BASE.carW)*0.4, car.angle, 0.8);
      Particles.addSkid(rearX - Math.cos(perp)*(car.carW||Physics.BASE.carW)*0.4, rearY - Math.sin(perp)*(car.carW||Physics.BASE.carW)*0.4, car.angle, 0.8);
      if (Math.random() < 0.3) Audio.playSkid();
    }

    // Dust when off track
    if (!car.onTrack && car.speed > 20 && Math.random() < 0.4) {
      Particles.emitDust(car.x, car.y);
    }

    // Boost flame particles
    if (car.boostActive && Math.random() < 0.7) {
      const rearX = car.x - Math.cos(car.angle) * 20;
      const rearY = car.y - Math.sin(car.angle) * 20;
      Particles.emitBoostFlame(rearX, rearY, car.angle, car.color);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x+w, y, x+w, y+r, r);
    ctx.lineTo(x+w, y+h-r);
    ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
    ctx.lineTo(x+r, y+h);
    ctx.arcTo(x, y+h, x, y+h-r, r);
    ctx.lineTo(x, y+r);
    ctx.arcTo(x, y, x+r, y, r);
    ctx.closePath();
  }

  // ── Minimap ──────────────────────────────────────────
  function drawMinimap(track, cars) {
    const mc = minimapCtx;
    const mw = minimapCanvas.width, mh = minimapCanvas.height;
    mc.clearRect(0, 0, mw, mh);

    // Find bounding box of track
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of track.pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    const tw = maxX - minX, th = maxY - minY;
    const scale = Math.min((mw-8)/tw, (mh-8)/th) * 0.9;
    const ox = (mw - tw*scale)/2 - minX*scale;
    const oy = (mh - th*scale)/2 - minY*scale;

    // Minimap background
    mc.fillStyle = 'rgba(0,5,20,0.7)';
    mc.beginPath();
    mc.roundRect(0, 0, mw, mh, 6);
    mc.fill();

    // Track center line
    mc.strokeStyle = 'rgba(0,245,255,0.5)';
    mc.lineWidth = 4;
    mc.beginPath();
    mc.moveTo(track.pts[0].x*scale+ox, track.pts[0].y*scale+oy);
    for (const p of track.pts) mc.lineTo(p.x*scale+ox, p.y*scale+oy);
    mc.closePath();
    mc.stroke();

    // Cars (skip eliminated)
    for (const car of cars) {
      if (car.eliminated) continue;
      mc.beginPath();
      mc.arc(car.x*scale+ox, car.y*scale+oy, car.isPlayer ? 4.5 : 2.5, 0, Math.PI*2);
      mc.fillStyle = car.isPlayer ? '#ffbe0b' : (car.finished ? 'rgba(255,255,255,0.3)' : car.color);
      mc.fill();
      // Player direction arrow
      if (car.isPlayer) {
        mc.save();
        mc.translate(car.x*scale+ox, car.y*scale+oy);
        mc.rotate(car.angle);
        mc.fillStyle = '#ffbe0b';
        mc.beginPath();
        mc.moveTo(0, -7);
        mc.lineTo(3, 1);
        mc.lineTo(-3, 1);
        mc.closePath();
        mc.fill();
        mc.restore();
      }
    }
  }

  // ── Frame ────────────────────────────────────────────
  function frame(track, player, allCars, dt) {
    const shake = Particles.getShake();
    ctx.save();
    ctx.translate(shake.x, shake.y);

    setCamera(player.x, player.y, dt, player);

    drawTrack(track);
    drawSkids();

    // Draw all cars back-to-front by y position
    const sorted = [...allCars].sort((a,b) => a.y - b.y);
    for (const car of sorted) drawCar(car, track, car.isPlayer);

    drawSparks();
    ctx.restore();

    drawMinimap(track, allCars);
  }

  // ── Countdown overlay ────────────────────────────────
  function showCountdown(text) {
    const el = document.getElementById('countdown-display');
    el.textContent = text;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 700);
  }

  // ── Lap flash ─────────────────────────────────────────
  function showLapFlash(text) {
    const el = document.getElementById('lap-flash');
    el.textContent = text;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1200);
  }

  return { init, resize, frame, showCountdown, showLapFlash, cam, toScreen };
})();
