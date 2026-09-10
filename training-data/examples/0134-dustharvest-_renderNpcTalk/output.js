function _renderNpcTalk(npcId) {
  const season = getCurrentSeason();
  const day    = gameState.day;
  const gold   = player.gold;

  let title, portrait, name, role, speech, bodyHtml;

  if (npcId === 'maya') {
    title = '🛒 MERCHANT MAYA';
    portrait = '🛒';
    name  = 'Merchant Maya';
    role  = 'Market Keeper · Town square';

    // Find the top 3 price-above-base items
    const priceItems = Object.entries(economy.prices)
      .filter(([id]) => CROPS[id] || BASE_PRICES[id])
      .map(([id, price]) => ({ id, price, base: BASE_PRICES[id]||1, ratio: price / (BASE_PRICES[id]||1) }))
      .filter(o => o.ratio > 1.05 && CROPS[o.id])
      .sort((a,b) => b.ratio - a.ratio)
      .slice(0, 3);

    // Season best crops
    const seasonBonus = season.priceBonus || {};
    const seasonCrops = Object.entries(seasonBonus).filter(([id])=>CROPS[id]).sort((a,b)=>b[1]-a[1]).slice(0,3);

    // Debt clock state
    const weeksLeft = Math.max(0, 24 - Math.floor((day-1)/DEBT_WEEK_LENGTH));

    // Contextual greeting — season-aware pool
    const _greetingsBySeason = {
      'Dry Summer': [
        `"${season.icon} Summer's sitting heavy on everything. Crops that like the heat are fetching good prices right now — sell while it holds."`,
        `"Dust on everything by noon. I've been selling drinking water out the back. Don't tell anyone."`,
        `"The sun doesn't care about your debt schedule. Plant what grows in heat and sell fast."`,
        `"Melon season's good for everyone except the people trying to haul them. Heavy things."`,
      ],
      'Harvest Fall': [
        `"${season.icon} Best few weeks of the year for a farmer. Crops are coming in fast — don't let anything sit ready too long."`,
        `"The buyers are serious in fall. They're stocking up before winter. It shows in the prices."`,
        `"I love this season. Everything smells like it's supposed to. Even the money smells better."`,
        `"Pumpkins. Corn. Dustwheat. If you're growing any of those, now is when it pays."`,
      ],
      'Cold Winter': [
        `"${season.icon} Winter. Storms are rolling in every few days. If you've got potatoes and root crops, hold 'em — prices only go up."`,
        `"Half my usual suppliers are stuck behind a storm somewhere. Shortages make prices interesting."`,
        `"Eat something. Seriously. Winter burns through you faster than you think. I sell bread at cost this time of year."`,
        `"The mine's still open during the day. Cold underground is better than cold above it."`,
      ],
      'Wet Spring': [
        `"${season.icon} Rain's good for everyone who sells what grows. Prices on herbs and blossoms are climbing."`,
        `"Spring's the forgiving season. Plant things. Most of them survive. Even bad farmers look good right now."`,
        `"Lavender and rosehip are what the buyers want. The city sends someone for them every spring without fail."`,
        `"The rain doesn't last. Get your crops in the ground while things are easy."`,
      ],
    };
    const greetings = _greetingsBySeason[season.name] || _greetingsBySeason['Dry Summer'];
    speech = greetings[day % greetings.length];

    let infoRows = `<div class="npc-info-row">
      <span class="npc-badge">${season.icon} ${season.name}</span>
      <span class="npc-badge blue">Day ${day}</span>
      ${weeksLeft <= 4 ? `<span class="npc-badge red">⏳ ${weeksLeft} weeks left</span>` : `<span class="npc-badge">${weeksLeft} weeks left</span>`}
    </div>`;

    let priceSection = '';
    if (priceItems.length) {
      priceSection = `<div class="npc-section">🔥 Hot sellers today</div>`;
      for (const o of priceItems) {
        const pct = Math.round((o.ratio - 1) * 100);
        priceSection += `<div class="npc-tip-row">${CROPS[o.id].icon} ${CROPS[o.id].name} — <b style="color:#88d850">$${o.price}</b> <span style="color:#5a8030">(+${pct}% above base)</span></div>`;
      }
    }

    let seasonSection = '';
    if (seasonCrops.length) {
      seasonSection = `<div class="npc-section">${season.icon} Season bonus crops</div>`;
      for (const [id, bonus] of seasonCrops) {
        seasonSection += `<div class="npc-tip-row">${CROPS[id].icon} ${CROPS[id].name} — +${Math.round(bonus*100)}% price this season</div>`;
      }
    }

    let inventorySect = '';
    const _effSlots3 = getEffectiveSlotCount ? getEffectiveSlotCount() : 30;
    const mycropsMap = {};
    for (let _si3 = 0; _si3 < _effSlots3; _si3++) {
      const s = inventory.slots[_si3];
      if (s && s.qty > 0 && CROPS[s.itemId]) mycropsMap[s.itemId] = (mycropsMap[s.itemId]||0) + s.qty;
    }
    const mycrops = Object.entries(mycropsMap);
    if (mycrops.length) {
      const best = mycrops.map(([id,qty])=>({id,qty,val:(economy.prices[id]||BASE_PRICES[id]||0)*qty})).sort((a,b)=>b.val-a.val)[0];
      inventorySect = `<div class="npc-section">📦 In your bag</div><div class="npc-tip-row">${CROPS[best.id].icon} ${best.qty}× ${CROPS[best.id].name} — best value at $${best.val} · <span style="color:#aaa;font-size:9px">sell at market →</span></div>`;
    }

    const openBtn = `<button onclick="closeNpcTalk();openMarket();setMktTab('buysell')" style="margin-top:8px;width:100%;padding:6px;font-size:var(--ui-font-xs);font-family:var(--font-main);cursor:pointer;background:rgba(110,85,40,.15);border:1px solid rgba(140,105,40,.45);border-radius:0;color:var(--parchment);letter-spacing:.06em;text-transform:uppercase">Open Market →</button>`;

    bodyHtml = infoRows + priceSection + seasonSection + inventorySect + openBtn;

  } else if (npcId === 'rex') {
    title = '📋 TRADER REX';
    portrait = '📋';
    name  = 'Trader Rex';
    role  = 'Contract Broker · East of market';

    const accepted = activeContracts.filter(c => c.accepted);
    const open     = activeContracts.filter(c => !c.accepted);

    const _rexBySeason = {
      'Dry Summer': [
        `"Summer contracts run hot — the buyers want food and they want it before the heat ruins it. Move fast."`,
        `"Dust storms push the deadlines. I try to build in a day of buffer. Clients don't always agree."`,
        `"The outpost in the Badlands is buying more in summer. Heat makes people desperate and desperate people pay."`,
        `"Week ${Math.floor((day-1)/DEBT_WEEK_LENGTH)+1}. Summer's a good time to get ahead on the debt. Prices are up."`,
      ],
      'Harvest Fall': [
        `"Fall's the contract season. Everyone wants to stock up. Every order I post gets filled faster than usual."`,
        `"The buyers can smell autumn. Grain, root vegetables, cured meat — they want it all. I can barely keep up."`,
        `"Precision. Reliability. Fall buyers pay on time and pay well. Don't miss a deadline this season."`,
        `"Week ${Math.floor((day-1)/DEBT_WEEK_LENGTH)+1}. Best earning window of the year. I mean that."`,
      ],
      'Cold Winter': [
        `"Winter slows some buyers and makes others desperate. Desperate buyers accept worse terms. That's not my business to judge."`,
        `"Storm delays are a valid force majeure. Tell me before the deadline, not after. That's the rule."`,
        `"The mine contracts pay well in winter. Buyers know fewer people are going down there."`,
        `"Week ${Math.floor((day-1)/DEBT_WEEK_LENGTH)+1}. Winter weeks are long. Keep working."`,
      ],
      'Wet Spring': [
        `"Spring buyers want herbs, flowers, rare fish. The seasonal stuff. It moves fast and the margin's good."`,
        `"Rain means growth. Growth means supply. Supply means I have to keep the contracts competitive. It's a whole thing."`,
        `"Every deal I offer is straight. Spring buyers especially — they've got budgets to spend before summer."`,
        `"Week ${Math.floor((day-1)/DEBT_WEEK_LENGTH)+1}. Spring's a good time to clear the board."`,
      ],
    };
    const greetings = (_rexBySeason[season.name] || _rexBySeason['Dry Summer']);
    speech = greetings[day % greetings.length];

    // Streak info
    const streak = (typeof contractStreak !== 'undefined') ? contractStreak : 0;
    const completed = (typeof completedContracts !== 'undefined') ? completedContracts.length : 0;

    let infoRows = `<div class="npc-info-row">
      <span class="npc-badge blue">${completed} completed</span>
      ${streak >= 2 ? `<span class="npc-badge green">🔥 ${streak}-streak</span>` : ''}
      <span class="npc-badge">${open.length} open · ${accepted.length} accepted</span>
    </div>`;

    let activeSection = '';
    if (accepted.length) {
      activeSection = `<div class="npc-section">📌 Your active contracts</div>`;
      for (const c of accepted) {
        const have = typeof countItem === 'function' ? countItem(c.id) : 0;
        const pct  = Math.min(1, have / c.qty);
        const daysLeft = c.deadline - day;
        const color = daysLeft <= 1 ? '#e05030' : daysLeft <= 3 ? '#d09020' : '#96c265';
        activeSection += `<div class="npc-contract-row">
          <span style="font-size:16px">${(ITEMS[c.id]&&ITEMS[c.id].icon)||'📦'}</span>
          <div style="flex:1">
            <div style="font-size:var(--ui-font-xs);color:var(--bone)">${c.qty}× ${(ITEMS[c.id]&&ITEMS[c.id].name)||c.id} — $${c.reward}</div>
            <div style="font-size:9px;color:${color}">Due day ${c.deadline} · ${daysLeft <= 0 ? 'OVERDUE' : daysLeft+'d left'} · have ${have}</div>
            <div class="npc-contract-progress"><div class="npc-contract-fill" style="width:${Math.round(pct*100)}%"></div></div>
          </div>
        </div>`;
      }
    }

    // Top reward open contract hint
    let openSection = '';
    if (open.length) {
      const best = open.sort((a,b)=>b.reward-a.reward)[0];
      openSection = `<div class="npc-section">✨ Best open contract right now</div>
        <div class="npc-tip-row">${(ITEMS[best.id]&&ITEMS[best.id].icon)||'📦'} ${best.qty}× ${(ITEMS[best.id]&&ITEMS[best.id].name)||best.id} — <b style="color:#d4b040">$${best.reward}</b> · due day ${best.deadline}</div>`;
    }

    // Categories rex is buying (top-paying per category)
    const byCategory = {};
    for (const c of activeContracts) {
      if (!byCategory[c.category] || c.reward > byCategory[c.category].reward) byCategory[c.category] = c;
    }
    let catSection = '';
    const catIcons = {crop:'🌾',gather:'🪵',fish:'🐟',combat:'⚔️',ore:'⛏',crafted:'🔨',animal:'🐄'};
    const catEntries = Object.entries(byCategory);
    if (catEntries.length) {
      catSection = `<div class="npc-section">📊 What buyers want this rotation</div>`;
      for (const [cat, c] of catEntries) {
        catSection += `<div class="npc-tip-row">${catIcons[cat]||'📦'} ${cat} — top payer wants ${c.qty}× ${(ITEMS[c.id]&&ITEMS[c.id].name)||c.id}</div>`;
      }
    }

    const openBtn = `<button onclick="closeNpcTalk();openMarket();setMktTab('contracts')" style="margin-top:8px;width:100%;padding:6px;font-size:var(--ui-font-xs);font-family:var(--font-main);cursor:pointer;background:rgba(48,88,140,.12);border:1px solid rgba(48,88,140,.4);border-radius:0;color:#90c8f0;letter-spacing:.06em;text-transform:uppercase">View All Contracts →</button>`;

    bodyHtml = infoRows + activeSection + openSection + catSection + openBtn;
  }

  document.getElementById('npcTalkTitle').innerHTML = `${portrait} ${title} <button class="panel-close" onclick="closeNpcTalk()">CLOSE [E]</button>`;
  document.getElementById('npcTalkBody').innerHTML = `
    <div class="npc-header">
      <div class="npc-portrait">${portrait}</div>
      <div class="npc-name-block">
        <div class="npc-name">${name}</div>
        <div class="npc-role">${role}</div>
      </div>
    </div>
    <div class="npc-speech">${speech}</div>
    ${bodyHtml}
  `;
}