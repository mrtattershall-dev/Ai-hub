function renderHomeFurnitureShop() {
  const el = document.getElementById('homeFurnitureShop');
  if (!el) return;
  let h = '';
  for (const def of Object.values(HOME_FURNITURE)) {
    const owned = homeFurnitureOwned(def.id);
    h += `<div style="display:flex;align-items:center;gap:8px;padding:5px 6px;margin-bottom:3px;background:rgba(255,255,255,.02);border:1px solid rgba(55,92,28,.${owned?'28':'15'});border-left:2px solid rgba(${owned?'72,122,36,.6':'72,122,36,.18'});border-radius:0;">
      <span style="font-size:16px;">${def.icon}</span>
      <div style="flex:1;">
        <div style="font-size:var(--ui-font-sm);color:${owned?'#96c265':'#a09060'};margin-bottom:1px;">${def.name}${owned?' <span style="color:#60a840;font-size:9px;">✓ PLACED</span>':''}</div>
        <div style="font-size:var(--ui-font-xs);color:rgba(95,122,55,.65);">${def.bonus}</div>
      </div>
      ${owned
        ? `<span style="font-size:9px;color:#506030;">owned</span>`
        : `<button onclick="buyHomeFurniture('${def.id}')" style="padding:3px 9px;font-size:8px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(55,92,28,.1);border:1px solid rgba(72,132,45,.4);border-radius:0;color:#88b856;" ${player.gold<def.cost?'disabled':''}>$${def.cost}</button>`
      }
    </div>`;
  }
  el.innerHTML = h;
}