function _openJGAmbientDialogue(npcId) {
  jgTalkOpen   = true;
  jgActiveTalk = npcId;

  if (!jungleTalkSeen.has('_rep_' + npcId)) {
    jungleTalkSeen.add('_rep_' + npcId);
    gainRep('jungle', 3);
  }

  const tree = JG_AMBIENT_TALKS[npcId];
  const line = _getAmbientLine(npcId);
  if (line && line.flag) jungleTalkSeen.add(line.flag);

  const text = line ? (typeof line.text === 'function' ? line.text() : line.text) : '...';

  const ov = document.getElementById('hcTalkOverlay');
  if (!ov) return;

  ov.innerHTML = `
    <div style="font-size:var(--ui-font-sm);color:#70c878;margin-bottom:8px;letter-spacing:.06em">🌿 ${tree.name} · ${tree.role}</div>
    <div style="font-size:var(--ui-font-xs);color:#a0c8a0;line-height:1.75;margin-bottom:12px;white-space:pre-wrap;border-left:2px solid rgba(80,180,80,.28);padding-left:9px;">${text}</div>
    <button onclick="closeJGTalk()" style="margin-top:8px;width:100%;font-size:var(--ui-font-xs);padding:5px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(10,20,10,.5);border:1px solid rgba(60,120,60,.3);color:#507050;border-radius:0;">LEAVE [E]</button>`;
  ov.style.display = 'block';
  ov.scrollTop = 0;
}