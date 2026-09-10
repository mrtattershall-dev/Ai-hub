function renderStatsPage() {
  const body = document.getElementById('statsBody');
  if (!body) return;

  const row = (icon, label, val, highlight) =>
    `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:3px 0;border-bottom:1px solid rgba(180,140,60,.06);">
      <span style="font-size:9px;color:#807050">${icon} ${label}</span>
      <span style="font-size:10px;font-weight:bold;color:${highlight||'#d4b870'}">${val}</span>
    </div>`;

  const section = (title, color, content) =>
    `<div style="margin-bottom:16px;">
      <div style="font-size:10px;color:${color||'#c0a060'};letter-spacing:.06em;border-bottom:1px solid rgba(180,140,60,.18);padding-bottom:4px;margin-bottom:6px;">${title}</div>
      ${content}
    </div>`;

  const fmt = n => (n||0).toLocaleString();

  // ── THE MOST IMPORTANT STAT ──
  const boots = stats.junkBootsFished || 0;
  const bootLines = [
    `<div style="text-align:center;padding:10px 0 8px;border-bottom:1px solid rgba(180,140,60,.2);margin-bottom:14px;">`,
    `<div style="font-size:28px;margin-bottom:4px;">👢</div>`,
    `<div style="font-size:22px;font-weight:bold;color:#d4b870;letter-spacing:.06em;">${boots}</div>`,
    `<div style="font-size:9px;color:#705830;margin-top:3px;letter-spacing:.04em;">BOOTS FISHED OUT OF THE RIVER</div>`,
    boots === 0 ? `<div style="font-size:8px;color:#504020;margin-top:4px;font-style:italic;">Cast your line. You'll find one eventually.</div>` : '',
    boots === 1 ? `<div style="font-size:8px;color:#706040;margin-top:4px;font-style:italic;">Someone lost that boot. You found it.</div>` : '',
    boots >= 5 ? `<div style="font-size:8px;color:#a08050;margin-top:4px;font-style:italic;">At this point, the river is giving them to you on purpose.</div>` : '',
    boots >= 10 ? `<div style="font-size:8px;color:#c0a060;margin-top:4px;font-style:italic;">There is no explanation for this.</div>` : '',
    boots >= 20 ? `<div style="font-size:8px;color:#d4b870;margin-top:4px;font-style:italic;">You are the boot. The boot is you.</div>` : '',
    `</div>`,
  ].join('');

  // ── SURVIVAL ──
  const survivalContent = [
    row('📅','Days Survived', fmt(stats.daysSurvived)),
    row('🌙','Nights Survived', fmt(stats.nightsSurvived)),
    row('💀','Times Died', fmt(stats.timesDied), stats.timesDied > 5 ? '#e07050' : '#d4b870'),
    row('⛈','Storms Survived', fmt(stats.stormsSurvived)),
    row('⛏','Deepest Floor Reached', `Floor ${(gameState._deepestMineFloor||0)+1}`),
    row('🍽','Current Hunger', `${Math.round(player.hunger||0)}/100`, player.hunger<20?'#e06050':player.hunger<40?'#d09020':'#80c060'),
  ].join('');

  // ── COMBAT ──
  const killEntries = Object.entries(stats.kills||{}).sort((a,b)=>b[1]-a[1]);
  const killRows = killEntries.length
    ? killEntries.map(([type, count]) => row('⚔', type.charAt(0).toUpperCase()+type.slice(1), fmt(count))).join('')
    : `<div style="font-size:9px;color:#504020;padding:4px 0">No enemies killed yet.</div>`;
  const combatContent = row('💀','Total Kills', fmt(stats.totalKills), '#e08060') + killRows;

  // ── FARMING ──
  const cropEntries = Object.entries(stats.cropsHarvested||{}).sort((a,b)=>b[1]-a[1]);
  const cropRows = cropEntries.length
    ? cropEntries.map(([crop, count]) => {
        const icon = ITEMS[crop]?.icon || '🌱';
        const name = ITEMS[crop]?.name || crop;
        return row(icon, name, fmt(count));
      }).join('')
    : `<div style="font-size:9px;color:#504020;padding:4px 0">No crops harvested yet.</div>`;
  const farmContent = [
    row('🌾','Total Crops Harvested', fmt(stats.totalCropsHarvested), '#80c060'),
    row('🌱','Seeds Planted', fmt(stats.plantingsDone)),
    row('💧','Tiles Watered', fmt(stats.tilesWatered)),
    cropRows,
  ].join('');

  // ── MINING ──
  const oreEntries = Object.entries(stats.oreMinedByType||{}).sort((a,b)=>b[1]-a[1]);
  const oreRows = oreEntries.length
    ? oreEntries.map(([ore, count]) => {
        const icon = ITEMS[ore]?.icon || '🪨';
        const name = ITEMS[ore]?.name || ore;
        return row(icon, name, fmt(count));
      }).join('')
    : `<div style="font-size:9px;color:#504020;padding:4px 0">Nothing mined yet.</div>`;
  const mineContent = [
    row('⛏','Total Ore Mined', fmt(stats.totalOreMined), '#c09050'),
    row('🪬','Singing Stones Found', fmt(stats.singingStonesFound), stats.singingStonesFound > 0 ? '#a060d0' : '#504020'),
    oreRows,
  ].join('');

  // ── GATHERING ──
  const gatherContent = [
    row('🪵','Wood Chopped', fmt(stats.woodChopped)),
    row('🪨','Stone Gathered', fmt(stats.stoneGathered)),
    row('🌿','Herbs Gathered', fmt(stats.herbsGathered)),
  ].join('');

  // ── FISHING LOGBOOK ──
  const ALL_FISH = [
    // River
    ...FISH_TABLE.map(f=>({id:f.id,zone:'River'})),
    // Creek
    ...CREEK_FISH_TABLE.map(f=>({id:f.id,zone:'Creek'})),
    // Ocean shallow
    {id:'drumfish',zone:'Ocean'},{id:'flounder',zone:'Ocean'},{id:'mullet',zone:'Ocean'},
    {id:'spadefish',zone:'Ocean'},{id:'grouper',zone:'Ocean'},{id:'sheepshead',zone:'Ocean'},
    {id:'redfish',zone:'Ocean'},{id:'blueCrab',zone:'Ocean'},{id:'oyster',zone:'Ocean'},
    {id:'anchovy',zone:'Ocean'},{id:'goldenDrum',zone:'Ocean'},{id:'anchorBolt',zone:'Ocean'},
    // Ocean deep
    {id:'seabass',zone:'Ocean'},{id:'tarpon',zone:'Ocean'},{id:'mahimahi',zone:'Ocean'},
    {id:'wahoo',zone:'Ocean'},{id:'swordfish',zone:'Ocean'},{id:'bluefinTuna',zone:'Ocean'},
    {id:'giantGrouper',zone:'Ocean'},{id:'lobster',zone:'Ocean'},{id:'seaUrchin',zone:'Ocean'},
    {id:'crabCluster',zone:'Ocean'},{id:'shipTimber',zone:'Ocean'},{id:'navalChart',zone:'Ocean'},
    {id:'shipsLog',zone:'Ocean'},{id:'ghostLantern',zone:'Ocean'},{id:'leatherbackTurtle',zone:'Ocean'},
    {id:'deepseaPearl',zone:'Ocean'},{id:'kraken',zone:'Ocean'},
  ];
  // Deduplicate by id
  const seenIds = new Set();
  const allFishUniq = ALL_FISH.filter(f => { if (seenIds.has(f.id)) return false; seenIds.add(f.id); return true; });

  const caught = stats.fishCaught || {};
  const caughtCount = Object.keys(caught).filter(k => caught[k] > 0).length;
  const zoneColors = { River:'#60c8e8', Creek:'#80b870', Ocean:'#4080d0' };

  const logbookRows = allFishUniq.map(({id, zone}) => {
    const item = ITEMS[id];
    if (!item) return '';
    const count = caught[id] || 0;
    const isCaught = count > 0;
    const color = isCaught ? (zoneColors[zone]||'#80c8e8') : 'rgba(120,90,40,0.3)';
    const nameColor = isCaught ? '#d4b870' : 'rgba(120,90,40,0.35)';
    const badge = count > 0 ? `<span style="font-size:8px;color:${color};">×${fmt(count)}</span>` : `<span style="font-size:7px;color:rgba(120,90,40,0.3);">?</span>`;
    return `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;border-bottom:1px solid rgba(180,140,60,.05);">
      <span style="font-size:13px;opacity:${isCaught?1:0.25};">${item.icon}</span>
      <span style="flex:1;font-size:9px;color:${nameColor};">${isCaught?item.name:'???'}</span>
      <span style="font-size:8px;color:rgba(120,90,40,0.5);">${zone}</span>
      ${badge}
    </div>`;
  }).join('');

  const fishContent = [
    `<div style="display:flex;justify-content:space-between;padding:4px 0 8px;border-bottom:1px solid rgba(180,140,60,.18);margin-bottom:6px;">
      <span style="font-size:10px;color:#80c8e8;">🎣 ${caughtCount} / ${allFishUniq.length} species</span>
      <span style="font-size:10px;color:#d4b870;">${fmt(stats.totalFishCaught)} total catches</span>
    </div>`,
    logbookRows,
    row('✨','Golden Fish Caught', fmt(stats.goldenFishCaught||0), '#f0d060'),
  ].join('');


  // ── CRAFTING ──
  const craftEntries = Object.entries(stats.itemsCrafted||{}).sort((a,b)=>b[1]-a[1]);
  const craftRows = craftEntries.length
    ? craftEntries.map(([id, count]) => {
        const recipe = CRAFTING_RECIPES.find(r=>r.id===id);
        const icon = recipe?.icon || '⚒';
        const name = recipe?.name || id;
        return row(icon, name, fmt(count));
      }).join('')
    : `<div style="font-size:9px;color:#504020;padding:4px 0">Nothing crafted yet.</div>`;
  const craftContent = [
    row('⚒','Total Items Crafted', fmt(stats.totalItemsCrafted), '#80c8e8'),
    craftRows,
  ].join('');

  // ── ECONOMY ──
  const econContent = [
    row('💰','Total Gold Earned', '$'+fmt(stats.goldEarned), '#f0d060'),
    row('💸','Total Gold Spent', '$'+fmt(stats.goldSpent)),
    row('📜','Contracts Completed', fmt(stats.contractsCompleted), '#80e060'),
    row('❌','Contracts Missed', fmt(missedContracts), '#e06050'),
    row('🔥','Best Streak', fmt(contractStreak), '#f0c030'),
    row('🏦','Debt Repaid', '$'+fmt(stats.debtRepaid), '#80c8e8'),
  ].join('');

  // ── REPUTATION ──
  const repIcons = { town:'🏘', hoboCamp:'🏕', badlands:'🏜', mine:'⛏', city:'🏙', ocean:'⚓', secondFarm:'🌾' };
  const repNames = { town:'Town', hoboCamp:'Hobo Camp', badlands:'The Badlands', mine:'The Mine', city:'The City', ocean:'The Ocean', secondFarm:'Second Farm' };
  const repEffects = {
    town:     tier => tier==='revered'?'+20% sell prices':tier==='trusted'?'+10% sell prices':tier==='acquaintance'?'standard prices':'−8% sell prices (stranger)',
    mine:     tier => tier==='revered'||tier==='trusted'?'Floor hints from Silas + free candles daily':tier==='acquaintance'?'Free torches from Silas daily':'no perks yet',
    badlands: tier => tier==='revered'||tier==='trusted'?'Heat drop premium + Crane\'s back room':tier==='acquaintance'?'Heat drop premium (1.5×+)':'heat drops sell at base rate',
    hoboCamp: tier => tier==='revered'||tier==='trusted'?'3 food → healHerb (Lena)':tier==='acquaintance'?'4 food → healHerb (Lena)':'5 food → healHerb (Lena)',
    ocean:    tier => tier==='revered'||tier==='trusted'?'10% boat discount + sloop deep fishing':tier==='acquaintance'?'10% boat discount':'standard boat prices',
  };
  const repContent = Object.entries(REPUTATION).map(([k, v]) => {
    const tier = getRepTier(k);
    const tierColor = tier==='revered'?'#f0d060':tier==='trusted'?'#80c060':tier==='acquaintance'?'#80a8c0':'#504020';
    const tierLabel = tier==='unknown' ? 'Unknown' : tier.charAt(0).toUpperCase()+tier.slice(1);
    const effect = repEffects[k] ? ` · ${repEffects[k](tier)}` : '';
    return row(repIcons[k]||'📍', (repNames[k]||k)+effect, `${tierLabel} (${v}/100)`, tierColor);
  }).join('');

  body.innerHTML = [
    bootLines,
    section('⚔ COMBAT', '#e08060', combatContent),
    section('🌾 FARMING', '#80c060', farmContent),
    section('⛏ MINING', '#c09050', mineContent),
    section('🌿 GATHERING', '#80a060', gatherContent),
    section('🎣 FISHING LOGBOOK', '#80c8e8', fishContent),
    section('⚒ CRAFTING', '#a0b8d0', craftContent),
    section('💰 ECONOMY', '#f0d060', econContent),
    section('🛡 SURVIVAL', '#c0a060', survivalContent),
    section('🤝 REPUTATION', '#c0a870', repContent),
    ...(gameState._postEnding ? [renderPostEndingGoals()] : []),
  ].join('');
}