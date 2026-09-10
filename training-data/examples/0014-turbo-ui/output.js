// ═══════════════════════════════════════════════════════
//  UI MODULE  –  Screen management, HUD, Garage, Shop
// ═══════════════════════════════════════════════════════
const UI = (() => {

  let selectedTrackId = 0;
  let activeTab = 'tracks';
  let raceMode = 'normal'; // 'normal' | 'elimination'
  let audioReady = false; // true after first user interaction

  const MODE_DESCS = {
    normal:      'Standard race — finish all laps.',
    elimination: 'Every 30s the last car is OUT. Survive to win.',
  };

  function setRaceMode(mode) {
    audioReady = true;
    raceMode = mode;
    document.getElementById('mode-btn-normal').className = 'mode-btn' + (mode === 'normal' ? ' active' : '');
    document.getElementById('mode-btn-elim').className   = 'mode-btn' + (mode === 'elimination' ? ' elim-active' : '');
    document.getElementById('mode-desc').textContent = MODE_DESCS[mode] || '';
    try { Audio.playMenuSelect(); } catch(e) {}
  }

  // ── Screen management ─────────────────────────────────
  function showScreen(id) {
    // Any manual navigation = user has interacted, audio is safe
    if (id !== 'menu-screen') audioReady = true;
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const hud = document.getElementById('hud');

    if (id === null) {
      // Null means "show game" – hide all overlays, show HUD
      hud.classList.remove('hidden');
    } else {
      const el = document.getElementById(id);
      if (el) el.classList.remove('hidden');
      hud.classList.add('hidden');
    }

    // Refresh garage if opened
    if (id === 'garage-screen') refreshGarage();

    // Safe audio resume – only if AudioContext exists and is suspended
    try { Audio.resume(); } catch(e) {}

    if (audioReady) { try { Audio.playMenuSelect(); } catch(e) {} }
  }

  function showHUD(show) {
    document.getElementById('hud').classList.toggle('hidden', !show);
  }

  // ── HUD updates ───────────────────────────────────────
  function updateHUD(player, track, raceTimer, champMode, champPts) {
    const kmh = Math.round(player.speed * 0.28);
    document.getElementById('hud-speed').textContent = kmh + ' KM/H';

    const totalLaps = track.laps;
    const curLap = Math.min(player.lap, totalLaps);
    document.getElementById('hud-lap').textContent = `${curLap} / ${totalLaps}`;

    const pos = player.place;
    document.getElementById('hud-pos').textContent = pos;
    const suffixes = ['','ST','ND','RD','TH','TH','TH','TH'];
    document.getElementById('hud-pos-suf').textContent = suffixes[pos] || 'TH';

    // Timer
    const t = raceTimer;
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    const ms  = Math.floor((t % 1) * 10);
    document.getElementById('hud-time').textContent = `${min}:${String(sec).padStart(2,'0')}.${ms}`;

    // Boost bar
    const boostPct = (player.boost / player.stats.boostMax) * 100;
    document.getElementById('boost-bar').style.width = boostPct + '%';
    document.getElementById('boost-bar').style.background =
      player.boostActive ? '#ffffff' : (player.color || '#ff006e');

    // Car class label
    const cls = Physics.CAR_CLASSES[player.carClass];
    const clsLabel = document.getElementById('car-class-label');
    if (clsLabel && cls) {
      clsLabel.textContent = cls.icon + ' ' + cls.label;
      clsLabel.style.color = cls.color;
    }

    // Championship bar
    const champBar = document.getElementById('champ-bar-wrap');
    if (champMode) {
      champBar.style.display = 'flex';
      document.getElementById('champ-pts-val').textContent = champPts + ' PTS';
    } else {
      champBar.style.display = 'none';
    }

    // Elimination timer bar
    const elimWrap = document.getElementById('elim-bar-wrap');
    const elimBar  = document.getElementById('elim-bar');
    const elimLabel = document.getElementById('elim-bar-label');
    if (elimWrap && elimBar) {
      const isElim = Game.raceMode === 'elimination';
      elimWrap.style.display = isElim ? 'block' : 'none';
      if (isElim) {
        const pct = Math.max(0, 1 - Game.elimTimer / Game.ELIM_INTERVAL);
        elimBar.style.width = (pct * 100) + '%';
        const secsLeft = Math.ceil((1 - pct) * Game.ELIM_INTERVAL);
        const danger = pct < 0.2;
        elimBar.style.background = danger ? '#fff' : 'var(--neon-pink)';
        if (elimLabel) elimLabel.textContent = `ELIM ${Math.ceil(Game.ELIM_INTERVAL - Game.elimTimer)}s`;
      }
    }

    // Live race leaderboard
    updateLeaderboard(player, track);

    // Drift combo meter
    const driftMeter = document.getElementById('drift-meter');
    if (driftMeter) {
      const d = Drift.getHUD();
      driftMeter.style.opacity = d.alpha.toFixed(3);

      // Bar fill: progress within current multiplier tier
      const thr = d.thresholds;
      const tierMin = thr[d.multiplier - 1] || 0;
      const tierMax = thr[d.multiplier] || tierMin + 1500;
      const pct = Math.min(100, ((d.score - tierMin) / (tierMax - tierMin)) * 100);
      document.getElementById('drift-bar').style.width = pct + '%';
      document.getElementById('drift-score-val').textContent = d.score;
      document.getElementById('drift-mult').textContent = 'x' + d.multiplier;

      // Tier colour class
      driftMeter.className = d.multiplier > 1 ? 'mult' + d.multiplier : '';
    }
  }

  // ── Live Race Leaderboard ────────────────────────────
  function updateLeaderboard(player, track) {
    const wrap = document.getElementById('race-leaderboard');
    const rowsEl = document.getElementById('race-lb-rows');
    if (!wrap || !rowsEl) return;

    // Only show during racing
    const isRacing = Game.state === 'racing' || Game.state === 'countdown';
    wrap.style.display = isRacing ? 'block' : 'none';
    if (!isRacing) return;

    // Build sorted list — use Physics.updatePositions output (car.place)
    // We need to get allCars from somewhere — use a trick: we know player + we 
    // get updated on each HUD call. Store last known via closure.
    // Actually updateHUD receives player but not allCars.
    // We'll read from the DOM if we can't access allCars directly.
    // Best approach: expose allCars from Game module (add getter).
    const cars = Game.allCars;
    if (!cars || cars.length === 0) return;

    // Sort: non-eliminated by place, then eliminated (in elim order)
    const active = cars.filter(c => !c.eliminated).sort((a,b) => a.place - b.place);
    const elimed = cars.filter(c => c.eliminated);
    const sorted = [...active, ...elimed];

    rowsEl.innerHTML = '';
    sorted.forEach((car, i) => {
      const isPlayer = car.isPlayer;
      const isElim = car.eliminated;
      const row = document.createElement('div');
      row.className = 'lb-row' + (isPlayer ? ' lb-player' : '') + (isElim ? ' lb-elim' : '');

      const posText = isElim ? '✕' : (car.place || i + 1);
      const nameText = isPlayer ? 'YOU' : (car.aiName || 'AI');

      row.innerHTML = `
        <div class="lb-pos">${posText}</div>
        <div class="lb-dot" style="background:${car.color || '#ff006e'}"></div>
        <div class="lb-name${isPlayer ? ' lb-you' : ''}">${nameText}</div>
      `;
      rowsEl.appendChild(row);
    });
  }

  function showLapFlash(lap, total) {
    if (lap > total) {
      Renderer.showLapFlash('FINAL LAP!');
    } else {
      Renderer.showLapFlash(`LAP ${lap}/${total}`);
    }
  }

  // ── Countdown ─────────────────────────────────────────
  async function runCountdown(cb) {
    const steps = ['3','2','1','GO!'];
    for (let i = 0; i < steps.length; i++) {
      await sleep(i === 0 ? 0 : 900);
      Renderer.showCountdown(steps[i]);
      try {
        if (i < 3) Audio.playCountdownTick();
        else       Audio.playCountdownGo();
      } catch(e) {}
    }
    await sleep(600);
    cb();
  }

  // ── Garage / Tabs ─────────────────────────────────────
  function garageTab(tab) {
    audioReady = true;
    activeTab = tab;
    ['tracks','cars','upgrades','champ'].forEach(t => {
      const content = document.getElementById('tab-content-' + t);
      const btn = document.getElementById('tab-' + t);
      if (content) content.style.display = t === tab ? '' : 'none';
      if (btn) btn.classList.toggle('active', t === tab);
    });
    refreshGarage();
    try { Audio.playMenuSelect(); } catch(e) {}
  }

  function refreshGarage() {
    const save = SaveSystem.load();
    document.getElementById('garage-currency').textContent = `💰 ${save.currency} CR`;

    if (activeTab === 'tracks') renderTrackList(save);
    if (activeTab === 'cars') renderCarSelect(save);
    if (activeTab === 'upgrades') renderUpgrades(save);
    if (activeTab === 'champ') renderChamp(save);
  }

  function renderCarSelect(save) {
    const container = document.getElementById('car-select-list');
    if (!container) return;
    container.innerHTML = '';
    const selected  = save.selectedCar || 'bruiser';
    const unlocked  = save.unlockedCars || ['bruiser'];
    const costs     = Game.CAR_UNLOCK_COSTS;
    const ORDER     = ['bruiser','speedster','drifter'];

    ORDER.forEach(id => {
      const cls        = Physics.CAR_CLASSES[id];
      if (!cls) return;
      const isUnlocked = unlocked.includes(id);
      const isSelected = id === selected && isUnlocked;
      const cost       = costs[id] || 0;
      const canAfford  = save.currency >= cost;

      const s        = cls.stats;
      const maxSpd   = Math.round((s.maxSpeed    / 420) * 100);
      const accel    = Math.round((s.acceleration / 560) * 100);
      const handling = Math.round((s.turnSpeed   / 3.8) * 100);
      const drift    = Math.round(((s.driftFactor - 0.8) / 0.18) * 100);

      const item = document.createElement('div');
      item.style.cssText = [
        'display:flex;align-items:flex-start;justify-content:space-between;',
        `border:1px solid ${isSelected ? cls.color : isUnlocked ? 'rgba(0,245,255,0.2)' : 'rgba(255,255,255,0.06)'};`,
        'padding:0.7rem 1rem;margin-bottom:0.5rem;',
        'background:rgba(0,10,25,0.5);',
        `opacity:${isUnlocked ? 1 : 0.7};`,
        isUnlocked ? 'cursor:pointer;' : '',
        'transition:all 0.15s;',
      ].join('');

      const badge = isSelected
        ? `<span style="font-family:var(--font-head);font-size:0.6rem;color:var(--neon-green);padding:2px 7px;border:1px solid var(--neon-green)">ACTIVE</span>`
        : (id === 'bruiser' && isUnlocked
            ? `<span style="font-size:0.6rem;color:#556;padding:2px 7px;border:1px solid #334">STARTER</span>`
            : '');

      const lockBtn = !isUnlocked
        ? `<button class="btn ${canAfford ? 'green' : ''}" style="font-size:0.65rem;padding:0.2em 0.8em;margin-top:0.5rem;"
             ${!canAfford ? 'disabled' : ''} onclick="UI.buyCar('${id}');event.stopPropagation()">
             <span>&#x1F512; ${cost} CR</span></button>`
        : '';

      item.innerHTML =
        `<div style="flex:1">` +
          `<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.3rem;flex-wrap:wrap">` +
            `<span style="font-size:1.1rem;color:${cls.color}">${cls.icon}</span>` +
            `<span style="font-family:var(--font-head);font-size:0.9rem;color:${cls.color}">${cls.label}</span>` +
            (!isUnlocked
              ? `<span style="font-size:0.7rem;color:#ff006e">LOCKED</span>`
              : badge) +
          `</div>` +
          `<div style="font-size:0.7rem;color:#778;margin-bottom:0.5rem">${cls.desc}</div>` +
          `<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 1rem">` +
            statBar('TOP SPEED', maxSpd, cls.color) +
            statBar('ACCEL',     accel,  cls.color) +
            statBar('HANDLING',  handling, cls.color) +
            statBar('DRIFT',     drift,  cls.color) +
          `</div>` +
          lockBtn +
        `</div>`;

      if (isUnlocked) {
        item.addEventListener('click', () => {
          const sv = SaveSystem.load();
          sv.selectedCar = id;
          SaveSystem.save(sv);
          try { Audio.playMenuSelect(); } catch(e) {}
          renderCarSelect(sv);
        });
      }
      container.appendChild(item);
    });
  }
  function statBar(label, pct, color) {
    return `
      <div>
        <div style="font-size:0.6rem;color:#557;letter-spacing:0.1em;margin-bottom:2px">${label}</div>
        <div style="height:5px;background:rgba(255,255,255,0.07);position:relative">
          <div style="height:100%;width:${pct}%;background:${color};opacity:0.85"></div>
        </div>
      </div>
    `;
  }

  function renderTrackList(save) {
    const container = document.getElementById('track-list');
    container.innerHTML = '';

    // ── Difficulty selector ──
    const diffWrap = document.createElement('div');
    diffWrap.style.cssText = 'margin-bottom:0.9rem;padding:0.75rem;background:rgba(0,10,25,0.5);border:1px solid rgba(0,245,255,0.12);';
    const curDiff = save.difficulty || 'medium';
    const diffOpts = [
      { key:'easy',   label:'EASY',   color:'#06d6a0', desc:'82% speed · heavy catch-up' },
      { key:'medium', label:'MEDIUM', color:'#ffbe0b', desc:'Balanced challenge' },
      { key:'hard',   label:'HARD',   color:'#fb5607', desc:'110% speed · minimal rubber-band' },
      { key:'expert', label:'EXPERT', color:'#ff006e', desc:'120% speed · near-perfect AI' },
    ];
    diffWrap.innerHTML =
      `<div style="font-size:0.68rem;color:#557;letter-spacing:0.1em;margin-bottom:0.5rem">AI DIFFICULTY</div>` +
      `<div style="display:flex;gap:5px">` +
      diffOpts.map(d => {
        const active = d.key === curDiff;
        return `<button onclick="UI.setDifficulty('${d.key}')" style="flex:1;padding:5px 2px;font-family:var(--font-head);font-size:0.6rem;cursor:pointer;letter-spacing:0.04em;` +
          `background:${active?'rgba(255,255,255,0.07)':'rgba(0,10,25,0.6)'};` +
          `border:1px solid ${active?d.color:'rgba(0,245,255,0.12)'};color:${active?d.color:'#557'}" title="${d.desc}">${d.label}</button>`;
      }).join('') +
      `</div><div style="font-size:0.62rem;color:#445;margin-top:4px">${(diffOpts.find(d=>d.key===curDiff)||{}).desc||''}</div>`;
    container.appendChild(diffWrap);

    // ── Daily challenge ──
    const dc = Game.DailyChallenge.get();
    const dcTrack = Tracks.getById(dc.trackId);
    if (dcTrack) {
      const dcWrap = document.createElement('div');
      const done = dc.completed;
      dcWrap.style.cssText = `margin-bottom:0.9rem;padding:0.8rem 1rem;` +
        `background:${done?'rgba(6,214,160,0.05)':'rgba(255,190,11,0.06)'};` +
        `border:1px solid ${done?'#06d6a0':'#ffbe0b'};`;
      const modeIcon = dc.mode === 'elimination' ? '✕' : '⚑';
      dcWrap.innerHTML =
        `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem">` +
          `<div>` +
            `<div style="font-family:var(--font-head);font-size:0.68rem;letter-spacing:0.12em;color:${done?'#06d6a0':'#ffbe0b'};margin-bottom:3px">` +
              (done ? '✓ DAILY COMPLETE' : '★ DAILY CHALLENGE') +
            `</div>` +
            `<div style="font-size:0.78rem;color:#ccd;font-family:var(--font-head)">${dcTrack.name}</div>` +
            `<div style="font-size:0.62rem;color:#667;margin-top:2px">${modeIcon} ${dc.mode.toUpperCase()}</div>` +
          `</div>` +
          `<div style="text-align:right;flex-shrink:0">` +
            `<div style="font-family:var(--font-head);font-size:1rem;color:${done?'#06d6a0':'#ffbe0b'}">+${dc.bonusCR} CR</div>` +
            `<div style="font-size:0.58rem;color:#445">TOP 3 FINISH</div>` +
          `</div>` +
        `</div>` +
        (!done ? `<button class="btn yellow" style="font-size:0.65rem;padding:0.25em 0.9em;margin-top:0.6rem;width:100%" onclick="UI.launchDailyChallenge()"><span>&#x25B6; RACE NOW</span></button>` : '');
      container.appendChild(dcWrap);
    }

    const tracks = Tracks.getAll();

    tracks.forEach(track => {
      const unlocked = save.unlockedTracks.includes(track.id);
      const canBuy   = !unlocked && save.currency >= track.unlockCost;
      const item = document.createElement('div');
      item.className = `track-item ${!unlocked ? 'locked' : ''} ${selectedTrackId === track.id && unlocked ? 'selected' : ''}`;

      let tagClass = 'tag-' + track.tag;
      let tagLabel = track.tag.toUpperCase();
      if (!unlocked) { tagClass = 'tag-locked'; }

      item.innerHTML = `
        <div>
          <div class="track-name">${track.name}</div>
          <div class="track-meta">${track.laps} LAPS · ${track.aiCount} RIVALS · ${track.description}</div>
          ${unlocked && save.bestTimes && save.bestTimes[track.id]
            ? `<div style="font-size:0.7rem;color:var(--neon-yellow);margin-top:3px">★ BEST: ${formatTime(save.bestTimes[track.id])}</div>`
            : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <span class="track-tag ${tagClass}">${tagLabel}</span>
          ${!unlocked ? `<button class="btn yellow" style="font-size:0.65rem;padding:0.2em 0.7em" ${!canBuy?'disabled':''} onclick="UI.buyTrack(${track.id});event.stopPropagation()">
            <span>🔒 ${track.unlockCost} CR</span></button>` : ''}
        </div>
      `;

      if (unlocked) {
        item.addEventListener('click', () => {
          selectedTrackId = track.id;
          renderTrackList(save);
          try { Audio.playMenuSelect(); } catch(e) {}
        });
      }
      container.appendChild(item);
    });

    // Race button state
    const raceBtn = document.getElementById('race-btn');
    raceBtn.disabled = !save.unlockedTracks.includes(selectedTrackId);
  }

  let upgradeViewCar = null;

  function renderUpgrades(save) {
    const container = document.getElementById('upgrade-grid');
    container.innerHTML = '';
    const carId  = upgradeViewCar || save.selectedCar || 'bruiser';
    const cls    = Physics.CAR_CLASSES[carId];
    const defs   = Physics.UPGRADE_DEFS[carId] || Physics.UPGRADE_DEFS.bruiser;
    const carUps = (save.carUpgrades && save.carUpgrades[carId]) || { accel:0, handling:0, topSpeed:0 };

    // Car switcher
    const sw = document.createElement('div');
    sw.style.cssText = 'display:flex;gap:6px;margin-bottom:0.9rem;';
    ['bruiser','speedster','drifter'].forEach(id => {
      const c = Physics.CAR_CLASSES[id];
      if (!c) return;
      const active = id === carId;
      const btn = document.createElement('button');
      btn.style.cssText = [
        'flex:1;padding:5px 4px;font-family:var(--font-head);font-size:0.62rem;cursor:pointer;letter-spacing:0.05em;',
        `background:${active ? 'rgba(255,255,255,0.08)' : 'rgba(0,10,25,0.6)'};`,
        `border:1px solid ${active ? c.color : 'rgba(0,245,255,0.12)'};`,
        `color:${active ? c.color : '#557'};`,
      ].join('');
      btn.textContent = c.icon + ' ' + c.label;
      btn.onclick = () => { upgradeViewCar = id; renderUpgrades(SaveSystem.load()); try { Audio.playMenuSelect(); } catch(e) {} };
      sw.appendChild(btn);
    });
    container.appendChild(sw);

    // Active indicator
    const hdr = document.createElement('div');
    hdr.style.cssText = 'margin-bottom:0.8rem;font-size:0.72rem;color:#557;letter-spacing:0.1em;';
    const isActive = carId === (save.selectedCar || 'bruiser');
    hdr.innerHTML = `UPGRADES FOR <span style="color:${cls.color};font-family:var(--font-head)">${cls.icon} ${cls.label}</span>` +
      (isActive ? ` <span style="color:var(--neon-green);font-size:0.62rem;padding:1px 6px;border:1px solid var(--neon-green)">ACTIVE</span>` : '');
    container.appendChild(hdr);

    for (const def of defs) {
      const level = carUps[def.key] || 0;
      const maxed = level >= def.max;
      const cost  = def.cost * (level + 1);
      const canAfford = save.currency >= cost && !maxed;

      const row = document.createElement('div');
      row.className = 'upgrade-row';
      row.style.cssText = 'flex-direction:column;align-items:stretch;gap:0.4rem;';
      row.innerHTML =
        `<div style="display:flex;align-items:center;justify-content:space-between;gap:1rem">` +
          `<div>` +
            `<div class="upgrade-label" style="color:${cls.color}">${def.label}</div>` +
            `<div style="font-size:0.68rem;color:#556;margin-top:1px">${def.desc}</div>` +
          `</div>` +
          `<div style="display:flex;align-items:center;gap:0.6rem">` +
            `<div style="font-size:0.75rem;color:${cls.color};width:36px;text-align:center">${level}/${def.max}</div>` +
            `<button class="btn ${canAfford?'green':''}" style="font-size:0.65rem;padding:0.2em 0.8em;min-width:80px"` +
              ` ${!canAfford?'disabled':''} onclick="UI.buyUpgrade('${def.key}','${def.cost}','${carId}')">` +
              `<span>${maxed ? 'MAX' : cost + ' CR'}</span></button>` +
          `</div>` +
        `</div>` +
        `<div class="upgrade-bar-wrap"><div class="upgrade-bar" style="width:${(level/def.max)*100}%;background:${cls.color}"></div></div>`;
      container.appendChild(row);
    }
  }
  function renderChamp(save) {
    const el = document.getElementById('champ-status');
    const inChamp = save.championship && save.championship.active;

    if (!inChamp) {
      el.innerHTML = `
        <div style="color:#aac;margin-bottom:1rem">
          The Grand Neon Prix Championship is a 4-race series.<br>
          Complete all qualifying tracks to unlock it.<br><br>
          <span style="color:var(--neon-yellow)">GRAND NEON PRIX</span> unlocks at <span style="color:var(--neon-cyan)">5000 CR</span>.<br>
          Earn points each race. Win to become Champion!
        </div>
        <div style="color:#556;font-size:0.8rem">
          Points: 1ST=25 · 2ND=18 · 3RD=10 · 4TH=3
        </div>
      `;
    } else {
      const c = save.championship;
      el.innerHTML = `
        <div style="color:var(--neon-yellow);font-family:var(--font-head);margin-bottom:0.8rem">CHAMPIONSHIP ACTIVE</div>
        <div style="color:#aac;font-size:0.85rem;line-height:2">
          Points: <span style="color:var(--neon-green)">${c.points}</span><br>
          Races completed: <span style="color:var(--neon-cyan)">${c.racesCompleted}/4</span><br>
          Best finish: <span style="color:var(--neon-yellow)">${c.bestFinish ? ordinal(c.bestFinish) : '-'} place</span>
        </div>
        <div style="margin-top:0.8rem;color:#556;font-size:0.8rem">
          ${c.points < 0 ? '<span style="color:var(--neon-pink)">WARNING: Championship points eliminated!</span>' : 'Keep racing to earn more points.'}
        </div>
      `;
    }
  }

  function ordinal(n) {
    const s = ['th','st','nd','rd'];
    const v = n % 100;
    return n + (s[(v-20)%10] || s[v] || s[0]);
  }

  // ── Buy functions ─────────────────────────────────────
  function buyTrack(id) {
    const save = SaveSystem.load();
    const track = Tracks.getById(id);
    if (!track || save.unlockedTracks.includes(id)) return;
    if (save.currency < track.unlockCost) return;
    save.currency -= track.unlockCost;
    save.unlockedTracks.push(id);
    SaveSystem.save(save);
    selectedTrackId = id;
    try { Audio.playUpgrade(); } catch(e) {}
    refreshGarage();
  }

  function buyCar(carId) {
    const save = SaveSystem.load();
    const cost = (Game.CAR_UNLOCK_COSTS || {})[carId] || 0;
    if (!cost || save.currency < cost) return;
    if (!save.unlockedCars) save.unlockedCars = ['bruiser'];
    if (save.unlockedCars.includes(carId)) return;
    save.currency -= cost;
    save.unlockedCars.push(carId);
    save.selectedCar = carId;
    SaveSystem.save(save);
    try { Audio.playUpgrade(); } catch(e) {}
    refreshGarage();
  }

  function buyUpgrade(key, baseCost, carId) {
    const save = SaveSystem.load();
    const id = carId || upgradeViewCar || save.selectedCar || 'bruiser';
    if (!save.carUpgrades) save.carUpgrades = {};
    if (!save.carUpgrades[id]) save.carUpgrades[id] = { accel:0, handling:0, topSpeed:0 };
    const level = save.carUpgrades[id][key] || 0;
    const cost = parseInt(baseCost) * (level + 1);
    if (save.currency < cost || level >= 5) return;
    save.currency -= cost;
    save.carUpgrades[id][key] = level + 1;
    // Keep legacy flat upgrades in sync for selected car
    if (id === (save.selectedCar || 'bruiser')) save.upgrades = { ...save.carUpgrades[id] };
    SaveSystem.save(save);
    try { Audio.playUpgrade(); } catch(e) {}
    refreshGarage();
    try { Particles.screenShake(3, 0.2); } catch(e) {}
  }

  function setDifficulty(key) {
    const save = SaveSystem.load();
    save.difficulty = key;
    SaveSystem.save(save);
    try { Audio.playMenuSelect(); } catch(e) {}
    refreshGarage();
  }

  function launchDailyChallenge() {
    const dc = Game.DailyChallenge.get();
    if (dc.completed) return;
    const save = SaveSystem.load();
    if (save.unlockedCars && save.unlockedCars.includes(dc.bonusCar)) {
      save.selectedCar = dc.bonusCar;
      SaveSystem.save(save);
    }
    try { Audio.playMenuSelect(); } catch(e) {}
    Game.startRace(dc.trackId, false, SaveSystem.load().selectedCar, dc.mode);
  }

  function showRivalCallout(name, icon, text, color) {
    let el = document.getElementById('rival-callout');
    if (!el) return;
    el.innerHTML =
      `<span style="color:${color};font-family:var(--font-head);font-size:0.82rem;letter-spacing:0.1em">${icon} ${name}</span>` +
      `<br><span style="font-size:0.72rem;color:#aab">${text}</span>`;
    el.style.borderColor = color;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3500);
  }

  // ── Race launch ──────────────────────────────────────
  function launchRace() {
    audioReady = true;
    const save = SaveSystem.load();
    if (!save.unlockedTracks.includes(selectedTrackId)) return;
    try { Audio.playMenuSelect(); } catch(e) {}
    Game.startRace(selectedTrackId, false, save.selectedCar || 'speedster', raceMode);
  }

  function startQuickRace() {
    audioReady = true;
    try { Audio.playMenuSelect(); } catch(e) {}
    const save = SaveSystem.load();
    Game.startRace(0, false, save.selectedCar || 'speedster', 'normal');
  }

  // ── Results screen ───────────────────────────────────
  function showResults(results, track, earned, champPts, isChampFinal, bestInfo = {}) {
    try {
    const body = document.getElementById('results-body');
    body.innerHTML = '';
    const placeColors = ['place-1','place-2','place-3',''];

    const taunts = bestInfo.taunts || {};

    results.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (r.isPlayer) tr.classList.add('player-row');
      const driverColor = r.color || (r.isPlayer ? 'var(--neon-cyan)' : '#778');
      const tauntLine = !r.isPlayer && taunts[r.name]
        ? `<div style="font-size:0.6rem;color:#556;font-style:italic;margin-top:1px">"${taunts[r.name]}"</div>`
        : '';
      tr.innerHTML =
        `<td class="${placeColors[i] || ''}">${ordinal(i+1)}</td>` +
        `<td><div style="display:flex;align-items:center;gap:5px">` +
          `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${driverColor};flex-shrink:0"></span>` +
          `<div><span style="color:${driverColor}">${r.isPlayer ? '&#x25B6; YOU' : (r.name||'AI')}</span>` +
          `${r.tag ? `<span style="font-size:0.6rem;color:#556"> [${r.tag}]</span>` : ''}` +
          `${tauntLine}</div></div></td>` +
        `<td>${formatTime(r.finishTime)}</td>` +
        `<td style="color:var(--neon-green)">${(track.champPts&&track.champPts[i])||0}</td>`;
      body.appendChild(tr);
    });

    document.getElementById('results-title').textContent = isChampFinal ? '🏆 CHAMPIONSHIP RESULT' : 'RACE RESULTS';

    // Drift CR bonus line
    const driftCR = Drift.getHUD().sessionCR;
    const driftLine = document.getElementById('drift-earn-badge');
    if (driftLine) {
      driftLine.textContent = driftCR > 0 ? `◆ +${driftCR} CR DRIFT BONUS` : '';
      driftLine.style.display = driftCR > 0 ? 'block' : 'none';
    }

    const dailyBonus = bestInfo.dailyBonus || 0;
    const totalEarned = earned + dailyBonus;
    document.getElementById('earn-badge').textContent = totalEarned > 0
      ? `+${totalEarned} CR EARNED${dailyBonus > 0 ? ` (incl. +${dailyBonus} DAILY BONUS)` : ''}`
      : 'BETTER LUCK NEXT TIME';
    document.getElementById('pts-badge').textContent = champPts ? `+${champPts} CHAMPIONSHIP POINTS` : '';

    // Best time display
    const bestEl = document.getElementById('best-time-badge');
    if (bestEl && bestInfo.playerTime && isFinite(bestInfo.playerTime)) {
      if (bestInfo.isNewBest && bestInfo.prevBest) {
        const delta = bestInfo.playerTime - bestInfo.prevBest;
        const sign = delta < 0 ? '▼ ' : '▲ ';
        const color = delta < 0 ? 'var(--neon-green)' : 'var(--neon-pink)';
        bestEl.innerHTML = `<span style="color:var(--neon-yellow);font-family:var(--font-head)">★ NEW BEST: ${formatTime(bestInfo.playerTime)}</span> <span style="color:${color};font-size:0.8rem">${sign}${formatTime(Math.abs(delta))}</span>`;
      } else if (bestInfo.isNewBest) {
        bestEl.innerHTML = `<span style="color:var(--neon-yellow);font-family:var(--font-head)">★ FIRST TIME: ${formatTime(bestInfo.playerTime)}</span>`;
      } else if (bestInfo.prevBest) {
        const delta = bestInfo.playerTime - bestInfo.prevBest;
        bestEl.innerHTML = `<span style="color:#557">BEST: ${formatTime(bestInfo.prevBest)}</span> <span style="color:var(--neon-pink);font-size:0.8rem">▲ +${formatTime(Math.abs(delta))} off best</span>`;
      } else {
        bestEl.innerHTML = '';
      }
    } else if (bestEl) {
      bestEl.innerHTML = '';
    }

    const nextBtn = document.getElementById('next-btn');
    nextBtn.querySelector('span').textContent = isChampFinal ? 'SEE FINAL RESULT' : 'CONTINUE';

    showScreen('results-screen');
    } catch(e) { console.error('showResults crash:', e); showScreen('results-screen'); }
  }

  function afterResults() {
    try { Audio.playMenuSelect(); } catch(e) {}
    Game.afterResults();
  }

  function toggleMute() {
    audioReady = true;
    try {
      Audio.init();
      Audio.resume();
      const muted = Audio.isMuted();
      Audio.setMuted(!muted);
      const btn = document.getElementById('mute-btn');
      if (btn) btn.textContent = muted ? '🔊 SOUND' : '🔇 MUTED';
    } catch(e) {}
  }

  // ── Game over ─────────────────────────────────────────
  function showGameOver(msg, sub) {
    document.getElementById('gameover-msg').textContent = msg;
    document.getElementById('gameover-sub').innerHTML = sub;
    try { Audio.playLose(); } catch(e) {}
    showScreen('gameover-screen');
  }

  // ── Victory ──────────────────────────────────────────
  function showVictory(sub) {
    document.getElementById('victory-sub').innerHTML = sub;
    try { Audio.playWin(); } catch(e) {}
    showScreen('victory-screen');
  }

  // ── Helpers ──────────────────────────────────────────
  function formatTime(t) {
    if (!isFinite(t)) return 'DNF';
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    const ms  = Math.floor((t % 1) * 100);
    return `${min}:${String(sec).padStart(2,'0')}.${String(ms).padStart(2,'0')}`;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return {
    showScreen, showHUD, updateHUD, showLapFlash,
    runCountdown,
    garageTab, refreshGarage, renderTrackList,
    setRaceMode, setDifficulty,
    buyTrack, buyUpgrade, buyCar,
    launchRace, startQuickRace, launchDailyChallenge,
    showResults, afterResults,
    showRivalCallout,
    showGameOver, showVictory,
    toggleMute,
    formatTime,
    getSelectedTrack: () => selectedTrackId,
  };
})();
