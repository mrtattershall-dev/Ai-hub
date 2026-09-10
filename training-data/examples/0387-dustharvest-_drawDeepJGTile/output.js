function _drawDeepJGTile(t, sx, sy, c, timeMs) {
  const T = DJ_T;
  switch (t) {
    case JG.VINE: {
      c.fillStyle = '#1a3010'; c.fillRect(sx, sy, T, T);
      // Hanging vine strands
      c.fillStyle = '#2c5020';
      for (let i = 0; i < 4; i++) {
        const vx = sx + 4 + i * 7;
        const len = 8 + (((vx * 1301 + sy * 503) & 15));
        c.fillRect(vx, sy, 2, Math.min(len, T));
      }
      break;
    }
    case JG.ROOT: {
      c.fillStyle = '#1e2410'; c.fillRect(sx, sy, T, T);
      // Root network lines using seeded positions
      c.strokeStyle = '#3a2c10'; c.lineWidth = 2;
      const rx = ((sx * 1301 + sy * 503) & 0xFF) / 255;
      c.beginPath();
      c.moveTo(sx, sy + T * rx);
      c.bezierCurveTo(sx + T * 0.3, sy + T * (rx + 0.2), sx + T * 0.7, sy + T * (rx - 0.15), sx + T, sy + T * (rx + 0.1));
      c.stroke();
      c.beginPath();
      c.moveTo(sx + T * rx, sy);
      c.bezierCurveTo(sx + T * (rx + 0.15), sy + T * 0.3, sx + T * (rx - 0.1), sy + T * 0.7, sx + T * (rx + 0.05), sy + T);
      c.stroke();
      c.lineWidth = 1;
      break;
    }
    case JG.BIOLUM: {
      // Bioluminescent ground — base dark earth with animated teal glow
      const pulse = 0.55 + 0.45 * Math.sin(timeMs * 0.0012 + sx * 0.04 + sy * 0.03);
      c.fillStyle = '#0a1a14'; c.fillRect(sx, sy, T, T);
      // Glow dots — seeded positions
      const seed1 = (sx * 1301 + sy * 503) & 255;
      const seed2 = (sx * 503  + sy * 1301) & 255;
      const dotCount = 3 + (seed1 & 3);
      for (let i = 0; i < dotCount; i++) {
        const bx = sx + 3 + ((seed1 * (i+1) * 37) & 0xFF) % (T - 6);
        const by = sy + 3 + ((seed2 * (i+1) * 53) & 0xFF) % (T - 6);
        const bp = pulse * (0.7 + 0.3 * Math.sin(timeMs * 0.002 + i * 1.2));
        const r  = 2 + (seed1 >> 4 & 3) * 0.5;
        c.globalAlpha = bp * 0.85;
        c.fillStyle = `hsl(${168 + (seed2 & 15)}, 90%, 60%)`;
        c.beginPath(); c.arc(bx + 0.5, by + 0.5, r, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
      break;
    }
    case JG.FORMATION: {
      // Geological formation — deep amber core with pulsing glow
      // This is the singing vein — ancient, geological, slightly wrong
      const fpulse = 0.6 + 0.4 * Math.sin(timeMs * 0.0008 + sx * 0.02 + sy * 0.015);
      c.fillStyle = '#1a0e04'; c.fillRect(sx, sy, T, T);
      // Vein striations — diagonal lines of mineral
      c.strokeStyle = '#5c3a0a'; c.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const off = i * 7 + ((sx * 503 + sy * 1301 + i * 137) & 7);
        c.beginPath();
        c.moveTo(sx + off, sy);
        c.lineTo(sx + off - T * 0.6, sy + T);
        c.stroke();
      }
      // Core glow
      const glow = c.createRadialGradient(sx + T/2, sy + T/2, 0, sx + T/2, sy + T/2, T * 0.7);
      glow.addColorStop(0, `rgba(230, 140, 20, ${fpulse * 0.75})`);
      glow.addColorStop(0.4, `rgba(180, 90, 10, ${fpulse * 0.45})`);
      glow.addColorStop(1, 'rgba(80, 30, 0, 0)');
      c.fillStyle = glow; c.fillRect(sx, sy, T, T);
      // Crystal edges
      c.strokeStyle = `rgba(255, 200, 60, ${fpulse * 0.5})`; c.lineWidth = 1;
      c.strokeRect(sx + 4, sy + 4, T - 8, T - 8);
      break;
    }
    case JG.CANOPY_BREAK: {
      // Light shaft — sun breaks through the canopy
      // Bright, hopeful, slightly sacred-feeling
      const lshift = Math.sin(timeMs * 0.0005) * 2;
      c.fillStyle = '#1c3810'; c.fillRect(sx, sy, T, T);
      const shaft = c.createLinearGradient(sx + T/2 + lshift, sy, sx + T/2 + lshift * 0.5, sy + T);
      shaft.addColorStop(0, 'rgba(200, 230, 100, 0.45)');
      shaft.addColorStop(0.5, 'rgba(160, 200, 80, 0.28)');
      shaft.addColorStop(1, 'rgba(80, 140, 40, 0.08)');
      c.fillStyle = shaft;
      c.fillRect(sx + T/2 - 5 + lshift, sy, 10, T);
      // Dapple — scattered bright spots
      c.fillStyle = 'rgba(220, 240, 100, 0.35)';
      for (let i = 0; i < 3; i++) {
        const dx2 = 3 + ((sx * 1301 + sy * 503 + i * 97) & 0xFF) % (T - 6);
        const dy2 = 3 + ((sx * 503  + sy * 1301 + i * 53) & 0xFF) % (T - 6);
        c.fillRect(sx + dx2, sy + dy2, 2, 2);
      }
      break;
    }
    case JG.MOSS: {
      c.fillStyle = '#183820'; c.fillRect(sx, sy, T, T);
      // Soft texture — scattered dark spots
      c.fillStyle = '#0e2414';
      for (let i = 0; i < 6; i++) {
        const mx = sx + 2 + ((sx * 1301 + i * 503) & 0xFF) % (T - 4);
        const my = sy + 2 + ((sy * 503  + i * 1301) & 0xFF) % (T - 4);
        c.fillRect(mx, my, 3, 3);
      }
      break;
    }
    case JG.DARK_WATER: {
      // Still black water — deep pool with subtle ripple
      const rphase = (timeMs * 0.0006 + sx * 0.1 + sy * 0.07) % (Math.PI * 2);
      c.fillStyle = '#040c08'; c.fillRect(sx, sy, T, T);
      // Barely-visible ripple ring
      c.strokeStyle = `rgba(20, 50, 35, ${0.3 + 0.2 * Math.sin(rphase)})`;
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(sx + T/2, sy + T/2, 8 + Math.sin(rphase) * 2, 4 + Math.sin(rphase), 0, 0, Math.PI * 2);
      c.stroke();
      // Surface sheen
      c.fillStyle = 'rgba(30, 70, 50, 0.18)';
      c.fillRect(sx + 4, sy + T/2 - 1, T - 8, 2);
      break;
    }
    case JG.ANCIENT_WALL: {
      // Pre-civ stonework — inhuman scale, geometric precision
      c.fillStyle = '#1c1e28'; c.fillRect(sx, sy, T, T);
      // Stone blocks — larger than human masonry
      c.strokeStyle = '#2a2c38'; c.lineWidth = 1;
      c.strokeRect(sx + 1, sy + 1, T - 2, T - 2);
      c.strokeRect(sx + 4, sy + 4, T - 8, T - 8);
      // Worn groove lines
      c.fillStyle = '#252730';
      c.fillRect(sx, sy + T/3, T, 1);
      c.fillRect(sx, sy + 2*T/3, T, 1);
      break;
    }
    case JG.ANCIENT_FLOOR: {
      c.fillStyle = '#181a22'; c.fillRect(sx, sy, T, T);
      // Geometric inlay — subtle pattern, non-organic
      c.strokeStyle = '#242630'; c.lineWidth = 1;
      c.strokeRect(sx + 3, sy + 3, T - 6, T - 6);
      c.strokeRect(sx + 8, sy + 8, T - 16, T - 16);
      break;
    }
    case JG.DESCEND: {
      // Transition tile — descent into deep jungle
      const dpulse = 0.5 + 0.5 * Math.sin(timeMs * 0.001);
      c.fillStyle = '#080e06'; c.fillRect(sx, sy, T, T);
      c.fillStyle = `rgba(80, 160, 60, ${dpulse * 0.45})`;
      c.beginPath(); c.arc(sx + T/2, sy + T/2, T * 0.38, 0, Math.PI * 2); c.fill();
      c.strokeStyle = `rgba(120, 200, 80, ${dpulse * 0.7})`; c.lineWidth = 2;
      c.beginPath(); c.arc(sx + T/2, sy + T/2, T * 0.38, 0, Math.PI * 2); c.stroke();
      c.fillStyle = `rgba(180, 240, 100, ${dpulse * 0.85})`;
      c.font = '10px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('▼', sx + T/2, sy + T/2 + 1);
      c.lineWidth = 1;
      break;
    }
    case JG.ASCEND: {
      const apulse = 0.5 + 0.5 * Math.sin(timeMs * 0.001 + 1.2);
      c.fillStyle = '#0a1208'; c.fillRect(sx, sy, T, T);
      c.fillStyle = `rgba(100, 180, 80, ${apulse * 0.4})`;
      c.beginPath(); c.arc(sx + T/2, sy + T/2, T * 0.38, 0, Math.PI * 2); c.fill();
      c.strokeStyle = `rgba(140, 220, 100, ${apulse * 0.7})`; c.lineWidth = 2;
      c.beginPath(); c.arc(sx + T/2, sy + T/2, T * 0.38, 0, Math.PI * 2); c.stroke();
      c.fillStyle = `rgba(200, 255, 120, ${apulse * 0.85})`;
      c.font = '10px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('▲', sx + T/2, sy + T/2 + 1);
      c.lineWidth = 1;
      break;
    }
    default: {
      // Fallback for any unrecognized tile in deep map — use standard drawJGTile
      drawJGTile(t, sx, sy);
    }
  }
}