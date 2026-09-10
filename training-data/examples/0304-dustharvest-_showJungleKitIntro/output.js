function _showJungleKitIntro() {
  jungleTalkSeen.add('kit_arrived_east');
  const ov = document.getElementById('hcTalkOverlay');
  if (!ov) return;
  ov.style.display = 'block';
  ov.innerHTML = `
    <div style="font-size:var(--ui-font-sm);color:#70c878;margin-bottom:8px;letter-spacing:.06em">🌿 Kit · Village Leader</div>
    <div style="font-size:var(--ui-font-xs);color:#a0c8a0;line-height:1.75;margin-bottom:12px;white-space:pre-wrap;border-left:2px solid rgba(80,180,80,.28);padding-left:9px;">"You funded the ticket."
She says it simply, not like a debt, like a fact she's been holding onto.
"I wondered if you'd come east."

She doesn't explain everything at once. She lets the jungle do it.</div>
    <button onclick="document.getElementById('hcTalkOverlay').style.display='none';gainRep('jungle',15);showMsg('🌿 You\\'re known in Kit\\'s village.');"
      style="display:block;width:100%;text-align:left;padding:6px 10px;margin-bottom:4px;font-size:var(--ui-font-xs);font-family:'Special Elite',serif;cursor:pointer;background:rgba(255,255,255,.02);border:1px solid rgba(80,180,80,.28);border-radius:0;color:#78c888;">"I'm glad I came."</button>
    <button onclick="document.getElementById('hcTalkOverlay').style.display='none';gainRep('jungle',10);showMsg('🌿 You\\'re known in Kit\\'s village.');"
      style="display:block;width:100%;text-align:left;padding:6px 10px;margin-bottom:4px;font-size:var(--ui-font-xs);font-family:'Special Elite',serif;cursor:pointer;background:rgba(255,255,255,.02);border:1px solid rgba(80,180,80,.28);border-radius:0;color:#78c888;">"Show me the place."</button>`;
}