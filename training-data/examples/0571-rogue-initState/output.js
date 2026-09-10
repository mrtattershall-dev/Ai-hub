function initState() {
  G = {
    running:   false,
    rouge:     100, maxRouge: 100,
    baseDrain: 5,              // rouge/sec with no grafts
    grafts:    ['',''],        // [primary, secondary] organ IDs
    graftDecay:[0, 0],         // seconds remaining on each graft
    attackCd:  0,              // seconds until next attack
    iframes:   0,              // player invincibility seconds (prevents damage stacking)
    px: 200, py: 200,          // player world position (pixels)
    pspeed: 112,               // pixels/sec base
    psize:  11,
    floorTransitioning: false, // guard against exit firing every frame
    enemies: [], particles: [], projectiles: [], corpses: [], organDrops: [],
    keys: {}, mx: W/2, my: H/2,
    floor: 1, kills: 0, graftsEquipped: 0, tilesTransformed: 0,
    ticks: 0, time: 0,
    hbTimer: 0,
    map: [], sat: [], chasmed: {}, doored: {}, genAwake: {}, ventActive: {},
    rooms: [],
    shakeMag: 0,
    synergy: null,   // active synergy ID string or null
    theme: 'lab',
    secretRoom: null,
    secretDropSpawned: false,
    boss: null,       // active boss entity or null
    bossPhase: 0,     // 0=none, 1/2/3 for sovereign phases
  };
}