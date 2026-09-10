function renderUpgrades(body) {
  const cats = [
    { key:'tools',   label:'🔧 TOOLS & CARRYING', color:'#80c0e0' },
    { key:'weapons', label:'⚔ COMBAT & DEFENSE',   color:'#e08060' },
    { key:'farm',    label:'🌿 FARM AUTOMATION',    color:'#80e080' },
    { key:'ranch',   label:'🐄 RANCH & DEFENSE',    color:'#e0c060' },
    { key:'mine',    label:'⛏ MINE & SMELTING',    color:'#c09050' },
    { key:'ocean',   label:'⚓ DOCK & VESSELS',     color:'#60a8d8' },
  ];
  let h = `<div style="font-size:9px;color:#6a5020;margin-bottom:10px">UPGRADES — purchased permanently, no refunds partner.</div>`;

  for (const cat of cats) {
    h += `<div style="font-size:10px;font-weight:bold;color:${cat.color};margin:12px 0 6px;letter-spacing:.05em;border-bottom:1px solid rgba(180,140,60,.12);padding-bottom:4px">${cat.label}</div>`;
    const items = UPGRADES.filter(u => u.category === cat.key);
    for (const upg of items) {
      const bought = purchasedUpgrades.has(upg.id);
      const locked = upg.requires && !purchasedUpgrades.has(upg.requires);
      const canAfford = player.gold >= upg.cost;
      const reqName = upg.requires ? (UPGRADES.find(u=>u.id===upg.requires)||{}).name : '';
      h += `<div style="display:flex;align-items:center;gap:8px;padding:7px 9px;margin-bottom:3px;background:rgba(255,255,255,.02);border:1px solid rgba(180,140,60,${bought?'.4':locked?'.06':'.14'});border-radius:4px;opacity:${locked ? 0.45 : 1}">
        <span style="font-size:18px;width:24px;text-align:center">${upg.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;color:${bought?'#80e060':locked?'#605040':'#d4b870'};font-weight:bold">${upg.name} ${bought?'✓':''}</div>
          <div style="font-size:8px;color:#705830;margin-top:2px;line-height:1.4">${upg.desc}</div>
          ${locked?`<div style="font-size:8px;color:#805030;margin-top:2px">🔒 Requires: ${reqName}</div>`:''}
        </div>
        <div style="text-align:right;flex-shrink:0">
          ${upg.repeatable
            ? `<div style="font-size:11px;color:${canAfford?'#f0d060':'#805030'};margin-bottom:3px">$${upg.cost}</div>
               <div style="font-size:8px;color:#60c040;margin-bottom:3px">In bag: ${countItem(upg.id==='autoWater'?'sprinkler':upg.id)}</div>
               <button class="btn-buy" onclick="buyUpgrade('${upg.id}')" ${locked||!canAfford?'disabled':''}>BUY</button>`
            : bought
              ? `<span style="font-size:9px;color:#60d040">OWNED</span>`
              : `<div style="font-size:11px;color:${canAfford?'#f0d060':'#805030'};margin-bottom:3px">$${upg.cost}</div>
                 <button class="btn-buy" onclick="buyUpgrade('${upg.id}')" ${locked||!canAfford?'disabled':''}>BUY</button>`
          }
        </div>
      </div>`;
    }
  }
  body.innerHTML = h;
}