function renderLivestock(body) {
  const penCount = pens.length;
  const animalCount = animals.filter(a => a.hp > 0).length;

  let h = `<div style="font-size:9px;color:#6a5020;margin-bottom:8px">LIVESTOCK — buy animals for your pens</div>`;

  h += `<div style="display:flex;gap:16px;margin-bottom:10px;padding:7px;background:rgba(255,255,255,.03);border-radius:4px;font-size:9px;color:#907050">
    <span>🐾 Animals: ${animalCount}</span>
    <span>🏡 Pens: ${penCount}</span>
    <span>🪣 Trough: ${Math.round(troughFill)}%</span>
  </div>`;

  if (penCount === 0) {
    h += `<div style="color:#e07050;font-size:9px;padding:10px;background:rgba(220,80,40,.08);border-radius:4px;margin-bottom:8px">⚠️ No pens placed. Build a pen first — use [R] in Ranch mode.</div>`;
  }

  for (const [type, def] of Object.entries(ANIMAL_DEFS)) {
    const owned = animals.filter(a => a.type===type && a.hp>0).length;
    const canAfford = player.gold >= def.buyCost;
    const pen = pens.find(p => p.type===type || p.type==='any');
    const hasPen = !!pen;
    const cap = pen ? getPenCapacity(pen) : (PEN_CAPACITY[type] || 2);
    const inPen = pen ? getPenAnimalCount(pen) : 0;
    const penFull = hasPen && inPen >= cap;
    const canBuy = canAfford && hasPen && !penFull;
    const penLabel = hasPen ? `${inPen}/${cap} in pen` : 'No pen — [R]';
    const penColor = penFull ? '#e07040' : hasPen ? '#80c060' : '#907050';
    h += `<div class="price-row" style="flex-wrap:wrap;gap:4px">
      <span style="font-size:18px">${def.icon}</span>
      <span class="pr-name">${def.name}</span>
      <span style="flex:1;font-size:8px;color:#705030">${def.desc}</span>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
        <span style="font-size:8px;color:${penColor}">${penLabel}</span>
        <span style="font-size:8px;color:#60c080">+$${def.productValue}/${def.productRate===1?'day':def.productRate+'d'}</span>
        <span style="font-size:8px;color:#906040">Feed: ${def.feedCost}/day</span>
      </div>
      <span class="pr-price" style="color:#80b0f0">$${def.buyCost}</span>
      <button class="btn-buy" onclick="buyAnimal('${type}')"
        ${!canBuy?'disabled style="opacity:.4"':''}>BUY</button>
    </div>`;
  }

  h += `<div style="margin-top:12px;font-size:9px;color:#6a5020">SELL RANCH PRODUCTS</div>`;
  const ranchProds = ['egg','wool','milk'];
  for (const id of ranchProds) {
    const qty = countItem(id);
    const price = economy.prices[id] || BASE_PRICES[id] || 10;
    const total = qty * price;
    h += `<div class="price-row">
      <span class="pr-icon">${ITEMS[id].icon}</span>
      <span class="pr-name">${ITEMS[id].name}</span>
      <span style="flex:1;font-size:8px;color:#705030">${ITEMS[id].desc}</span>
      <span class="pr-held">${qty} held</span>
      <span class="pr-price">$${price}</span>
      <button class="btn-sell" onclick="sellItem('${id}',${qty})" ${qty===0?'disabled':''}>SELL ALL ($${total})</button>
    </div>`;
  }

  body.innerHTML = h;
}