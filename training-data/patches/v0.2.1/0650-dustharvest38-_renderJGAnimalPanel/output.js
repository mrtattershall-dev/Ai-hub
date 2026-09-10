function _renderJGAnimalPanel() {
  const ov = document.getElementById('hcTalkOverlay');
  if (!ov) return;

  const total = jgAnimals.filter(a => a.hp > 0).length;
  const encs  = jgEnclosures.length;

  let rows = '';
  if (!encs) {
    rows = `<div style="font-size:9px;color:#507040;font-style:italic;padding:8px 0;">No enclosures built yet. Each animal costs gold from Tobias (except the Forest Boar — that one you earn).</div>`;
  } else {
    for (const enc of jgEnclosures) {
      const def = JG_ANIMAL_DEFS[enc.type];
      if (!def) continue;
      const encAnimals = jgAnimals.filter(a => a.enclosureId === enc.id && a.hp > 0);
      const troughPct = Math.round(enc.troughFill || 0);
      const troughColor = troughPct < 20 ? '#e06040' : troughPct < 50 ? '#e0b040' : '#70c040';

      // Special status
      let special = '';
      if (def.groupBonus) {
        const hasBonus = encAnimals.length >= def.groupMin;
        special = `<span style="font-size:7.5px;color:${hasBonus?'#80e060':'#907040'};">${hasBonus?'🦜 Group bonus active':'🦜 Need '+def.groupMin+' for bonus'}</span>`;
      }
      if (def.adjacencyRequired) {
        const hasPlant = def.adjacencyPlants.some(p => Object.values(jgPlots).some(plot => plot.crop === p));
        special = `<span style="font-size:7.5px;color:${hasPlant?'#80e060':'#e08040'};">${hasPlant?'🧵 Plant nearby ✓':'🧵 Needs Heartleaf/Cane Reed nearby'}</span>`;
      }

      rows += `
        <div style="background:rgba(30,50,20,.35);border:1px solid rgba(80,160,60,.2);border-radius:3px;padding:7px 9px;margin-bottom:7px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span style="font-size:10px;color:#90c880;">${def.icon} ${def.name} ×${encAnimals.length}</span>
            <span style="font-size:9px;color:${troughColor};">Trough ${troughPct}%</span>
          </div>
          <div style="font-size:8px;color:#608050;margin-bottom:3px;">${def.desc}</div>
          ${special ? `<div style="margin-bottom:3px;">${special}</div>` : ''}
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <span style="font-size:8px;color:#506040;">${def.productIcon} ${def.product} every ${def.productRate}d${def.product2?` · ${def.productIcon2} ${def.product2} every ${def.productRate2}d`:''}</span>
            <button onclick="_addAnimalToEnclosure(${enc.id})" style="padding:2px 8px;font-size:8px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(80,160,60,.1);border:1px solid rgba(80,160,60,.3);color:#70a060;border-radius:0;">+ Add Animal ($${def.buyCost})</button>
            <button onclick="_jgFillTrough(${enc.id})" style="padding:2px 8px;font-size:8px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(60,120,200,.1);border:1px solid rgba(60,120,200,.3);color:#6090c0;border-radius:0;">Fill Trough</button>
          </div>
        </div>`;
    }
  }

  // New enclosure buttons
  const canAfford = type => player.gold >= (JG_ANIMAL_DEFS[type]?.buyCost || 0);
  let buyRows = Object.entries(JG_ANIMAL_DEFS).map(([type, def]) => {
    const locked = type === 'forestBoar' && !_jgBoarDomesticated;
    const cost = def.buyCost > 0 ? `$${def.buyCost}` : 'Earn via quest';
    const color = locked ? '#504030' : canAfford(type) ? '#80c070' : '#806040';
    return `<button onclick="${locked?'showMsg(\"🐖 Domesticate a wild boar first.\")':'_buildJGEnclosure(\"'+type+'\")'}" style="display:block;width:100%;text-align:left;padding:4px 8px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(30,50,20,.3);border:1px solid rgba(80,160,60,.15);border-radius:0;color:${color};margin-bottom:3px;">${def.icon} ${def.name} — ${cost}${locked?' [LOCKED]':''}</button>`;
  }).join('');

  ov.innerHTML = `
    <div style="font-size:var(--ui-font-sm);color:#70c878;margin-bottom:6px;letter-spacing:.06em">🐾 Jungle Animals · Cleared Zone</div>
    <div style="font-size:8px;color:#507040;margin-bottom:8px;">${total} animal${total!==1?'s':''} · ${encs} enclosure${encs!==1?'s':''} · Compost in bag: ${countItem('jungleCompost')}</div>
    ${rows}
    <div style="font-size:9px;color:#507050;margin-top:8px;margin-bottom:5px;letter-spacing:.04em;text-transform:uppercase;">Build New Enclosure</div>
    ${buyRows}
    <button onclick="document.getElementById('hcTalkOverlay').style.display='none'" style="margin-top:8px;width:100%;font-size:var(--ui-font-xs);padding:5px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(10,20,10,.5);border:1px solid rgba(60,120,60,.3);color:#507050;border-radius:0;">CLOSE [F]</button>`;
  ov.style.display = 'block';
  ov.scrollTop = 0;
}