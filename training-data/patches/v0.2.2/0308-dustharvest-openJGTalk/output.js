function openJGTalk(npcId) {
  jgTalkOpen   = true;
  jgActiveTalk = npcId;
  if (!jungleTalkSeen.has('_rep_' + npcId)) {
    jungleTalkSeen.add('_rep_' + npcId);
    gainRep('jungle', 4);
  }
  const npc = JG_NPCS.find(n => n.id === npcId);
  const name = npc ? npc.name : npcId;
  const role = npc ? npc.role : '';
  const ov = document.getElementById('hcTalkOverlay');
  if (!ov) return;
  let text = '';
  let opts = '';
  if (npcId === 'jg_tobias') {
    text = `He's checking a crate manifest. Doesn't look up right away.\n"Frontier farmer." He folds the paper. "Figured you'd make it out eventually. Kit mentioned you might."\n"Freight runs weekly — anything you want moved to the frontier market, I can do it. Services here when you're ready."`;
    opts = `<button onclick="closeJGTalk();showMsg('🌿 Tobias — freight services coming in Slice 10.');"
      style="display:block;width:100%;text-align:left;padding:6px 10px;margin-bottom:4px;font-size:var(--ui-font-xs);font-family:'Special Elite',serif;cursor:pointer;background:rgba(255,255,255,.02);border:1px solid rgba(80,180,80,.28);border-radius:0;color:#78c888;">"I'll be back when I have something to move."</button>`;
  } else if (npcId === 'jg_kit') {
    if (!jungleTalkSeen.has('kit_arrived_east')) {
      _showJungleKitIntro();
      return;
    }
    text = `She looks up from whatever she was writing.\n"Still here." She almost smiles. "Good."\nShe gestures at the clearing. "Ask me anything. I'll tell you what I know — which is more than I'd like about some of it."`;
    opts = `<button onclick="closeJGTalk();showMsg('🌿 Kit — full dialogue in Slice 2.');"
      style="display:block;width:100%;text-align:left;padding:6px 10px;margin-bottom:4px;font-size:var(--ui-font-xs);font-family:'Special Elite',serif;cursor:pointer;background:rgba(255,255,255,.02);border:1px solid rgba(80,180,80,.28);border-radius:0;color:#78c888;">"Tell me about the debt."</button>`;
  }
  ov.innerHTML = `
    <div style="font-size:var(--ui-font-sm);color:#70c878;margin-bottom:8px;letter-spacing:.06em">🌿 ${name} · ${role}</div>
    <div style="font-size:var(--ui-font-xs);color:#a0c8a0;line-height:1.75;margin-bottom:12px;white-space:pre-wrap;border-left:2px solid rgba(80,180,80,.28);padding-left:9px;">${text}</div>
    ${opts}
    <button onclick="closeJGTalk()" style="margin-top:8px;width:100%;font-size:var(--ui-font-xs);padding:5px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(10,20,10,.5);border:1px solid rgba(60,120,60,.3);color:#507050;border-radius:0">LEAVE [E]</button>`;
  ov.style.display = 'block';
  ov.scrollTop = 0;
}