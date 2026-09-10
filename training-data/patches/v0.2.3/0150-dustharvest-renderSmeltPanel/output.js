function renderSmeltPanel() {
  const body = document.getElementById('smeltBody');
  if (!body) return;
  let h = '';
  for (const recipe of SMELT_RECIPES) {
    const oreHeld = countItem(recipe.ore);
    const canSmelt = oreHeld >= recipe.oreQty && player.stamina >= 5;
    const batchesAvail = Math.floor(oreHeld / recipe.oreQty);
    const orePrice = economy.prices[recipe.ore] || BASE_PRICES[recipe.ore] || 10;
    const barPrice = economy.prices[recipe.bar] || BASE_PRICES[recipe.bar] || 50;
    const valueDiff = barPrice - orePrice * recipe.oreQty;
    h += `<div style="display:flex;align-items:center;gap:10px;padding:10px 8px;margin-bottom:6px;background:rgba(255,255,255,.03);border:1px solid rgba(200,100,30,${canSmelt?'.3':'.12'});border-radius:4px;">
      <span style="font-size:22px">${recipe.icon}</span>
      <div style="flex:1">
        <div style="font-size:10px;color:#e0a040;font-weight:bold">${recipe.name}</div>
        <div style="font-size:8px;color:#706030;margin-top:2px">${recipe.oreQty}× ${ITEMS[recipe.ore]?.name||recipe.ore} → 1 bar · costs 5 stamina</div>
        <div style="font-size:8px;color:#70a040;margin-top:1px">$${orePrice*recipe.oreQty} ore → $${barPrice} bar (+$${valueDiff} profit)</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:9px;color:#a07040;margin-bottom:3px">${oreHeld} ore · ${batchesAvail} batch${batchesAvail!==1?'es':''}</div>
        <button onclick="smeltOre('${recipe.ore}','${recipe.bar}',${recipe.oreQty},1)" style="padding:4px 10px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;border-radius:3px;background:rgba(200,100,20,.15);border:1px solid rgba(200,100,20,.${canSmelt?'5':'2'});color:${canSmelt?'#e0a030':'#604020'}" ${!canSmelt?'disabled':''}>SMELT 1</button>
        ${batchesAvail>1?`<button onclick="smeltOre('${recipe.ore}','${recipe.bar}',${recipe.oreQty},${batchesAvail})" style="margin-left:4px;padding:4px 10px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;border-radius:3px;background:rgba(200,100,20,.25);border:1px solid rgba(200,100,20,.6);color:#e0c050" ${!canSmelt?'disabled':''}>ALL (${batchesAvail})</button>`:''}
      </div>
    </div>`;
  }
  body.innerHTML = h || '<div style="color:#504020;font-size:9px;padding:12px">No ore to smelt. Mine ore first!</div>';
}