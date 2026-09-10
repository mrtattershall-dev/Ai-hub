function renderHistory(body) {
  const items = [
    {id:'carrot',name:'Carrot',icon:'🥕'},{id:'corn',name:'Corn',icon:'🌽'},
    {id:'pumpkin',name:'Pumpkin',icon:'🎃'},{id:'glowroot',name:'Glowroot',icon:'✨'},
  ];
  let h = `<div style="font-size:9px;color:#6a5020;margin-bottom:10px">PRICE HISTORY — last 10 days</div>`;
  for (const item of items) {
    const hist = economy.hist[item.id] || [];
    const cur  = economy.prices[item.id];
    const all  = [...hist, cur];
    const mx   = Math.max(...all, 1);
    const W=220, H=40;
    let pts = '';
    all.forEach((p,i) => { const x=i/(all.length-1||1)*W; const y=H-(p/mx*H*.9); pts+=(i===0?'M':'L')+x.toFixed(1)+','+y.toFixed(1); });
    const col = cur>(BASE_PRICES[item.id]||1)*1.1 ? '#60e060' : cur<(BASE_PRICES[item.id]||1)*.9 ? '#e06060' : '#d4b870';
    h += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:7px;background:rgba(255,255,255,.02);border-radius:3px;">
      <span style="font-size:14px;width:20px">${item.icon}</span>
      <span style="font-size:10px;color:#c0a060;width:60px">${item.name}</span>
      <svg width="${W}" height="${H}" style="flex-shrink:0"><path d="${pts}" stroke="${col}" stroke-width="1.5" fill="none"/></svg>
      <span style="font-size:11px;color:${col};min-width:34px;text-align:right">$${cur}</span>
    </div>`;
  }
  body.innerHTML = h;
}