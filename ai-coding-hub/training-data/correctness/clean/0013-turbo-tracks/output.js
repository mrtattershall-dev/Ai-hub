// ═══════════════════════════════════════════════════════
//  TRACKS MODULE  –  Track definitions + spline math
// ═══════════════════════════════════════════════════════
const Tracks = (() => {

  // ── Catmull-Rom spline helper ─────────────────────────
  function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return {
      x: 0.5 * ((2*p1.x) + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
      y: 0.5 * ((2*p1.y) + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
    };
  }

  // Build a dense point array from control points (closed loop)
  function buildSpline(ctrlPts, steps = 20) {
    const pts = [];
    const n = ctrlPts.length;
    for (let i = 0; i < n; i++) {
      const p0 = ctrlPts[(i - 1 + n) % n];
      const p1 = ctrlPts[i];
      const p2 = ctrlPts[(i + 1) % n];
      const p3 = ctrlPts[(i + 2) % n];
      for (let s = 0; s < steps; s++) {
        pts.push(catmullRom(p0, p1, p2, p3, s / steps));
      }
    }
    return pts;
  }

  // Compute cumulative distances along a path
  function buildDistances(pts) {
    const dists = [0];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i-1].x;
      const dy = pts[i].y - pts[i-1].y;
      dists.push(dists[i-1] + Math.sqrt(dx*dx + dy*dy));
    }
    return dists;
  }

  // Get point at a normalized progress (0-1) along path
  function getPointAtProgress(pts, dists, progress) {
    const total = dists[dists.length - 1];
    let target = progress * total;
    if (target < 0) target += total;
    target = target % total;
    for (let i = 0; i < dists.length - 1; i++) {
      if (dists[i+1] >= target) {
        const t = (target - dists[i]) / (dists[i+1] - dists[i]);
        return {
          x: pts[i].x + (pts[i+1].x - pts[i].x) * t,
          y: pts[i].y + (pts[i+1].y - pts[i].y) * t,
          angle: Math.atan2(pts[i+1].y - pts[i].y, pts[i+1].x - pts[i].x),
          idx: i
        };
      }
    }
    return { ...pts[0], angle: 0, idx: 0 };
  }

  // Check if a point is near the track center within halfWidth
  function isOnTrack(pt, trackPts, halfWidth) {
    let minDist = Infinity;
    for (const tp of trackPts) {
      const dx = pt.x - tp.x, dy = pt.y - tp.y;
      const d = dx*dx + dy*dy;
      if (d < minDist) minDist = d;
    }
    return Math.sqrt(minDist) < halfWidth;
  }

  // Find nearest point index on path
  function nearestPointIdx(pt, trackPts) {
    let minDist = Infinity, idx = 0;
    for (let i = 0; i < trackPts.length; i++) {
      const dx = pt.x - trackPts[i].x, dy = pt.y - trackPts[i].y;
      const d = dx*dx + dy*dy;
      if (d < minDist) { minDist = d; idx = i; }
    }
    return idx;
  }

  // ── Track Definitions ─────────────────────────────────
  // Each track has:
  //   id, name, tag, laps, halfWidth, aiCount, aiSpeed multiplier
  //   ctrlPts: control points for the spline
  //   checkpoints: progress values (0-1) where checkpoint gates are
  //   boostPads: [{progress, lane}]  lane -1=left, 0=center, 1=right
  //   startProgress: where on the track cars start
  //   bgColor, roadColor, borderColor, grassColor
  //   unlockCost, champPoints

  const TRACK_DEFS = [
    // ── TRACK 0: Neon Valley (easy) ──────────────────────
    {
      id: 0,
      name: 'NEON VALLEY',
      description: 'A gentle oval. Perfect for beginners.',
      tag: 'easy',
      laps: 3,
      halfWidth: 72,
      aiCount: 3,
      aiSpeedMult: 0.82,
      startProgress: 0.0,
      unlockCost: 0,
      reward: [200, 120, 60, 20],
      champPts: [10, 7, 4, 1],
      bgColor: '#071020',
      roadColor: '#1a2535',
      borderColor: '#00f5ff',
      grassColor: '#0a1a12',
      ctrlPts: [
        {x:600,y:560},{x:850,y:580},{x:1050,y:500},{x:1100,y:320},
        {x:900,y:200},{x:600,y:300},{x:480,y:170},{x:320,y:220},
        {x:280,y:380},{x:400,y:500}
      ],
      checkpoints: [0.12, 0.3, 0.55, 0.75],
      boostPads: [
        {progress:0.22, lane:0},
        {progress:0.65, lane:0},
      ],
    },
    // ── TRACK 1: Acid Circuit (medium) ───────────────────
    {
      id: 1,
      name: 'ACID CIRCUIT',
      description: 'Tight hairpins. Watch your speed.',
      tag: 'medium',
      laps: 3,
      halfWidth: 66,
      aiCount: 4,
      aiSpeedMult: 0.90,
      startProgress: 0.0,
      unlockCost: 500,
      reward: [380, 220, 110, 40],
      champPts: [12, 8, 5, 2],
      bgColor: '#0d0a18',
      roadColor: '#1e1530',
      borderColor: '#bf5fff',
      grassColor: '#0e0820',
      ctrlPts: [
        {x:1000,y:160},{x:1100,y:280},{x:1080,y:420},{x:950,y:520},
        {x:800,y:480},{x:750,y:360},{x:650,y:320},{x:550,y:440},
        {x:400,y:500},{x:280,y:420},{x:240,y:290},{x:350,y:180},
        {x:480,y:200},{x:600,y:280},{x:850,y:200}
      ],
      checkpoints: [0.1, 0.28, 0.48, 0.65, 0.82],
      boostPads: [
        {progress:0.18, lane: 0},
        {progress:0.55, lane:-1},
        {progress:0.78, lane: 1},
      ],
    },
    // ── TRACK 2: Pixel Storm (medium-hard) ───────────────
    {
      id: 2,
      name: 'PIXEL STORM',
      description: 'High speed straights and surprise chicanes.',
      tag: 'medium',
      laps: 4,
      halfWidth: 62,
      aiCount: 4,
      aiSpeedMult: 0.95,
      startProgress: 0.0,
      unlockCost: 1200,
      reward: [550, 320, 160, 60],
      champPts: [15, 10, 6, 2],
      bgColor: '#0a1400',
      roadColor: '#141e08',
      borderColor: '#06d6a0',
      grassColor: '#081400',
      ctrlPts: [
        {x:400,y:380},{x:300,y:480},{x:200,y:420},{x:180,y:300},
        {x:280,y:200},{x:430,y:160},{x:600,y:250},{x:900,y:140},
        {x:1150,y:200},{x:1200,y:380},{x:1100,y:500},{x:900,y:560},
        {x:750,y:460},{x:750,y:340},{x:650,y:280},{x:500,y:280}
      ],
      checkpoints: [0.1, 0.25, 0.45, 0.6, 0.75, 0.9],
      boostPads: [
        {progress:0.12, lane: 0},
        {progress:0.42, lane: 1},
        {progress:0.72, lane:-1},
        {progress:0.88, lane: 0},
      ],
    },
    // ── TRACK 3: Chrome Wastes (hard) — clean desert ribbon ──
    {
      id: 3,
      name: 'CHROME WASTES',
      description: 'Sweeping desert circuit. Fast straights, punishing chicanes.',
      tag: 'hard',
      laps: 4,
      halfWidth: 56,
      aiCount: 5,
      aiSpeedMult: 1.0,
      startProgress: 0.0,
      unlockCost: 2500,
      reward: [800, 480, 240, 80],
      champPts: [18, 12, 7, 2],
      bgColor: '#140a00',
      roadColor: '#1c1008',
      borderColor: '#ffbe0b',
      grassColor: '#0c0a04',
      ctrlPts: [
        {x:980,y:150},{x:1180,y:200},{x:1280,y:330},{x:1260,y:480},
        {x:1150,y:580},{x:980,y:610},{x:800,y:570},{x:660,y:480},
        {x:580,y:360},{x:560,y:240},{x:620,y:160},{x:720,y:180}
      ],
      checkpoints: [0.1, 0.25, 0.42, 0.58, 0.72, 0.88],
      boostPads: [
        {progress:0.15, lane: 0},
        {progress:0.35, lane: 1},
        {progress:0.55, lane:-1},
        {progress:0.75, lane: 0},
        {progress:0.92, lane: 0},
      ],
    },
    // ── TRACK 4: FINAL – Grand Neon Prix (championship) ──
    {
      id: 4,
      name: 'GRAND NEON PRIX',
      description: '★ CHAMPIONSHIP FINAL ★  Win to become Champion.',
      tag: 'champ',
      laps: 5,
      halfWidth: 58,
      aiCount: 5,
      aiSpeedMult: 1.05,
      startProgress: 0.0,
      unlockCost: 5000,
      reward: [1500, 900, 450, 150],
      champPts: [25, 18, 10, 3],
      bgColor: '#05000f',
      roadColor: '#100820',
      borderColor: '#ff006e',
      grassColor: '#050010',
      ctrlPts: [
        {x:820,y:600},{x:1020,y:630},{x:1200,y:580},{x:1320,y:470},
        {x:1340,y:310},{x:1200,y:180},{x:980,y:140},{x:720,y:200},
        {x:460,y:180},{x:420,y:300},{x:500,y:420},{x:640,y:530}
      ],
      checkpoints: [0.08,0.2,0.34,0.48,0.62,0.76,0.9],
      boostPads: [
        {progress:0.12, lane: 0},
        {progress:0.28, lane: 1},
        {progress:0.45, lane:-1},
        {progress:0.62, lane: 0},
        {progress:0.78, lane: 1},
        {progress:0.92, lane:-1},
      ],
    },
    // ── TRACK 5: Cyber Docks (medium-hard) ───────────────
    {
      id: 5,
      name: 'CYBER DOCKS',
      description: 'Industrial port. Wide sweepers into a tight harbour loop.',
      tag: 'hard',
      laps: 3,
      halfWidth: 60,
      aiCount: 5,
      aiSpeedMult: 0.97,
      startProgress: 0.0,
      unlockCost: 1800,
      reward: [680, 400, 200, 70],
      champPts: [16, 11, 6, 2],
      bgColor: '#080c14',
      roadColor: '#101824',
      borderColor: '#fb5607',
      grassColor: '#060c10',
      ctrlPts: [
        {x:920,y:90},{x:1120,y:120},{x:1260,y:210},{x:1280,y:360},
        {x:1160,y:490},{x:960,y:550},{x:740,y:560},{x:520,y:560},
        {x:380,y:470},{x:400,y:330},{x:540,y:200},{x:720,y:110}
      ],
      checkpoints: [0.1, 0.25, 0.42, 0.58, 0.74, 0.9],
      boostPads: [
        {progress:0.1,  lane: 0},
        {progress:0.32, lane: 1},
        {progress:0.54, lane:-1},
        {progress:0.76, lane: 0},
      ],
    },
  ];

  // Build spline geometry for each track
  const builtTracks = TRACK_DEFS.map(def => {
    const pts = buildSpline(def.ctrlPts, 24);
    const dists = buildDistances(pts);
    const totalLen = dists[dists.length-1];

    // Build checkpoint gate data
    const gates = def.checkpoints.map((prog, idx) => {
      const pt = getPointAtProgress(pts, dists, prog);
      const perp = pt.angle + Math.PI/2;
      return {
        idx,
        progress: prog,
        cx: pt.x, cy: pt.y,
        angle: pt.angle,
        x1: pt.x + Math.cos(perp) * def.halfWidth,
        y1: pt.y + Math.sin(perp) * def.halfWidth,
        x2: pt.x - Math.cos(perp) * def.halfWidth,
        y2: pt.y - Math.sin(perp) * def.halfWidth,
      };
    });

    // Build boost pad data
    const boosts = def.boostPads.map(bp => {
      const pt = getPointAtProgress(pts, dists, bp.progress);
      const perp = pt.angle + Math.PI/2;
      const laneOff = bp.lane * (def.halfWidth * 0.45);
      return {
        progress: bp.progress,
        x: pt.x + Math.cos(perp) * laneOff,
        y: pt.y + Math.sin(perp) * laneOff,
        angle: pt.angle,
        width: 28, height: 52,
        active: true,
        timer: 0,
      };
    });

    return { ...def, pts, dists, totalLen, gates, boosts };
  });

  return {
    getAll: () => builtTracks,
    getById: id => builtTracks.find(t => t.id === id),
    buildSpline,
    buildDistances,
    getPointAtProgress,
    isOnTrack,
    nearestPointIdx,
    catmullRom,
  };
})();
