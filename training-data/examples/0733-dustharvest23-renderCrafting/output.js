function renderCrafting(body) {
  let h = `<div style="font-size:9px;color:#6a5020;margin-bottom:10px;letter-spacing:.04em">
    ⚒ CRAFTING — combine materials into useful goods and components.
    <span style="color:#504830"> Stamina is consumed per craft.</span>
  </div>`;

  // Station status bar
  const forgeAvail = !!player._mineForge;
  const benchAvail = !!player._workbenchUnlocked;
  h += `<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">`;
  for (const [key, st] of Object.entries(CRAFT_STATION_LABEL)) {
    const avail = key === 'forge' ? forgeAvail : (key === 'hand' || key === 'workbench') ? benchAvail : false;
    h += `<div style="display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:3px;
      background:rgba(255,255,255,.03);border:1px solid rgba(180,140,60,${avail ? '.22' : '.10'});
      font-size:8px;color:${avail?st.color:'#504030'}">
      ${st.icon} ${st.label}
      <span style="margin-left:3px;color:${avail?'#60c040':'#e06040'}">${avail?'✓':'✗'}</span>
    </div>`;
  }
  h += `</div>`;

  // Collapsible category state — persists across re-renders
  if (!window._craftCollapsed) window._craftCollapsed = {};

  for (const cat of CRAFT_CATEGORIES) {
    const recipes = CRAFTING_RECIPES.filter(r => r.category === cat.key);
    if (!recipes.length) continue;
    const collapsed = !!window._craftCollapsed[cat.key];
    const canMakeAny = recipes.some(r => canCraftRecipe(r).ok);

    h += `<div onclick="window._craftCollapsed['${cat.key}']=!window._craftCollapsed['${cat.key}'];refreshMarketUI()"
      style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;
        font-size:10px;font-weight:bold;color:${cat.color};
        margin:10px 0 3px;letter-spacing:.05em;
        padding:5px 8px;border-radius:3px;
        background:rgba(255,255,255,${canMakeAny?'.05':'.02'});
        border:1px solid rgba(180,140,60,${canMakeAny?'.22':'.08'});
        user-select:none;-webkit-user-select:none;">
      <span>${cat.label}&nbsp;${canMakeAny?'<span style=\"color:#60c040;font-size:8px\">●</span>':''}</span>
      <span style="font-size:11px;color:#705030;margin-left:8px">${collapsed?'▶':'▼'}</span>
    </div>`;
    if (collapsed) continue; // user collapsed this section
    h += `<div style="font-size:8px;color:#504828;margin-bottom:8px;padding:0 4px">${cat.desc}</div>`;

    for (const recipe of recipes) {
      const check   = canCraftRecipe(recipe);
      const outItem = ITEMS[recipe.output];
      const station = CRAFT_STATION_LABEL[recipe.station];
      const haveAll = check.ok;

      // Build ingredient chips
      let ingHtml = '';
      for (const ing of recipe.ingredients) {
        const have    = countItem(ing.id);
        const enough  = have >= ing.qty;
        const ingItem = ITEMS[ing.id];
        ingHtml += `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;
          border-radius:3px;font-size:8px;margin-right:4px;margin-bottom:2px;
          background:rgba(255,255,255,.04);
          border:1px solid rgba(${enough?'80,180,80':'180,60,40'},.3);
          color:${enough?'#90d070':'#e07050'}">
          ${ingItem?.icon||'?'} ${ing.qty}× ${ingItem?.name||ing.id}
          <span style="color:${enough?'#508040':'#804030'}">(${have})</span>
        </span>`;
      }

      // How many full batches player can make right now
      let maxBatches = 99;
      for (const ing of recipe.ingredients) maxBatches = Math.min(maxBatches, Math.floor(countItem(ing.id)/ing.qty));
      maxBatches = Math.min(maxBatches, Math.floor(player.stamina / recipe.staminaCost));
      maxBatches = Math.max(0, maxBatches);

      h += `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;margin-bottom:4px;
        background:rgba(255,255,255,${haveAll ? '.04' : '.02'});
        border:1px solid rgba(180,140,60,${haveAll ? '.2' : '.08'});
        border-radius:4px;opacity:${haveAll?1:.7}">

        <span style="font-size:20px;flex-shrink:0;line-height:1.2">${recipe.icon}</span>

        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:3px">
            <span style="font-size:10px;color:#d4b870;font-weight:bold">${recipe.name}</span>
            <span style="font-size:8px;color:${station.color}">${station.icon} ${station.label}</span>
            <span style="font-size:8px;color:#60a840;margin-left:auto">⚡ ${recipe.staminaCost} stamina</span>
          </div>
          <div style="font-size:8px;color:#705830;margin-bottom:5px">${recipe.desc}</div>
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0">
            ${ingHtml}
            <span style="font-size:9px;color:#506840;margin-left:2px">→</span>
            <span style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;margin-left:4px;
              border-radius:3px;font-size:8px;background:rgba(80,160,80,.08);
              border:1px solid rgba(80,160,80,.25);color:#90d080">
              ${outItem?.icon||'?'} ${recipe.outputQty}× ${outItem?.name||recipe.output}
            </span>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0">
          ${haveAll
            ? `<button class="btn-buy" onclick="craftItem('${recipe.id}',1);setMktTab('crafting')" style="white-space:nowrap">CRAFT ×1</button>
               ${maxBatches>1?`<button class="btn-buy" onclick="craftItem('${recipe.id}',${maxBatches});setMktTab('crafting')"
                 style="white-space:nowrap;font-size:8px">CRAFT ×${maxBatches}</button>`:''}
              `
            : `<span style="font-size:8px;color:#704030;max-width:80px;text-align:right">${check.reason}</span>`
          }
        </div>
      </div>`;
    }
  }

  // Crafted items you currently hold
  const craftedHeld = Object.keys(ITEMS).filter(id => ITEMS[id].type==='crafted' && countItem(id)>0);
  if (craftedHeld.length > 0) {
    h += `<div style="font-size:10px;font-weight:bold;color:#80a890;margin:14px 0 6px;
      letter-spacing:.05em;border-bottom:1px solid rgba(180,140,60,.12);padding-bottom:4px">
      📦 CRAFTED ITEMS IN BAG</div>`;
    for (const id of craftedHeld) {
      const it  = ITEMS[id];
      const qty = countItem(id);
      h += `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;font-size:9px;
        border-bottom:1px solid rgba(180,140,60,.07);color:#c0a060">
        <span style="font-size:14px">${it.icon}</span>
        <span style="flex:1">${it.name}</span>
        <span style="color:#d4b870;font-weight:bold">${qty}</span>
        <span style="font-size:8px;color:#604828">${it.desc}</span>
      </div>`;
    }
  }

  body.innerHTML = h;
}