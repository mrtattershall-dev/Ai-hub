function openSurvivorTalk(nodeId) {
  nodeId = nodeId || 'root';
  const node = SURVIVOR_TALK.find(n=>n.id===nodeId);
  if (!node) return;
  _survivorTalkSeen.add(nodeId);
  _survivorTalkOpen = true;
  const opts = typeof node.options==='function'?node.options():(node.options||[]);
  const text = typeof node.text==='function'?node.text():node.text;
  let h = `<div style="font-family:'Special Elite',serif;max-width:420px;margin:0 auto;">`;
  h += `<div style="font-size:11px;color:#907050;letter-spacing:.12em;margin-bottom:6px">STRANGER — Ruined Settlement</div>`;
  h += `<div style="font-size:var(--ui-font-xs);color:#a09070;line-height:1.8;margin-bottom:14px;white-space:pre-wrap;border-left:2px solid rgba(140,100,40,.25);padding-left:9px;">${text}</div>`;
  opts.forEach(optId => {
    const opt = SURVIVOR_TALK.find(n=>n.id===optId);
    if (!opt||!opt.label) return;
    const seen = _survivorTalkSeen.has(optId);
    const isNew = !seen && optId!=='survivor_bye';
    const color = isNew?'#e0c070':seen?'#4a3818':'#c0a060';
    const prefix = isNew?'★ ':seen?'↩ ':'';
    h += `<button onclick="survivorTalkChoose('${optId}')" style="display:block;width:100%;text-align:left;padding:7px 10px;margin-bottom:4px;font-size:var(--ui-font-xs);font-family:'Special Elite',serif;cursor:pointer;background:rgba(255,255,255,.01);border:1px solid rgba(140,100,40,${isNew?'.5':'.15'});border-radius:0;color:${color};">${prefix}"${opt.label}"</button>`;
  });
  h += `<button onclick="closeSurvivorTalk()" style="margin-top:8px;width:100%;font-size:var(--ui-font-xs);padding:6px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(40,30,20,.4);border:1px solid rgba(140,100,40,.25);color:#605040;border-radius:0">LEAVE [E]</button>`;
  h += `</div>`;
  const ov = document.getElementById('npcTalkOverlay') || (() => {
    const d=document.createElement('div');
    d.id='npcTalkOverlay';
    d.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(12,10,8,.97);border:1px solid rgba(120,90,40,.5);padding:20px 24px;max-width:480px;width:90vw;max-height:80vh;overflow-y:auto;z-index:200;';
    document.body.appendChild(d);
    return d;
  })();
  ov.innerHTML = h;
  ov.style.display = 'block';
  npcTalkOpen = true;
}