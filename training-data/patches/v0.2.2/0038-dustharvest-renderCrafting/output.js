function renderCrafting(body) {
  // ── Filter state ────────────────────────────────────────────────────────────
  if (!window._craftFilter) window._craftFilter = 'all';
  if (!window._craftSearch) window._craftSearch = '';
  const activeFilter = window._craftFilter;
  const searchTerm   = window._craftSearch.toLowerCase().trim();

  // ── Station availability ────────────────────────────────────────────────────
  const forgeAvail    = !!player._mineForge;
  const benchAvail    = !!player._workbenchUnlocked;
  const campAvail     = !!player._campfireUnlocked;
  const nearCampfire  = (() => { const ptx=Math.floor(player.x/T),pty=Math.floor(player.y/T); return Math.abs(ptx-CAMPFIRE_TX)<=2&&Math.abs(pty-CAMPFIRE_TY)<=2; })();
  const nearBench     = (() => { const ptx=Math.floor(player.x/T),pty=Math.floor(player.y/T); return Math.abs(ptx-WORKBENCH_TX)<=2&&Math.abs(pty-WORKBENCH_TY)<=2; })();

  // ── Merge food+cooking → cooking, goods → components ───────────────────────
  const DISPLAY_CATS = [
    { key:'all',        label:'All',        icon:'⚒'  },
    { key:'cooking',    label:'Cooking',    icon:'🔥'  },
    { key:'components', label:'Components', icon:'⚙'  },
    { key:'supplies',   label:'Supplies',   icon:'🔦'  },
    { key:'medical',    label:'Medical',    icon:'🩹'  },
  ];

  // Normalise category: food → cooking, goods → components
  function normCat(cat) {
    if (cat === 'food' || cat === 'cooking') return 'cooking';
    if (cat === 'goods') return 'components';
    return cat;
  }

  // ── Filter bar ──────────────────────────────────────────────────────────────
  let h = `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">`;

  // Search input
  h += `<input id="craftSearchInput" type="text" placeholder="Search recipes…"
    value="${window._craftSearch||''}"
    oninput="window._craftSearch=this.value;refreshMarketUI()"
    style="width:100%;box-sizing:border-box;padding:5px 9px;font-family:'Special Elite',serif;
      font-size:10px;background:rgba(255,255,255,.04);border:1px solid rgba(180,140,60,.25);
      border-radius:3px;color:#d4b870;outline:none;">`;

  // Category dropdown
  h += `<select onchange="window._craftFilter=this.value;refreshMarketUI()"
    style="width:100%;box-sizing:border-box;padding:5px 9px;font-family:'Special Elite',serif;
      font-size:10px;background:rgba(20,14,8,.95);border:1px solid rgba(180,140,60,.3);
      border-radius:3px;color:#d4b870;outline:none;cursor:pointer">`;
  for (const cat of DISPLAY_CATS) {
    const craftable = CRAFTING_RECIPES.filter(r =>
      (cat.key === 'all' || normCat(r.category) === cat.key) && canCraftRecipe(r).ok
    ).length;
    const label = cat.icon + ' ' + cat.label + (craftable > 0 ? ` (${craftable} ready)` : '');
    h += `<option value="${cat.key}" ${activeFilter===cat.key?'selected':''}>${label}</option>`;
  }
  h += `</select>`;

  // Station status — compact inline
  const stations = [
    { label:'Campfire', avail: campAvail && nearCampfire, locked: !campAvail, hint: !campAvail?'Buy $120':'Walk to campfire' },
    { label:'Workbench', avail: benchAvail && nearBench, locked: !benchAvail, hint: !benchAvail?'Buy $300':'Walk to workbench' },
    { label:'Mine Forge', avail: forgeAvail, locked: !forgeAvail, hint: 'Buy in Mine upgrades' },
  ];
  h += `<div style="display:flex;gap:5px;flex-wrap:wrap">`;
  for (const s of stations) {
    h += `<span style="font-size:8px;padding:2px 7px;border-radius:10px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(180,140,60,${s.avail?'.3':'.1'});
      color:${s.avail?'#80c040':s.locked?'#504030':'#907030'}"
      title="${s.hint}">
      ${s.avail?'✓':s.locked?'✗':'!'} ${s.label}
    </span>`;
  }
  h += `</div></div>`;

  // ── Recipe list ─────────────────────────────────────────────────────────────
  const STATION_STYLE = {
    hand:      { icon:'✋', color:'#80a060', label:'Anywhere'  },
    workbench: { icon:'🪚', color:'#d0a060', label:'Workbench' },
    forge:     { icon:'🔥', color:'#e08030', label:'Forge'     },
    campfire:  { icon:'🍳', color:'#e06820', label:'Campfire'  },
  };

  const visible = CRAFTING_RECIPES.filter(r => {
    if (activeFilter !== 'all' && normCat(r.category) !== activeFilter) return false;
    if (searchTerm) {
      const hay = (r.name + r.desc + (ITEMS[r.output]?.name||'')).toLowerCase();
      if (!hay.includes(searchTerm)) return false;
    }
    return true;
  });

  if (visible.length === 0) {
    h += `<div style="text-align:center;padding:24px 0;font-size:9px;color:#504020;font-style:italic">
      No recipes match — clear the search or try a different filter.
    </div>`;
  }

  // Group by category for display (only if showing "all")
  const groups = {};
  for (const r of visible) {
    const g = normCat(r.category);
    if (!groups[g]) groups[g] = [];
    groups[g].push(r);
  }

  const GROUP_META = {
    cooking:    { label:'🔥 CAMPFIRE COOKING', color:'#e08030', desc:'Hearty meals — sell for premium or eat for buffs. Each recipe uses 1 coal as fuel.' },
    components: { label:'⚙ COMPONENTS & GOODS', color:'#90b8d0', desc:'Intermediate materials and sellable goods.' },
    supplies:   { label:'🔦 SUPPLIES', color:'#c0b080', desc:'Useful tools and gear for exploring.' },
    medical:    { label:'🩹 MEDICAL', color:'#d08080', desc:'Healing items crafted from herbs and cloth.' },
  };

  // Collapsible section state — cooking starts collapsed (biggest category)
  if (!window._craftSectionCollapsed) window._craftSectionCollapsed = { cooking: true, components: true, supplies: true, medical: true };

  const groupOrder = ['cooking','components','supplies','medical'];

  for (const gk of groupOrder) {
    const recipes = groups[gk];
    if (!recipes || !recipes.length) continue;

    if (activeFilter === 'all') {
      const gm = GROUP_META[gk];
      const canAny = recipes.some(r => canCraftRecipe(r).ok);
      const collapsed = !!window._craftSectionCollapsed[gk];
      h += `<div onclick="window._craftSectionCollapsed['${gk}']=!window._craftSectionCollapsed['${gk}'];refreshMarketUI()"
        style="display:flex;align-items:center;justify-content:space-between;
          cursor:pointer;user-select:none;-webkit-user-select:none;
          font-size:9px;font-weight:bold;color:${gm.color};
          margin:8px 0 0;padding:5px 7px;
          background:rgba(255,255,255,.025);
          border:1px solid rgba(180,140,60,${canAny?'.22':'.10'});">
        <span>${gm.label}
          <span style="font-size:8px;color:#504828;font-weight:normal;margin-left:5px">${recipes.length} recipe${recipes.length>1?'s':''}</span>
          ${canAny?`<span style="color:#60c040;font-size:8px;margin-left:4px">● ${recipes.filter(r=>canCraftRecipe(r).ok).length} ready</span>`:''}
        </span>
        <span style="font-size:10px;color:#705030">${collapsed?'▶':'▼'}</span>
      </div>`;
      if (collapsed) continue;
      if (gm.desc) h += `<div style="font-size:8px;color:#504828;margin:3px 0 6px;padding:0 2px">${gm.desc}</div>`;
    }

    for (const recipe of recipes) {
      const check    = canCraftRecipe(recipe);
      const haveAll  = check.ok;
      const outItem  = ITEMS[recipe.output];
      const st       = STATION_STYLE[recipe.station] || STATION_STYLE.hand;

      // Max batches
      let maxBatches = 99;
      for (const ing of recipe.ingredients) maxBatches = Math.min(maxBatches, Math.floor(countItem(ing.id)/ing.qty));
      maxBatches = Math.min(maxBatches, Math.floor(player.stamina / recipe.staminaCost));
      maxBatches = Math.max(0, maxBatches);

      // Ingredients row
      const ingParts = recipe.ingredients.map(ing => {
        const have   = countItem(ing.id);
        const enough = have >= ing.qty;
        const name   = ITEMS[ing.id]?.name || ing.id;
        const icon   = ITEMS[ing.id]?.icon || '';
        return `<span style="color:${enough?'#90d070':'#e07050'}">${icon} ${ing.qty}×${name}<span style="opacity:.6">(${have})</span></span>`;
      }).join('<span style="color:#504030;margin:0 3px">+</span>');

      h += `<div style="display:grid;grid-template-columns:auto 1fr auto;gap:8px;
        align-items:center;padding:7px 9px;margin-bottom:3px;
        background:rgba(255,255,255,${haveAll?'.04':'.015'});
        border:1px solid rgba(180,140,60,${haveAll?'.22':'.08'});
        opacity:${haveAll?1:.65}">

        <span style="font-size:18px;line-height:1">${recipe.icon}</span>

        <div style="min-width:0">
          <div style="display:flex;align-items:baseline;gap:5px;margin-bottom:2px;flex-wrap:wrap">
            <span style="font-size:10px;color:${haveAll?'#d4b870':'#907050'};font-weight:bold">${recipe.name}</span>
            <span style="font-size:8px;color:${st.color}">${st.icon} ${st.label}</span>
            <span style="font-size:8px;color:#506840;margin-left:auto">⚡${recipe.staminaCost}</span>
          </div>
          <div style="font-size:8px;color:#605030;margin-bottom:4px;line-height:1.4">${recipe.desc}</div>
          <div style="font-size:8px;display:flex;flex-wrap:wrap;align-items:center;gap:4px;line-height:1.6">
            ${ingParts}
            <span style="color:#506840;font-weight:bold;margin:0 2px">→</span>
            <span style="color:${haveAll?'#90d080':'#60a060'}">${outItem?.icon||'?'} ${recipe.outputQty}× ${outItem?.name||recipe.output}</span>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-end;min-width:68px">
          ${haveAll
            ? `<button class="btn-buy" onclick="craftItem('${recipe.id}',1);setMktTab('crafting')" style="white-space:nowrap;font-size:9px">CRAFT ×1</button>
               ${maxBatches>1?`<button class="btn-buy" onclick="craftItem('${recipe.id}',${maxBatches});setMktTab('crafting')" style="white-space:nowrap;font-size:8px;opacity:.8">ALL ×${maxBatches}</button>`:''}`
            : `<span style="font-size:8px;color:#704030;text-align:right;line-height:1.4">${check.reason}</span>`
          }
        </div>
      </div>`;
    }
  }

  // ── Crafted items in bag ────────────────────────────────────────────────────
  const craftedHeld = Object.keys(ITEMS).filter(id => ITEMS[id].type==='crafted' && countItem(id)>0);
  if (craftedHeld.length > 0) {
    h += `<div style="font-size:9px;font-weight:bold;color:#80a890;
      margin:14px 0 5px;padding-bottom:4px;
      border-top:1px solid rgba(180,140,60,.15);padding-top:10px;letter-spacing:.05em">
      📦 IN BAG</div>`;
    h += `<div style="display:flex;flex-wrap:wrap;gap:4px">`;
    for (const id of craftedHeld) {
      const it  = ITEMS[id];
      const qty = countItem(id);
      h += `<div style="display:flex;align-items:center;gap:5px;padding:4px 8px;
        background:rgba(255,255,255,.03);border:1px solid rgba(180,140,60,.14);
        font-size:9px;color:#b09060">
        <span style="font-size:13px">${it.icon}</span>
        <span>${it.name}</span>
        <span style="color:#d4b870;font-weight:bold">${qty}</span>
      </div>`;
    }
    h += `</div>`;
  }

  const _searchWasFocused = document.activeElement?.id === 'craftSearchInput';
  body.innerHTML = h;

  // Re-focus search if it was active
  if (searchTerm || _searchWasFocused) {
    const inp = body.querySelector('#craftSearchInput');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }
}