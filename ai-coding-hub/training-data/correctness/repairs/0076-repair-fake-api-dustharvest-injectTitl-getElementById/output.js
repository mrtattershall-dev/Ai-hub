function injectTitleButtons(){
  const ts=document.getElementById('titleScreen');
  if(!ts) return;
  const sec=document.createElement('div');
  sec.id='dhMpTitleSection';
  sec.innerHTML=`
    <div class="ts-sep">── MULTIPLAYER ──</div>
    <input id="dhMpTitleCustomCode" maxlength="16"
      placeholder="Custom room code (optional)"
      style="width:255px;box-sizing:border-box;background:rgba(255,255,255,.04);
             border:1px solid rgba(72,112,160,.35);padding:6px 10px;
             font-family:'Special Elite','Courier New',serif;font-size:10px;
             color:#c8d8e8;outline:none;text-transform:uppercase;letter-spacing:.1em;
             text-align:center;">
    <button class="title-btn primary" onclick="window._dhMpTitleHost()"
      style="background:rgba(30,50,100,.18);border-color:rgba(72,112,160,.6);border-top-color:#4870a0;color:#90b8e0;">
      🌐 HOST A GAME
    </button>
    <button class="title-btn secondary" onclick="window._dhMpOpenJoinModal()"
      style="color:rgba(100,140,200,.7);">
      ↳ JOIN A FRIEND'S GAME
    </button>`;
  ts.appendChild(sec);
}