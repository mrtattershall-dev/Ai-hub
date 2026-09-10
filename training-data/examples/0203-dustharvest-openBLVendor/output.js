function openBLVendor() {
  blVendorOpen = true;
  const ov = document.getElementById('blVendorOverlay');
  if (!ov) return;

  const tabStyle = (t) => `padding:6px 14px;font-size:var(--ui-font-xs);font-family:'Special Elite',serif;cursor:pointer;border:none;border-bottom:2px solid ${blVendorTab===t?'#c09060':'transparent'};background:transparent;color:${blVendorTab===t?'#d4b870':'#605030'};letter-spacing:.04em;`;

  const metCrane = blTalkSeen.has('who_are_you');

  // Count new unlocked talk options
  const node = BL_FENCE_TALK.find(n => n.id === blFenceNode) || BL_FENCE_TALK[0];
  const opts = typeof node.options === 'function' ? node.options() : node.options;
  const newTalkOpts = opts.filter(id => id !== 'root_back' && !blTalkSeen.has(id));

  let h = `<div style="font-size:var(--ui-font-sm);color:#c09060;margin-bottom:6px;letter-spacing:.06em">`;
  h += `🤝 ${metCrane ? 'CRANE' : 'STRANGER'}`;
  if (blVendorTab === 'talk' && newTalkOpts.length)
    h += ` <span style="font-size:var(--ui-font-xs);color:#80e060;border:1px solid rgba(80,200,60,.4);padding:1px 5px;margin-left:6px">${newTalkOpts.length} NEW</span>`;
  h += `</div>`;

  const _blTrusted = getRepTier('badlands') === 'trusted' || getRepTier('badlands') === 'revered';
  h += `<div style="display:flex;gap:0;margin-bottom:10px;border-bottom:1px solid rgba(180,140,60,.15);">
    <button onclick="openBLVendorTab('sell')" style="${tabStyle('sell')}">SELL</button>
    <button onclick="openBLVendorTab('talk')" style="${tabStyle('talk')}">TALK${newTalkOpts.length&&blVendorTab!=='talk'?' ●':''}</button>
    ${_blTrusted ? `<button onclick="openBLVendorTab('backroom')" style="${tabStyle('backroom')}">BACK ROOM</button>` : ''}
  </div>`;

  if (blVendorTab === 'sell') {
    const items = BL_VENDOR_BUYS.filter(b => countItem(b.id) > 0);
    h += `<div style="font-size:var(--ui-font-xs);color:#705030;margin-bottom:8px">Buys Badlands goods. No questions asked. Premium over market.</div>`;
    if (items.length === 0) {
      h += `<div style="font-size:var(--ui-font-xs);color:#504020;padding:8px">Nothing to sell right now. Gather more loot.</div>`;
    } else {
      items.forEach(b => {
        const qty = countItem(b.id);
        const basePrice = economy.prices[b.id] || BASE_PRICES[b.id] || BL_BASE_PRICES[b.id] || 10;
        const vendorPrice = Math.round(basePrice * b.bonus);
        const total = vendorPrice * qty;
        h += `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:4px;background:rgba(255,255,255,.02);">
          <span style="font-size:16px">${ITEMS[b.id]?.icon||'?'}</span>
          <span style="flex:1;font-size:var(--ui-font-xs);color:#c0a060">${b.label} ×${qty}</span>
          <span style="font-size:var(--ui-font-xs);color:#80e060">$${vendorPrice}/ea</span>
          <button onclick="blVendorSell('${b.id}',${qty},${vendorPrice})" style="padding:3px 8px;font-size:var(--ui-font-xs);font-family:'Special Elite',serif;cursor:pointer;background:rgba(80,160,60,.18);border:1px solid rgba(80,160,60,.45);color:#80e060;border-radius:0">SELL ALL ($${total})</button>
        </div>`;
      });
    }
  } else if (blVendorTab === 'backroom') {
    // Back Room — trusted badlands rep unlocks rare purchase options (refresh daily)
    const _brSeed = gameState.day * 7 + 13;
    const _brRng = (s => { let _s=s; return () => { _s=(_s*1664525+1013904223)&0xffffffff; return (_s>>>0)/0xffffffff; } })(_brSeed);
    const _brPool = [
      { id:'obsidian',       name:'Obsidian',        price:220 },
      { id:'silverOre',      name:'Silver Ore',       price:190 },
      { id:'dustDevilEye',   name:'Dust Devil Eye',   price:340 },
      { id:'rattlerFang',    name:'Rattler Fang',     price:110 },
      { id:'scorpion2Stinger',name:'Bark Scorpion Stinger',price:280},
      { id:'sulfurDust',     name:'Sulfur Dust',      price:95  },
      { id:'vultureFeather', name:'Vulture Feather',  price:140 },
    ];
    const _brItems = [..._brPool].sort(()=>_brRng()-.5).slice(0,2);
    h += `<div style="font-size:var(--ui-font-xs);color:#705030;margin-bottom:8px">"You've earned a look at the real stock." He lifts a canvas flap. Two items, rotates daily.</div>`;
    _brItems.forEach(item => {
      const icon = ITEMS[item.id]?.icon || '?'; const canAfford = player.gold >= item.price;
      h += `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:4px;background:rgba(255,255,255,.02);">
        <span style="font-size:16px">${icon}</span>
        <span style="flex:1;font-size:var(--ui-font-xs);color:#c0a060">${item.name}</span>
        <span style="font-size:var(--ui-font-xs);color:#f0d060">$${item.price}</span>
        <button onclick="blBuyBackRoom('${item.id}',${item.price})" ${canAfford?'':`disabled style="opacity:.4"`} style="padding:3px 8px;font-size:var(--ui-font-xs);font-family:'Special Elite',serif;cursor:pointer;background:rgba(80,160,60,.18);border:1px solid rgba(80,160,60,.45);color:#80e060;border-radius:0">BUY</button>
      </div>`;
    });
  } else {
    // Talk tab — full scrollable dialogue
    h += `<div style="font-size:var(--ui-font-xs);color:#a08060;line-height:1.8;margin-bottom:14px;white-space:pre-wrap;border-left:2px solid rgba(180,140,60,.25);padding-left:9px;">${node.text}</div>`;
    opts.forEach(optId => {
      const opt = BL_FENCE_TALK.find(n => n.id === optId);
      if (!opt || !opt.label) return;
      const seen = blTalkSeen.has(optId);
      const isNewOpt = !seen && optId !== 'root_back';
      const borderAlpha = isNewOpt ? '.55' : seen ? '.1' : '.3';
      const color = isNewOpt ? '#e0c070' : seen ? '#4a3818' : '#c0a060';
      const bg = isNewOpt ? 'rgba(200,170,60,.06)' : 'rgba(255,255,255,.01)';
      const prefix = isNewOpt ? '★ ' : seen ? '↩ ' : '';
      h += `<button onclick="blFenceTalk('${optId}')" style="display:block;width:100%;text-align:left;padding:7px 10px;margin-bottom:4px;font-size:var(--ui-font-xs);font-family:'Special Elite',serif;cursor:pointer;background:${bg};border:1px solid rgba(180,140,60,${borderAlpha});border-radius:0;color:${color};">${prefix}"${opt.label}"</button>`;
    });
  }

  h += `<button onclick="closeBLVendor()" style="margin-top:10px;width:100%;font-size:var(--ui-font-xs);padding:6px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(60,40,20,.4);border:1px solid rgba(140,100,40,.3);color:#706040;border-radius:0">CLOSE [E]</button>`;
  ov.innerHTML = h;
  ov.style.display = 'block';
  ov.scrollTop = 0;
}