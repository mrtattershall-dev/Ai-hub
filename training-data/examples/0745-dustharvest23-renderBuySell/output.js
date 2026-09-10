function renderBuySell(body) {
  // Crops only — stone/wood/herb live in GATHERED GOODS section below
  const cropItems = [
    {id:'carrot',      name:'Carrot',       icon:'🥕'},
    {id:'corn',        name:'Corn',         icon:'🌽'},
    {id:'pumpkin',     name:'Pumpkin',      icon:'🎃'},
    {id:'glowroot',    name:'Glowroot',     icon:'✨'},
    {id:'tomato',      name:'Tomato',       icon:'🍅'},
    {id:'dustwheat',   name:'Dustwheat',    icon:'🌾'},
    {id:'sunblossom',  name:'Sunblossom',   icon:'🌻'},
    {id:'pepper',      name:'Pepper',       icon:'🌶'},
    {id:'melon',       name:'Melon',        icon:'🍈'},
    {id:'potato',      name:'Potato',       icon:'🥔'},
    {id:'lavender',    name:'Lavender',     icon:'💜'},
    {id:'cactusFruit', name:'Cactus Fruit', icon:'🌵'},
    {id:'blueberry',   name:'Blueberry',    icon:'🫐'},
    {id:'garlic',      name:'Garlic',       icon:'🧄'},
    {id:'strawberry',  name:'Strawberry',   icon:'🍓'},
    {id:'onion',       name:'Onion',        icon:'🧅'},
    {id:'watermelon',  name:'Watermelon',   icon:'🍉'},
    {id:'rosehip',     name:'Rosehip',      icon:'🌹'},
    {id:'moonshroom',  name:'Moonshroom',   icon:'🍄'},
  // Sort by seed buy price descending — most expensive seeds at top
  ].sort((a,b) => (BASE_SEED_PRICES[b.id]||0) - (BASE_SEED_PRICES[a.id]||0));

  // Gathered from wilderness — no seeds, just sell
  const gatheredItems = [
    {id:'herb',  name:'Desert Herb', icon:'🌿'},
    {id:'wood',  name:'Wood',        icon:'🪵'},
    {id:'stone', name:'Stone',       icon:'🪨'},
  ].sort((a,b) => (economy.prices[b.id]||1) - (economy.prices[a.id]||1));

  const lootItems = [
    {id:'banditScarf',      name:'Bandit Scarf',      icon:'🧣'},
    {id:'wolfPelt',         name:'Wolf Pelt',          icon:'🐺'},
    {id:'burrowerCarapace', name:'Burrower Carapace',  icon:'🪲'},
    {id:'raiderBadge',      name:'Raider Badge',       icon:'💀'},
    {id:'snakeFang',        name:'Snake Fang',         icon:'🐍'},
  ];

  let totalValue = 0;

  // helper: standard sell-only price row
  function priceRow(item) {
    const cur  = economy.prices[item.id] || BASE_PRICES[item.id] || 1;
    const base = BASE_PRICES[item.id] || 1;
    const hist = economy.hist[item.id] || [];
    const prev = hist.length>1 ? hist[hist.length-2] : base;
    const { arrow: trend, color: trendColor } = getPriceTrend(cur, prev);
    const priceColor = cur>base*1.3?'#60e060':cur<base*.7?'#e06060':'#d4b870';
    const held = countItem(item.id);
    if (held > 0) totalValue += held * cur;
    if (held === 0) return '';
    return `<div class="price-row">
      <span class="pr-icon">${item.icon}</span>
      <span class="pr-name">${item.name}</span>
      <span class="pr-held">${held} held</span>
      <span class="pr-price" style="color:${priceColor}">$${cur}</span>
      <span class="pr-trend" style="color:${trendColor}">${trend}</span>
      <button class="btn-sell" onclick="sellItem('${item.id}')">SELL ALL ($${held*cur})</button>
      <span style="width:100px"></span>
    </div>`;
  }

  let h = `<div style="font-size:9px;color:#6a5020;margin-bottom:8px;letter-spacing:.04em">CROPS &amp; SEEDS — sorted by seed price, shifts each dawn</div>`;

  for (const item of cropItems) {
    const cur  = economy.prices[item.id] || 1;
    const base = BASE_PRICES[item.id] || 1;
    const hist = economy.hist[item.id] || [];
    const prev = hist.length>1 ? hist[hist.length-2] : base;
    const { arrow: trend, color: trendColor } = getPriceTrend(cur, prev);
    const priceColor = cur>base*1.3?'#60e060':cur<base*.7?'#e06060':'#d4b870';
    const held = countItem(item.id);
    if (held>0) totalValue += held*cur;
    const seedPrice = economy.seedPrices[item.id];
    const seedHeld  = inventory.seeds[SEED_MAP[item.id]] || 0;
    const multTag   = (economy.mult[item.id]||1) > 1.1
      ? `<span style="font-size:8px;color:#e0a040;margin-left:3px">×${(economy.mult[item.id]).toFixed(1)}</span>` : '';
    h += `<div class="price-row">
      <span class="pr-icon">${item.icon}</span>
      <span class="pr-name">${item.name}${multTag}</span>
      <span class="pr-held">${held} held</span>
      <span class="pr-price" style="color:${priceColor}">$${cur}</span>
      <span class="pr-trend" style="color:${trendColor}">${trend}</span>
      ${held>0 ? `<button class="btn-sell" onclick="sellItem('${item.id}')">SELL ALL</button>` : `<span style="width:60px"></span>`}
      ${seedPrice ? `<button class="btn-buy" onclick="buySeed('${item.id}',1)" title="Buy 1 seed — you have ${seedHeld}">BUY SEED $${seedPrice}</button>` : `<span style="width:100px"></span>`}
    </div>`;
  }

  // ── Gathered Goods ───────────────────────────────────────────────────────────
  // stone/wood/herb are foraged from the wilderness — no seeds, no planting
  const gatheredHeld = gatheredItems.filter(it => countItem(it.id) > 0);
  if (gatheredHeld.length > 0) {
    h += `<div style="font-size:9px;color:#6a5020;margin:14px 0 8px;letter-spacing:.04em">🪓 GATHERED GOODS — foraged from the wilderness, no planting needed</div>`;
    for (const item of gatheredItems) { h += priceRow(item); }
  }

  // ── Mine Ore ─────────────────────────────────────────────────────────────────
  const oreItems = [
    {id:'coal',      name:'Coal',       icon:'🪨'},
    {id:'copperOre', name:'Copper Ore', icon:'🟤'},
    {id:'ironOre',   name:'Iron Ore',   icon:'⚫'},
    {id:'goldOre',   name:'Gold Ore',   icon:'🟡'},
    {id:'crystal',   name:'Crystal',    icon:'💎'},
  ];
  if (oreItems.some(it => countItem(it.id) > 0)) {
    h += `<div style="font-size:9px;color:#6a5020;margin:14px 0 8px;letter-spacing:.04em">⛏ MINE ORE — mined from the southwest mine</div>`;
    for (const item of oreItems) { h += priceRow(item); }
  }

  // ── River Catch ──────────────────────────────────────────────────────────────
  const fishItems = [
    {id:'commonFish',  name:'Common Fish',      icon:'🐟'},
    {id:'perch',       name:'Perch',            icon:'🐠'},
    {id:'catfish',     name:'Catfish',          icon:'🐡'},
    {id:'bassfish',    name:'Largemouth Bass',  icon:'🐟'},
    {id:'sunfish',     name:'Sunfish',          icon:'🐠'},
    {id:'snapperTurtle',name:'Snapper Turtle',  icon:'🐢'},
    {id:'junkBoot',    name:'Old Boot',         icon:'👢'},
    {id:'crawdad',     name:'Crawdad',          icon:'🦐'},
    {id:'mudcat',      name:'Mudcat',           icon:'🐡'},
    {id:'rustNail',    name:'Rust Nail',        icon:'🔩'},
    {id:'oldFlask',    name:'Old Flask',        icon:'🧪'},
    {id:'surveyorCompass',name:'Surveyor\'s Compass',icon:'🧭'},
    {id:'deedFragment',name:'Deed Fragment',    icon:'📜'},
    {id:'goldenfish',  name:'Golden Fish',      icon:'✨'},
    {id:'ancientCoin', name:'Ancient Coin',     icon:'🪙'},
  ];
  if (fishItems.some(it => countItem(it.id) > 0)) {
    h += `<div style="font-size:9px;color:#6a5020;margin:14px 0 8px;letter-spacing:.04em">🎣 RIVER CATCH — fish from the river north of the farm</div>`;
    for (const item of fishItems) {
      const held = countItem(item.id);
      if (held === 0) continue;
      const displayPrice = item.id === 'junkBoot' ? (getCurrentSeason()?.name === 'Cold Winter' ? 50 : 2) : (economy.prices[item.id] || BASE_PRICES[item.id] || 1);
      const base = BASE_PRICES[item.id] || 1;
      const hist = economy.hist[item.id] || [];
      const prev = hist.length>1 ? hist[hist.length-2] : base;
      const isJunk = item.id === 'junkBoot';
      const trend = isJunk ? '─' : displayPrice>prev*1.05?'▲':displayPrice<prev*.95?'▼':'─';
      const trendColor = isJunk ? '#604030' : displayPrice>prev*1.05?'#60e060':displayPrice<prev*.95?'#e06060':'#a09060';
      const priceColor = isJunk ? '#806050' : displayPrice>base*1.3?'#60e060':displayPrice<base*.7?'#e06060':'#d4b870';
      totalValue += held * displayPrice;
      h += `<div class="price-row">
        <span class="pr-icon">${item.icon}</span>
        <span class="pr-name">${item.name}</span>
        <span class="pr-held">${held} held</span>
        <span class="pr-price" style="color:${priceColor}">$${displayPrice}</span>
        <span class="pr-trend" style="color:${trendColor}">${trend}</span>
        <button class="btn-sell" onclick="sellItem('${item.id}')">SELL ALL ($${held*displayPrice})</button>
        <span style="width:100px"></span>
      </div>`;
    }
  }

  // ── Smelted Bars ─────────────────────────────────────────────────────────────
  const smeltBarsHeld = SMELT_RECIPES.filter(r => countItem(r.bar) > 0);
  if (smeltBarsHeld.length > 0) {
    h += `<div style="font-size:9px;color:#6a5020;margin:12px 0 6px;letter-spacing:.04em">🔥 SMELTED BARS — premium value</div>`;
    for (const recipe of smeltBarsHeld) {
      const price = economy.prices[recipe.bar] || BASE_PRICES[recipe.bar] || 50;
      const held  = countItem(recipe.bar);
      h += `<div class="price-row">
        <span class="pr-icon">${recipe.icon}</span>
        <span class="pr-name">${recipe.name}</span>
        <span class="pr-held">${held} held</span>
        <span class="pr-price" style="color:#e0a030">$${price}</span>
        <span class="pr-trend" style="color:#80c060">▲</span>
        <button class="btn-sell" onclick="sellItem('${recipe.bar}')">SELL ALL ($${held*price})</button>
        <span style="width:80px"></span>
      </div>`;
    }
  }

  // ── Enemy Loot ───────────────────────────────────────────────────────────────
  if (lootItems.some(it => countItem(it.id) > 0)) {
    h += `<div style="font-size:9px;color:#6a5020;margin:14px 0 8px;letter-spacing:.04em">💀 ENEMY LOOT — sell trophies from combat</div>`;
    for (const item of lootItems) { h += priceRow(item); }
  }

  // ── Crafted Goods ─────────────────────────────────────────────────────────────
  const craftedSellable = ['woolBlanket','copperFitting','ironSpike','leatherStrip','plank','rope','cloth'];
  const craftedHeldSell = craftedSellable.filter(id => countItem(id) > 0);
  if (craftedHeldSell.length > 0) {
    h += `<div style="font-size:9px;color:#6a5020;margin:14px 0 8px;letter-spacing:.04em">⚒ CRAFTED GOODS — sell surplus materials</div>`;
    for (const id of craftedHeldSell) {
      const it = ITEMS[id]; if (!it) continue;
      const price = economy.prices[id] || BASE_PRICES[id] || 10;
      const held  = countItem(id);
      totalValue += held * price;
      h += `<div class="price-row">
        <span class="pr-icon">${it.icon}</span>
        <span class="pr-name">${it.name}</span>
        <span style="flex:1;font-size:8px;color:#705030">${it.desc}</span>
        <span class="pr-held">${held} held</span>
        <span class="pr-price" style="color:#80c8e8">$${price}</span>
        <button class="btn-sell" onclick="sellItem('${id}')">SELL ALL ($${held*price})</button>
      </div>`;
    }
  }

  // ── Campfire Cooked Foods ────────────────────────────────────────────────────
  const cookedSellable = ['pepperStew','potatoMash','berryJam','lavenderTea','porkRoast','goatCheese','garlicBread','watermelonSlice','rosehipTonic','mushroomSoup','strawberryPreserves','fishStew','saltChowder','crabBisque','grilledGrouper','swordfishSteak','oysterPlate'];
  const cookedHeld = cookedSellable.filter(id => countItem(id) > 0);
  if (cookedHeld.length > 0) {
    h += `<div style="font-size:9px;color:#6a5020;margin:14px 0 8px;letter-spacing:.04em">🔥 COOKED FOODS — campfire meals, premium value</div>`;
    for (const id of cookedHeld) {
      const it = ITEMS[id]; if (!it) continue;
      const price = economy.prices[id] || BASE_PRICES[id] || 10;
      const held  = countItem(id);
      totalValue += held * price;
      h += `<div class="price-row">
        <span class="pr-icon">${it.icon}</span>
        <span class="pr-name">${it.name}</span>
        <span class="pr-held">${held} held</span>
        <span class="pr-price" style="color:#e09040">$${price}</span>
        <span class="pr-trend" style="color:#80c060">▲</span>
        <button class="btn-sell" onclick="sellItem('${id}')">SELL ALL ($${held*price})</button>
        <span style="width:60px"></span>
      </div>`;
    }
  }

  // ── Badlands Goods ────────────────────────────────────────────────────────────
  const blGoods = [
    {id:'sulfurDust',       name:'Sulfur Dust',            icon:'🟡'},
    {id:'boneShard',        name:'Bone Shard',             icon:'🦴'},
    {id:'charredWood',      name:'Charred Wood',           icon:'🪵'},
    {id:'stoneShard',       name:'Stone Shard',            icon:'🪨'},
    {id:'driedHerb',        name:'Dried Herb',             icon:'🌿'},
    {id:'silverOre',        name:'Silver Ore',             icon:'🔘'},
    {id:'obsidian',         name:'Obsidian',               icon:'🔮'},
    {id:'outlawBadge',      name:'Outlaw Badge',           icon:'⭐'},
    {id:'rattlerFang',      name:'Rattler Fang',           icon:'🐍'},
    {id:'vultureFeather',   name:'Vulture Feather',        icon:'🪶'},
    {id:'scorpion2Stinger', name:'Bark Scorpion Stinger',  icon:'🦂'},
    {id:'dustDevilEye',     name:'Dust Devil Eye',         icon:'🌪️'},
    {id:'silverBar',        name:'Silver Bar (smelted)',   icon:'🥈'},
  ];
  h += `<div style="font-size:9px;color:#c07840;margin:14px 0 8px;letter-spacing:.04em;border-top:1px solid rgba(180,140,60,.15);padding-top:10px">🏜 BADLANDS GOODS — rare resources &amp; monster trophies. Prices shift every dawn.</div>`;
  for (const item of blGoods) {
    const held = countItem(item.id);
    const cur  = economy.prices[item.id] || BASE_PRICES[item.id] || BL_BASE_PRICES[item.id] || 1;
    const base = BASE_PRICES[item.id] || BL_BASE_PRICES[item.id] || 1;
    const hist = economy.hist[item.id] || [];
    const prev = hist.length > 1 ? hist[hist.length - 2] : base;
    const { arrow: trend, color: trendColor } = getPriceTrend(cur, prev);
    const priceColor = cur>base*1.3?'#60e060':cur<base*.7?'#e06060':'#e0a040';
    const multTag = (economy.mult[item.id]||1) > 1.1
      ? `<span style="font-size:8px;color:#e0a040;margin-left:3px">×${(economy.mult[item.id]).toFixed(1)}</span>` : '';
    if (held > 0) totalValue += held * cur;
    h += `<div class="price-row" style="border-left:2px solid rgba(200,120,40,.3);opacity:${held>0?1:0.6}">
      <span class="pr-icon">${item.icon}</span>
      <span class="pr-name" style="color:${held>0?'#d4a060':'#806040'}">${item.name}${multTag}</span>
      <span class="pr-held" style="color:${held>0?'#d4b870':'#504020'}">${held>0?held+' held':'—'}</span>
      <span class="pr-price" style="color:${priceColor}">$${cur}</span>
      <span class="pr-trend" style="color:${trendColor}">${trend}</span>
      ${held>0 ? `<button class="btn-sell" onclick="sellItem('${item.id}')">SELL ALL ($${held*cur})</button>` : `<span style="font-size:8px;color:#504020;width:60px;text-align:right">none held</span>`}
      <span style="width:100px"></span>
    </div>`;
  }

  h += `<div style="margin-top:10px;padding:8px 10px;background:rgba(80,160,40,.06);border:1px solid rgba(80,160,40,.22);border-radius:4px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:10px;color:#80c060">Total value of goods in bag: <b style="color:#f0d060">$${totalValue}</b></span>
    <button onclick="sellAllCrops()" style="padding:5px 14px;font-size:10px;font-family:'Special Elite',serif;cursor:pointer;border-radius:3px;background:rgba(240,180,40,.13);border:1px solid rgba(240,180,40,.45);color:#f0d060">SELL EVERYTHING</button>
  </div>`;

  h += `<div style="font-size:9px;color:#6a5020;margin:14px 0 8px;letter-spacing:.04em">GENERAL STORE — supplies</div>`;
  const storeItems = [
    { id:'bread',     name:'Bread',         icon:'🍞', price:8,  desc:'+25 stamina. Click in hotbar or inventory.' },
    { id:'potion',    name:'Health Potion', icon:'🧪', price:25, desc:'+40 HP. Very useful on dangerous runs.' },
    { id:'bigPotion', name:'Big Potion',    icon:'🫙', price:55, desc:'+80 HP. For emergencies.' },
  ];
  for (const it of storeItems) {
    const held = countItem(it.id);
    h += `<div class="price-row">
      <span class="pr-icon">${it.icon}</span>
      <span class="pr-name">${it.name}</span>
      <span style="flex:1;font-size:8px;color:#705030">${it.desc}</span>
      <span class="pr-held">${held} held</span>
      <span class="pr-price" style="color:#80b0f0">$${it.price}</span>
      <button class="btn-buy" onclick="buyItem('${it.id}',1)">BUY 1</button>
    </div>`;
  }

  body.innerHTML = h;
}