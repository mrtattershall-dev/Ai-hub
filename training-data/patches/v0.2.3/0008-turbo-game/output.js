// ═══════════════════════════════════════════════════════
//  GAME MODULE  –  Main loop, state, race orchestration
// ═══════════════════════════════════════════════════════

// ── Save System ───────────────────────────────────────
const SaveSystem = (() => {
  const KEY = 'turbodrift_save';
  const defaults = () => ({
    currency: 0,
    upgrades: { accel: 0, handling: 0, topSpeed: 0 },
    carUpgrades: {
      bruiser:   { accel: 0, handling: 0, topSpeed: 0 },
      speedster: { accel: 0, handling: 0, topSpeed: 0 },
      drifter:   { accel: 0, handling: 0, topSpeed: 0 },
    },
    unlockedCars: ['bruiser'],
    unlockedTracks: [0],
    selectedCar: 'bruiser',
    championship: null,
    totalRaces: 0,
    bestPositions: {},
    bestTimes: {},
    difficulty: 'medium',
    dailyChallenge: null,
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const d = defaults();
      const saved = JSON.parse(raw);
      // Deep-merge carUpgrades so new cars always have defaults
      const carUpgrades = { ...d.carUpgrades };
      if (saved.carUpgrades) {
        for (const k of Object.keys(d.carUpgrades)) {
          carUpgrades[k] = { ...d.carUpgrades[k], ...(saved.carUpgrades[k] || {}) };
        }
      } else if (saved.upgrades) {
        // Migrate legacy flat upgrades onto whatever car was selected
        const sel = saved.selectedCar || 'bruiser';
        if (carUpgrades[sel]) carUpgrades[sel] = { ...d.carUpgrades[sel], ...saved.upgrades };
      }
      // Migrate: existing saves get all cars unlocked so nobody loses progress
      const unlockedCars = saved.unlockedCars || ['bruiser', 'speedster', 'drifter'];
      return { ...d, ...saved, carUpgrades, unlockedCars };
    } catch(e) { return defaults(); }
  }

  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch(e) {}
  }

  function reset() {
    localStorage.removeItem(KEY);
  }

  return { load, save, reset, defaults };
})();

// ── Car unlock costs ─────────────────────────────────
const CAR_UNLOCK_COSTS = {
  bruiser:   0,
  speedster: 800,
  drifter:   1500,
};

// ── Daily Challenge ───────────────────────────────────
const DailyChallenge = (() => {
  function seededRand(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967295;
  }
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }
  function generate() {
    const key = todayKey();
    const allTracks = Tracks.getAll();
    const trackId  = allTracks[Math.floor(seededRand(key+'t') * allTracks.length)].id;
    const mode     = seededRand(key+'m') > 0.5 ? 'elimination' : 'normal';
    const cars     = ['bruiser','speedster','drifter'];
    const bonusCar = cars[Math.floor(seededRand(key+'c') * cars.length)];
    const bonusCR  = 300 + Math.floor(seededRand(key+'b') * 5) * 100;
    return { date: todayKey(), trackId, mode, bonusCar, bonusCR, completed: false };
  }
  function get() {
    const save = SaveSystem.load();
    const key  = todayKey();
    if (!save.dailyChallenge || save.dailyChallenge.date !== key) {
      const ch = generate();
      save.dailyChallenge = ch;
      SaveSystem.save(save);
      return ch;
    }
    return save.dailyChallenge;
  }
  function complete() {
    const save = SaveSystem.load();
    if (!save.dailyChallenge || save.dailyChallenge.completed) return 0;
    const bonus = save.dailyChallenge.bonusCR;
    save.dailyChallenge.completed = true;
    save.currency += bonus;
    SaveSystem.save(save);
    return bonus;
  }
  return { get, complete };
})();

// ── Main Game State Machine ────────────────────────────
const Game = (() => {

  // States: 'menu', 'countdown', 'racing', 'paused', 'results', 'gameover', 'victory'
  let state = 'menu';

  // Race data
  let track = null;
  let player = null;
  let aiCars = [];
  let aiAgents = [];
  let aiNames = [];
  let allCars = [];

  let raceTimer = 0;
  let prevPlayerLap = 1;
  let prevPlayerPlace = 1;

  // Race result
  let raceFinished = false;
  let finishOrder = [];

  // Loop
  let lastTime = 0;
  let rafId = null;

  // Championship mode
  let champMode = false;
  let champRaceQueue = [];
  let champRaceIdx = 0;
  let champPts = 0;

  // Race mode
  let raceMode = 'normal'; // 'normal' | 'elimination'

  // Elimination state
  const ELIM_INTERVAL = 30;  // seconds between eliminations
  let elimTimer = 0;          // counts up to ELIM_INTERVAL
  let elimWarning = false;    // true during last 5s warning
  let eliminatedCars = [];    // cars knocked out this race

  // ── Color palette for AI cars ─────────────────────────
  const AI_COLORS = [
    '#ff006e', '#bf5fff', '#06d6a0', '#fb5607',
    '#3a86ff', '#ffbe0b', '#ff4d6d', '#4cc9f0'
  ];

  // ── Init ─────────────────────────────────────────────
  function init() {
    // Audio init deferred to first user gesture – just initialize the module
    Input.init();
    Renderer.init();
    UI.showScreen('menu-screen');
    loop(0);
  }

  // ── Main loop ─────────────────────────────────────────
  function loop(timestamp) {
    rafId = requestAnimationFrame(loop);
    const raw = lastTime === 0 ? 0 : (timestamp - lastTime) / 1000;
    const dt = Math.min(raw, 0.033); // cap at 33ms — prevents physics explosion on tab resume
    lastTime = timestamp;

    Input.update();

    if (state === 'racing') {
      updateRace(dt);
      Renderer.frame(track, player, allCars, dt);
    } else if (state === 'countdown') {
      Renderer.frame(track, player, allCars, dt);
    }

    Particles.update(dt);
  }

  // ── Start Race ───────────────────────────────────────
  function startRace(trackId, isChamp, carClassId, mode = 'normal') {
    // Initialize audio on first user gesture
    try { Audio.init(); Audio.resume(); } catch(e) {}

    track = Tracks.getById(trackId);
    if (!track) return;
    // Reset boost pads for clean race start
    for (const pad of track.boosts) { pad.active = true; pad.timer = 0; }

    const save = SaveSystem.load();
    const selectedClass = carClassId || save.selectedCar || 'bruiser';
    const playerUpgrades = (save.carUpgrades && save.carUpgrades[selectedClass]) || save.upgrades || {};
    AI.setDifficulty(save.difficulty || 'medium');
    Particles.clear();

    // Create player car BEHIND the start line
    // Negative offset along heading = behind the line, so crossing it starts lap 1
    const startPt = Tracks.getPointAtProgress(track.pts, track.dists, track.startProgress);
    const perp = startPt.angle + Math.PI / 2;
    const BEHIND = 55; // px behind the line for player

    player = Physics.createCar(
      startPt.x + Math.cos(perp) * 20 - Math.cos(startPt.angle) * BEHIND,
      startPt.y + Math.sin(perp) * 20 - Math.sin(startPt.angle) * BEHIND,
      startPt.angle, true, playerUpgrades, 1, selectedClass
    );
    player.isPlayer = true;

    // Create AI cars staggered behind the start
    aiNames = AI.getNames(track.aiCount);
    aiCars = [];
    aiAgents = [];
    for (let i = 0; i < track.aiCount; i++) {
      const col = (i % 2) - 0.5;
      const row = Math.floor(i / 2) + 1;
      const laneW = 34;
      const rowDist = 52;
      const car = Physics.createCar(
        startPt.x + Math.cos(perp) * (col * laneW) - Math.cos(startPt.angle) * (BEHIND + row * rowDist),
        startPt.y + Math.sin(perp) * (col * laneW) - Math.sin(startPt.angle) * (BEHIND + row * rowDist),
        startPt.angle, false, {}, track.aiSpeedMult
      );
      car.color = AI_COLORS[i % AI_COLORS.length];
      car.aiName = aiNames[i];
      aiCars.push(car);
      aiAgents.push(AI.createAI(car, track, aiNames[i]));
    }

    allCars = [player, ...aiCars];
    raceTimer = 0;
    raceFinished = false;
    finishOrder = [];
    _resultsShown = false;
    prevPlayerLap = 1;
    prevPlayerPlace = 1;
    champMode = isChamp;
    raceMode = isChamp ? 'normal' : mode; // championship always normal
    elimTimer = 0;
    elimWarning = false;
    eliminatedCars = [];
    Drift.reset();

    state = 'countdown';

    // Flush any buffered key presses (e.g. Space spam before race start)
    Input.clear();

    // Hide all overlay screens, show HUD
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('hud').classList.remove('hidden');

    try { Audio.startEngine(); } catch(e) {}

    // Pick the most "notable" rival — highest ramming + aggression personality in the race
    const notableRival = aiNames.slice().sort((a, b) => {
      const pa = AI.getPersonality(a), pb = AI.getPersonality(b);
      const scoreA = (pa ? (pa.ramming || 0) + Math.abs(pa.aggOffset || 0) : 0);
      const scoreB = (pb ? (pb.ramming || 0) + Math.abs(pb.aggOffset || 0) : 0);
      return scoreB - scoreA;
    }).find(n => AI.getCallout(n));
    if (notableRival) {
      const p = AI.getPersonality(notableRival);
      setTimeout(() => {
        UI.showRivalCallout(notableRival, p ? p.icon : '⚡', AI.getCallout(notableRival), p ? p.color : '#ff006e');
      }, 2400);
    }

    UI.runCountdown(() => {
      state = 'racing';
      // Disable spawn zone for all cars the moment GO fires —
      // no lap/finish logic can trigger from the spawn area
      for (const car of allCars) car.spawnDisabled = true;
      try { Audio.startMusic(track.borderColor); } catch(e) {}
    });
  }

  // ── Race update ──────────────────────────────────────
  function updateRace(dt) {
    raceTimer += dt;

    // Player input
    Physics.update(player, dt, track,
      Input.accel(), Input.brake(), Input.left(), Input.right(), Input.boost()
    );

    // Drift combo scoring
    Drift.update(player, dt);

    // Engine sound
    try {
      const rpm = Math.min(1, player.speed / (player.stats.maxSpeed * 0.9));
      Audio.setEngineRPM(rpm, player.boostActive);
    } catch(e) {}

    // Boost spark
    if (player.boostActive && Math.random() < 0.4) {
      Particles.emitSparks(player.x, player.y, 2, player.color, 1.2);
    }

    // AI update
    for (let i = 0; i < aiAgents.length; i++) {
      const cmd = AI.update(aiAgents[i], dt, track, player);
      Physics.update(aiCars[i], dt, track, cmd.accel, cmd.brake, cmd.left, cmd.right, cmd.boost);
    }

    // Collisions
    Physics.resolveCarCollisions(allCars);
    Physics.updatePositions(allCars);

    // Elimination mode countdown
    if (raceMode === 'elimination') updateElimination(dt);

    // Lap detection for player
    if (player.lap !== prevPlayerLap && !player.finished) {
      UI.showLapFlash(player.lap, track.laps);
      Particles.screenShake(4, 0.25);
      prevPlayerLap = player.lap;
    }
    if (player.finished && !raceFinished) {
      Drift.finalize(player);
      Renderer.showLapFlash('FINISHED!');
      // Check if this is a new best before raceFinished is set
      const save = SaveSystem.load();
      const prevBest = save.bestTimes && save.bestTimes[track.id];
      if (!prevBest || player.finishTime < prevBest) {
        setTimeout(() => Renderer.showLapFlash('★ NEW BEST!'), 1200);
      }
    }

    // Place change feedback
    if (player.place !== prevPlayerPlace) {
      if (player.place < prevPlayerPlace) {
        Particles.screenShake(2, 0.15);
        Renderer.showLapFlash(`▲ ${player.place}${ordinalSuffix(player.place)} PLACE`);
      } else {
        Renderer.showLapFlash(`▼ ${player.place}${ordinalSuffix(player.place)} PLACE`);
      }
      prevPlayerPlace = player.place;
    }

    // Check finish (skipped in elimination — handled by updateElimination)
    if (raceMode !== 'elimination') checkRaceFinish();

    // Update HUD
    UI.updateHUD(player, track, raceTimer, champMode, champPts);
  }

  // ── Elimination mode ──────────────────────────────────
  function updateElimination(dt) {
    // Don't eliminate when only 2 cars remain — next elim would be the win
    const activeCars = allCars.filter(c => !c.finished && !c.eliminated);
    if (activeCars.length <= 2) return;

    elimTimer += dt;
    const remaining = ELIM_INTERVAL - elimTimer;

    // Warning flash in final 5 seconds
    const warnEl = document.getElementById('elim-warn');
    if (remaining <= 5 && remaining > 0) {
      if (!elimWarning) {
        elimWarning = true;
        Particles.screenShake(2, 0.15);
      }
      if (warnEl) {
        const activePlaces = allCars.filter(c => !c.finished && !c.eliminated);
        const lastPlace = activePlaces.length;
        const playerRank = player.place;
        const danger = playerRank >= lastPlace;
        warnEl.textContent = `ELIMINATION IN ${Math.ceil(remaining)}${danger ? ' ⚠ YOU\'RE LAST!' : ''}`;
        warnEl.classList.add('show');
        warnEl.style.color = danger ? '#fff' : '';
      }
    } else if (remaining > 5) {
      elimWarning = false;
      if (warnEl) warnEl.classList.remove('show');
    }

    if (elimTimer >= ELIM_INTERVAL) {
      elimTimer = 0;
      elimWarning = false;
      if (warnEl) warnEl.classList.remove('show');
      eliminateLastCar();
    }
  }

  function eliminateLastCar() {
    // Last place among non-finished, non-eliminated cars
    const active = allCars
      .filter(c => !c.finished && !c.eliminated)
      .sort((a, b) => b.place - a.place); // highest place number = last

    if (active.length === 0) return;
    const victim = active[0];
    victim.eliminated = true;
    victim.speed = 0;
    victim.vx = 0;
    victim.vy = 0;
    eliminatedCars.push(victim);

    const isPlayer = victim.isPlayer;
    const name = victim.aiName || 'YOU';

    Particles.emitSparks(victim.x, victim.y, 18, '#ff006e', 1.6);
    Particles.screenShake(6, 0.4);

    if (isPlayer) {
      // Player eliminated — short delay then game over
      state = 'results';
      Drift.finalize(player);
      try { Audio.stopEngine(); Audio.stopMusic(); } catch(e) {}
      const warnEl = document.getElementById('elim-warn');
      if (warnEl) { warnEl.textContent = 'YOU\'VE BEEN ELIMINATED!'; warnEl.classList.add('show'); }
      setTimeout(() => {
        if (warnEl) warnEl.classList.remove('show');
        UI.showGameOver('ELIMINATED!', `You finished in ${victim.place}${ordinalSuffix(victim.place)} place.<br>Drive faster next time.`);
      }, 2000);
    } else {
      Renderer.showLapFlash(`${name} ELIMINATED!`);
      // Check if only player remains
      const remaining = allCars.filter(c => !c.finished && !c.eliminated);
      if (remaining.length === 1 && remaining[0].isPlayer) {
        // Player wins!
        setTimeout(() => {
          raceFinished = true;
          state = 'results';
          player.finished = true;
          player.finishTime = raceTimer;
          Drift.finalize(player);
          try { Audio.stopEngine(); Audio.stopMusic(); } catch(e) {}
          showRaceResults();
        }, 800);
      }
    }
  }

  function ordinalSuffix(n) {
    const s = ['TH','ST','ND','RD'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  // ── Normal race finish check ──────────────────────────
  function checkRaceFinish() {
    if (raceFinished) return;

    // Collect newly finished cars
    for (const car of allCars) {
      if (car.finished && !finishOrder.find(f => f.car === car)) {
        finishOrder.push({ car, time: car.finishTime });
      }
    }

    // Player finished?
    if (player.finished && !raceFinished) {
      raceFinished = true;
      state = 'results';
      try { Audio.stopEngine(); Audio.stopMusic(); } catch(e) {}
      Particles.screenShake(6, 0.5);
      Particles.emitSparks(player.x, player.y, 20, '#ffbe0b', 1.5);

      // Give AI a moment then resolve results
      setTimeout(() => {
        for (const car of aiCars) {
          if (!finishOrder.find(f => f.car === car)) {
            car.finished = true;
            car.finishTime = player.finishTime + (Math.random() * 10 + 0.5);
            finishOrder.push({ car, time: car.finishTime });
          }
        }
        showRaceResults();
      }, 1200);
    }
  } // end checkRaceFinish

  let _resultsShown = false;
  function showRaceResults() {
    if (_resultsShown) return;
    _resultsShown = true;
    try {
    let results;

    if (raceMode === 'elimination') {
      // Build results: winner first, then eliminated cars in reverse order (last eliminated = 2nd)
      const survivorCars = allCars.filter(c => !c.eliminated);
      const survivors = survivorCars.map((c, i) => ({
        isPlayer: c.isPlayer,
        name: c.aiName || 'YOU',
        finishTime: raceTimer,
        place: i + 1,
        tag: i === 0 ? '🏆 WINNER' : '✓ SURVIVED',
        color: c.color,
      }));
      const eliminated = [...eliminatedCars].reverse().map((c, i) => ({
        isPlayer: c.isPlayer,
        name: c.aiName || 'YOU',
        finishTime: raceTimer,
        place: survivors.length + i + 1,
        tag: `ELIM #${eliminatedCars.length - i}`,
        color: c.color,
      }));
      results = [...survivors, ...eliminated].map((r, i) => ({ ...r, place: i + 1 }));
    } else {
      // Sort by finish time
      const order = [...finishOrder].sort((a, b) => a.time - b.time);
      results = order.map((f, i) => ({
        isPlayer: f.car.isPlayer,
        name: f.car.aiName || 'YOU',
        finishTime: f.time,
        color: f.car.color,
        place: i + 1,
      }));
    }

    const playerResult = results.find(r => r.isPlayer);
    const playerPlace  = playerResult ? playerResult.place : track.aiCount + 1;
    const earned = track.reward[Math.min(playerPlace - 1, track.reward.length - 1)] || 0;
    const ptsEarned = track.champPts[Math.min(playerPlace - 1, track.champPts.length - 1)] || 0;

    // Save currency + best time
    const save = SaveSystem.load();
    save.currency += earned;
    save.totalRaces = (save.totalRaces || 0) + 1;
    save.bestPositions[track.id] = Math.min(
      save.bestPositions[track.id] || 99, playerPlace
    );

    const prevBest = save.bestTimes[track.id] || Infinity;
    const playerTime = playerResult ? playerResult.finishTime : Infinity;
    const isNewBest = playerTime < prevBest;
    if (isNewBest) save.bestTimes[track.id] = playerTime;

    if (champMode) {
      champPts += ptsEarned;
      if (save.championship) {
        save.championship.points = champPts;
        save.championship.racesCompleted++;
        save.championship.bestFinish = Math.min(
          save.championship.bestFinish || 99, playerPlace
        );
      }
    }
    SaveSystem.save(save);

    // Build taunts per AI driver based on their result vs player
    const taunts = {};
    results.forEach(r => {
      if (r.isPlayer) return;
      const cat = r.place < playerPlace ? 'win' : r.place > playerPlace + 1 ? 'lose' : 'near';
      const line = AI.getTaunt(r.name, cat);
      if (line) taunts[r.name] = line;
    });

    // Daily challenge check
    let dailyBonus = 0;
    const dc = DailyChallenge.get();
    if (!dc.completed && dc.trackId === track.id && dc.mode === raceMode && playerPlace <= 3) {
      dailyBonus = DailyChallenge.complete();
    }

    UI.showResults(results, track, earned, champMode ? ptsEarned : 0, false, {
      isNewBest,
      prevBest: isFinite(prevBest) ? prevBest : null,
      playerTime,
      taunts,
      dailyBonus,
    });
    } catch(e) { console.error('showRaceResults error:', e); UI.showScreen('results-screen'); }
  }

  function afterResults() {
    if (champMode) {
      handleChampionshipNext();
    } else {
      UI.showScreen('garage-screen');
    }
  }

  // ── Championship flow ─────────────────────────────────
  function handleChampionshipNext() {
    const save = SaveSystem.load();
    const champ = save.championship;
    if (!champ) { UI.showScreen('garage-screen'); return; }

    champRaceIdx++;

    if (champPts < 0) {
      save.championship = null;
      SaveSystem.save(save);
      UI.showGameOver('ELIMINATED!', `You ran out of championship points.<br>Better luck next season!`);
      return;
    }

    if (champRaceIdx >= champRaceQueue.length) {
      // Championship over – check accumulated points to determine winner
      const playerResult = champPts > 0 ? 1 : 2; // simplified: if pts > 0, player wins
      if (playerResult === 1) {
        save.championship = null;
        SaveSystem.save(save);
        UI.showVictory(
          `You conquered the Grand Neon Prix Championship!<br>
          Final Points: <span style="color:var(--neon-yellow)">${champPts}</span><br>
          Total Races: ${save.totalRaces}`
        );
      } else {
        save.championship = null;
        SaveSystem.save(save);
        UI.showGameOver(
          'RUNNER UP',
          `You finished in the championship.<br>Points: ${champPts}<br>Try again to claim the top spot!`
        );
      }
      return;
    }

    // Next champ race
    startRace(champRaceQueue[champRaceIdx], true, SaveSystem.load().selectedCar || 'bruiser');
  }

  function startChampionship() {
    const save = SaveSystem.load();
    if (!save.unlockedTracks.includes(4)) return;
    champRaceQueue = [1, 2, 3, 4];
    champRaceIdx = 0;
    champPts = save.championship ? save.championship.points : 0;
    save.championship = {
      active: true,
      points: champPts,
      racesCompleted: save.championship ? save.championship.racesCompleted : 0,
      bestFinish: save.championship ? save.championship.bestFinish : null,
    };
    SaveSystem.save(save);
    startRace(champRaceQueue[0], true, save.selectedCar || 'bruiser');
  }

  // ── Pause ─────────────────────────────────────────────
  function togglePause() {
    if (state === 'racing') {
      state = 'paused';
      try { Audio.stopEngine(); Audio.stopMusic(); } catch(e) {}
      UI.showScreen('pause-screen');
    }
  }

  function resume() {
    if (state === 'paused') {
      state = 'racing';
      try { Audio.startEngine(); } catch(e) {}
      // Show game canvas, hide overlays, show HUD
      document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
      document.getElementById('hud').classList.remove('hidden');
    }
  }

  function restartRace() {
    try { Audio.playMenuSelect(); } catch(e) {}
    const save = SaveSystem.load();
    startRace(track.id, champMode, save.selectedCar || 'bruiser', raceMode);
  }

  function quitToMenu() {
    try { Audio.stopEngine(); Audio.playMenuBack(); } catch(e) {}
    state = 'menu';
    allCars = []; aiCars = []; aiAgents = [];
    Particles.clear();
    UI.showScreen('menu-screen');
  }

  function newGame() {
    SaveSystem.reset();
    quitToMenu();
  }

  return {
    init, startRace, startChampionship,
    togglePause, resume, restartRace, quitToMenu, newGame,
    afterResults,
    get state() { return state; },
    get raceTimer() { return raceTimer; },
    get track() { return track; },
    get elimTimer() { return elimTimer; },
    get raceMode() { return raceMode; },
    get ELIM_INTERVAL() { return ELIM_INTERVAL; },
    get allCars() { return allCars; },
    get player() { return player; },
    DailyChallenge,
    CAR_UNLOCK_COSTS,
  };
})();

// ── Bootstrap ────────────────────────────────────────

// Animated menu background — racing cars on a ghost track
(function menuBg() {
  const canvas = document.getElementById('menu-bg-canvas');
  if (!canvas) return;
  const ctx2 = canvas.getContext('2d');
  let w, h;

  function resize() {
    w = canvas.width  = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  // Simple ghost cars racing around a bezier oval
  const NUM_CARS = 8;
  const COLORS = ['#00f5ff','#ff006e','#ffbe0b','#06d6a0','#bf5fff','#fb5607','#3a86ff','#ff4d6d'];
  const cars = Array.from({length: NUM_CARS}, (_, i) => ({
    t: i / NUM_CARS,
    speed: 0.00018 + Math.random() * 0.00012,
    color: COLORS[i],
  }));

  function trackPoint(t) {
    // Simple figure-eight-ish oval in canvas coordinates
    const cx = w / 2, cy = h / 2;
    const rx = w * 0.38, ry = h * 0.30;
    const a = t * Math.PI * 2;
    return {
      x: cx + Math.cos(a) * rx,
      y: cy + Math.sin(a) * ry,
      dx: -Math.sin(a), dy: Math.cos(a),
    };
  }

  let last = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;

    ctx2.clearRect(0, 0, w, h);

    // Draw ghost track line
    ctx2.beginPath();
    for (let i = 0; i <= 120; i++) {
      const p = trackPoint(i / 120);
      i === 0 ? ctx2.moveTo(p.x, p.y) : ctx2.lineTo(p.x, p.y);
    }
    ctx2.closePath();
    ctx2.strokeStyle = 'rgba(0,245,255,0.15)';
    ctx2.lineWidth = 28;
    ctx2.stroke();
    ctx2.strokeStyle = 'rgba(0,245,255,0.06)';
    ctx2.lineWidth = 32;
    ctx2.stroke();

    // Move and draw cars
    for (const car of cars) {
      car.t = (car.t + car.speed * dt * 60) % 1;
      const p = trackPoint(car.t);
      ctx2.save();
      ctx2.translate(p.x, p.y);
      ctx2.rotate(Math.atan2(p.dy, p.dx) + Math.PI / 2);
      ctx2.globalAlpha = 0.55;
      ctx2.fillStyle = car.color;
      ctx2.shadowBlur = 8;
      ctx2.shadowColor = car.color;
      ctx2.beginPath();
      ctx2.moveTo(0, -7);
      ctx2.lineTo(4, 5);
      ctx2.lineTo(-4, 5);
      ctx2.closePath();
      ctx2.fill();
      ctx2.restore();
    }
  }
  requestAnimationFrame(frame);
})();

window.addEventListener('DOMContentLoaded', () => Game.init());
