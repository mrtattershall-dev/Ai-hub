function openHCTalk(npcId, nodeId) {
  const tree = HC_TALK_TREES[npcId];
  if (!tree) return;
  nodeId = nodeId || 'root';
  hcActiveTalk = { npcId, nodeId };
  hcTalkSeen.add(nodeId);
  hcTalkOpen = true;
  // Gain rep for engaging with camp residents
  if (!hcTalkSeen.has('_rep_'+npcId)) {
    hcTalkSeen.add('_rep_'+npcId);
    gainRep('hoboCamp', 8);
  }

  let ov = document.getElementById('hcTalkOverlay');
  if (!ov) return;

  const node = tree.find(n => n.id === nodeId) || tree[0];
  const name = HC_NPC_NAMES[npcId] || npcId;
  const npc  = HC_NPCS.find(n => n.id === npcId);

  let h = `<div style="font-size:var(--ui-font-sm);color:#c0a870;margin-bottom:8px;letter-spacing:.06em">🏕 ${name} · ${npc ? npc.role : ''}</div>`;
  h += `<div style="font-size:var(--ui-font-xs);color:#a09070;line-height:1.75;margin-bottom:12px;white-space:pre-wrap;border-left:2px solid rgba(180,150,80,.25);padding-left:9px;">${node.text}</div>`;

  const opts = typeof node.options === 'function' ? node.options() : node.options;
  opts.forEach(optId => {
    const opt = tree.find(n => n.id === optId);
    if (!opt || !opt.label) return;
    const seen = hcTalkSeen.has(optId);
    h += `<button onclick="openHCTalk('${npcId}','${optId}')" style="display:block;width:100%;text-align:left;padding:6px 10px;margin-bottom:4px;font-size:var(--ui-font-xs);font-family:'Special Elite',serif;cursor:pointer;background:rgba(255,255,255,.02);border:1px solid rgba(180,160,80,${seen?'.12':'.28'});border-radius:0;color:${seen?'#5a4828':'#c0a060'};">${seen?'↩ ':''}"${opt.label}"</button>`;
  });

  h += `<button onclick="closeHCTalk()" style="margin-top:8px;width:100%;font-size:var(--ui-font-xs);padding:5px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(40,30,10,.5);border:1px solid rgba(140,110,40,.3);color:#807050;border-radius:0">LEAVE [E]</button>`;
  ov.innerHTML = h;
  ov.style.display = 'block';
  ov.scrollTop = 0;
}