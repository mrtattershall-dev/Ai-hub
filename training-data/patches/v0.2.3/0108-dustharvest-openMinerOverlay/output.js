function openMinerOverlay(nodeId) {
  nodeId = nodeId || minerTalkNode;
  minerTalkNode = nodeId;
  const isNew = !minerTalkSeen.has(nodeId);
  minerTalkSeen.add(nodeId);
  minerOverlayOpen = true;

  const ov = document.getElementById('minerOverlay');
  if (!ov) return;

  const metSilas     = minerTalkSeen.has('who_are_you');
  const beenToFloor3 = gameState._deepestMineFloor >= 2;
  const beenToFloor4 = minerTalkSeen.has('floor4_found');
  const knowsForeman = minerTalkSeen.has('the_foreman');

  const GATED = {
    the_foreman:    beenToFloor3,
    the_vein:       beenToFloor3,
    hargrove_gone:  knowsForeman,
    already_mined:  beenToFloor3,
    what_did_you_see: knowsForeman,
  };

  const node = MINER_TALK.find(n => n.id === nodeId) || MINER_TALK[0];
  const opts = typeof node.options === 'function' ? node.options() : node.options;

  // Count unseen unlocked options (excluding root_back)
  const newOpts = opts.filter(id => {
    if (id === 'root_back') return false;
    if (GATED[id] === false) return false;
    return !minerTalkSeen.has(id);
  });

  let h = `<div style="font-size:var(--ui-font-sm);color:#c0a070;margin-bottom:6px;letter-spacing:.06em">`;
  h += `⛏ ${metSilas ? 'SILAS' : 'OLD MINER'}`;
  if (newOpts.length) h += ` <span style="font-size:var(--ui-font-xs);color:#80e060;border:1px solid rgba(80,200,60,.4);padding:1px 5px;margin-left:6px">${newOpts.length} NEW</span>`;
  h += `</div>`;
  h += `<div style="font-size:var(--ui-font-xs);color:#a08060;line-height:1.8;margin-bottom:14px;white-space:pre-wrap;border-left:2px solid rgba(180,140,60,.25);padding-left:9px;">${node.text}</div>`;

  opts.forEach(optId => {
    const opt = MINER_TALK.find(n => n.id === optId);
    if (!opt || !opt.label) return;
    if (GATED[optId] === false) return;
    const seen = minerTalkSeen.has(optId);
    const isNewOpt = !seen && optId !== 'root_back';
    const borderAlpha = isNewOpt ? '.55' : seen ? '.1' : '.3';
    const color = isNewOpt ? '#e0c070' : seen ? '#4a3818' : '#c0a060';
    const bg = isNewOpt ? 'rgba(200,170,60,.06)' : 'rgba(255,255,255,.01)';
    const prefix = isNewOpt ? '★ ' : seen ? '↩ ' : '';
    h += `<button onclick="openMinerOverlay('${optId}')" style="display:block;width:100%;text-align:left;padding:7px 10px;margin-bottom:4px;font-size:var(--ui-font-xs);font-family:'Special Elite',serif;cursor:pointer;background:${bg};border:1px solid rgba(180,140,60,${borderAlpha});border-radius:0;color:${color};">${prefix}"${opt.label}"</button>`;
  });

  h += `<button onclick="closeMinerOverlay()" style="margin-top:10px;width:100%;font-size:var(--ui-font-xs);padding:6px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(40,30,10,.5);border:1px solid rgba(140,100,40,.3);color:#706040;border-radius:0">LEAVE [E]</button>`;
  ov.innerHTML = h;
  ov.style.display = 'block';
  ov.scrollTop = 0;
}