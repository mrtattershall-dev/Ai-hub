function _openJGKitDialogue(nodeId) {
  jgTalkOpen   = true;
  jgActiveTalk = 'jg_kit';
  jungleTalkSeen.add(nodeId);

  if (!jungleTalkSeen.has('_rep_jg_kit')) {
    jungleTalkSeen.add('_rep_jg_kit');
    gainRep('jungle', 5);
  }

  const node = JG_KIT_TALK.find(n => n.id === nodeId) || JG_KIT_TALK[0];
  const text = typeof node.text === 'function' ? node.text() : node.text;
  const opts = typeof node.options === 'function' ? node.options() : (node.options || []);

  const ov = document.getElementById('hcTalkOverlay');
  if (!ov) return;

  let optHtml = '';
  opts.forEach(optId => {
    if (optId === 'jg_bye') {
      optHtml += `<button onclick="closeJGTalk()" style="display:block;width:100%;text-align:left;padding:6px 10px;margin-bottom:4px;font-size:var(--ui-font-xs);font-family:'Special Elite',serif;cursor:pointer;background:rgba(255,255,255,.02);border:1px solid rgba(80,180,80,.10);border-radius:0;color:#3a6040;">"I'll let you get back to it."</button>`;
      return;
    }
    const opt = JG_KIT_TALK.find(n => n.id === optId);
    if (!opt || !opt.label) return;
    const seen = jungleTalkSeen.has(optId + '_seen') || jungleTalkSeen.has(optId);
    optHtml += `<button onclick="_openJGKitDialogue('${optId}')" style="display:block;width:100%;text-align:left;padding:6px 10px;margin-bottom:4px;font-size:var(--ui-font-xs);font-family:'Special Elite',serif;cursor:pointer;background:rgba(255,255,255,.02);border:1px solid rgba(80,180,80,${seen?'.10':'.28'});border-radius:0;color:${seen?'#3a6040':'#78c888'};">${seen?'↩ ':''}"${opt.label}"</button>`;
  });

  ov.innerHTML = `
    <div style="font-size:var(--ui-font-sm);color:#70c878;margin-bottom:8px;letter-spacing:.06em">🌿 Kit · Village Leader</div>
    <div style="font-size:var(--ui-font-xs);color:#a0c8a0;line-height:1.75;margin-bottom:12px;white-space:pre-wrap;border-left:2px solid rgba(80,180,80,.28);padding-left:9px;">${text}</div>
    ${optHtml}
    <button onclick="closeJGTalk()" style="margin-top:8px;width:100%;font-size:var(--ui-font-xs);padding:5px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(10,20,10,.5);border:1px solid rgba(60,120,60,.3);color:#507050;border-radius:0;">LEAVE [E]</button>`;
  ov.style.display = 'block';
  ov.scrollTop = 0;
}