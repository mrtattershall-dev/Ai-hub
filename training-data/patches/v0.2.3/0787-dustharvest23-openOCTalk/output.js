function openOCTalk(npcId, nodeId) {
  const tree = OC_TALK_TREES[npcId];
  if (!tree) return;
  nodeId = nodeId || 'root';
  ocActiveTalk = { npcId, nodeId };
  ocTalkSeen.add(nodeId);
  ocTalkOpen = true;
  if (!ocTalkSeen.has('_rep_'+npcId)) {
    ocTalkSeen.add('_rep_'+npcId);
    gainRep('ocean', 6);
  }

  const ov = document.getElementById('hcTalkOverlay');
  if (!ov) return;

  const node = tree.find(n=>n.id===nodeId) || tree[0];
  const name = OC_NPC_NAMES[npcId] || npcId;
  const role = OC_NPC_ROLES[npcId] || '';
  const text = typeof node.text === 'function' ? node.text() : node.text;

  let h = `<div style="font-size:var(--ui-font-sm);color:#4899d8;margin-bottom:8px;letter-spacing:.06em">⚓ ${name} · ${role}</div>`;
  h += `<div style="font-size:var(--ui-font-xs);color:#a0b8c8;line-height:1.75;margin-bottom:12px;white-space:pre-wrap;border-left:2px solid rgba(60,140,210,.28);padding-left:9px;">${text}</div>`;

  const opts = typeof node.options === 'function' ? node.options() : (node.options||[]);
  opts.forEach(optId => {
    const opt = tree.find(n=>n.id===optId);
    if (!opt||!opt.label) return;
    const seen = ocTalkSeen.has(optId);
    h += `<button onclick="openOCTalk('${npcId}','${optId}')" style="display:block;width:100%;text-align:left;padding:6px 10px;margin-bottom:4px;font-size:var(--ui-font-xs);font-family:'Special Elite',serif;cursor:pointer;background:rgba(255,255,255,.02);border:1px solid rgba(60,140,210,${seen?'.10':'.28'});border-radius:0;color:${seen?'#3a6080':'#78b8d8'};">${seen?'↩ ':''}\"${opt.label}\"</button>`;
  });

  h += `<button onclick="closeOCTalk()" style="margin-top:8px;width:100%;font-size:var(--ui-font-xs);padding:5px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(10,20,40,.5);border:1px solid rgba(60,100,160,.3);color:#607090;border-radius:0">LEAVE [E]</button>`;
  ov.innerHTML = h;
  ov.style.display = 'block';
  ov.scrollTop = 0;
}