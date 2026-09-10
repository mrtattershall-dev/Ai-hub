function renderSettingsUI() {
  const body = document.getElementById('settingsBody');
  const s = settings;

  const speedBtns = ['slow','normal','fast'].map(v =>
    `<button class="set-btn${s.daySpeed===v?' active':''}" onclick="setSetting('daySpeed','${v}');renderSettingsUI()">${v.toUpperCase()}</button>`
  ).join('');

  const tog = (key, label, desc) => `
    <div class="set-row">
      <div><div class="set-label">${label}</div><div class="set-desc">${desc}</div></div>
      <div class="set-ctrl">
        <button class="set-btn${s[key]?' active':''}" onclick="setSetting('${key}',${!s[key]});renderSettingsUI()">
          ${s[key]?'ON':'OFF'}
        </button>
      </div>
    </div>`;

  body.innerHTML = `
    <div class="set-section">⚡ Gameplay</div>

    <div class="set-row">
      <div><div class="set-label">Difficulty</div><div class="set-desc">${{peaceful:"No enemies, cheap seeds, low debt",easy:"Cheaper seeds, more gold, lower bills",normal:"Standard frontier balance",hard:"Expensive seeds, heavy bills, wild prices"}[s.difficulty]||"Normal"} &nbsp;<span style="opacity:.5;font-size:8px">(set at new game)</span></div></div>
      <div class="set-ctrl"><span style="font-size:10px;color:var(--bone);background:rgba(155,105,36,.15);border:1px solid rgba(155,105,36,.35);padding:3px 10px;letter-spacing:.04em">${{peaceful:"PEACEFUL",easy:"EASY",normal:"NORMAL",hard:"BRUTAL"}[s.difficulty]||"NORMAL"}</span></div>
    </div>

    <div class="set-row">
      <div><div class="set-label">Day Speed</div><div class="set-desc">How fast time passes in the world</div></div>
      <div class="set-ctrl">${speedBtns}</div>
    </div>

    <div class="set-section">🔊 Audio</div>
    <div class="set-row">
      <div><div class="set-label">Master Volume</div><div class="set-desc">Overall audio level for sounds and music</div></div>
      <div class="set-ctrl">
        <input type="range" class="set-slider" min="0" max="100" step="1" value="${s.masterVol}"
          oninput="setSetting('masterVol',+this.value);_soundVol=this.value/100;if(BGM.masterGain){BGM.masterGain.gain.setValueAtTime(bgmMasterLevel(),bgmCtx().currentTime);}document.getElementById('volVal').textContent=this.value+'%'">
        <span class="set-val" id="volVal">${s.masterVol}%</span>
      </div>
    </div>
    <div class="set-row">
      <div><div class="set-label">Background Music</div><div class="set-desc">Western ambient music — day, night, and combat themes</div></div>
      <div class="set-ctrl">
        <button class="set-btn${s.musicOn?' active':''}" onclick="setSetting('musicOn',${!s.musicOn});${s.musicOn?'bgmStop()':'bgmStart()'};renderSettingsUI()">
          ${s.musicOn?'ON':'OFF'}
        </button>
      </div>
    </div>

    <div class="set-section">🖥 Display</div>

    <div class="set-row">
      <div><div class="set-label">Text Size</div><div class="set-desc">UI panel text — small, normal, or large</div></div>
      <div class="set-ctrl">
        ${['small','normal','large'].map(v =>
          `<button class="set-btn${s.textSize===v?' active':''}" onclick="setSetting('textSize','${v}');renderSettingsUI()">${v.toUpperCase()}</button>`
        ).join('')}
      </div>
    </div>

    ${tog('showControls','Show Controls Bar','Key hints shown at bottom of screen')}
    ${tog('showWeight','Show Weight Bar','Carry weight indicator above hotbar')}

    <div class="set-section">💾 Save</div>
    ${tog('autoSave','Auto-Save','Save automatically at the start of each new day')}

    <div class="set-section">🌾 Farm &amp; Ranch</div>
    ${tog('wiltNotify','Wilt Warnings','Show a message when crops wilt from lack of water')}
    ${tog('showMoodIcons','Animal Mood Icons','Show 😊😟 mood indicators above animals')}
    ${tog('showFishPrompt','Fishing Prompts','Show cast prompt when near water with rod equipped')}

    <div class="set-section">🖼 Performance</div>
    ${tog('campfireGlow','Campfire Flame Animation','Animated flame on the cooking campfire — turn off if laggy')}

    <div class="set-section">⌨ Keybinds</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;font-size:8px;color:#907050;line-height:1.9">
      <span><b style="color:#d4b060">WASD / Arrows</b> — Move</span>
      <span><b style="color:#d4b060">Shift</b> — Sprint</span>
      <span><b style="color:#d4b060">E / Space</b> — Interact / Use</span>
      <span><b style="color:#d4b060">M</b> — Market</span>
      <span><b style="color:#d4b060">Tab</b> — Inventory</span>
      <span><b style="color:#d4b060">F</b> — Farm panel / Mine cart</span>
      <span><b style="color:#d4b060">N</b> — Minimap</span>
      <span><b style="color:#d4b060">R</b> — Pen placement</span>
      <span><b style="color:#d4b060">1–8</b> — Hotbar slots</span>
      <span><b style="color:#d4b060">H</b> — Eat (hotbar)</span>
      <span><b style="color:#d4b060">Q</b> — Pistol toggle</span>
      <span><b style="color:#d4b060">Esc</b> — Pause / close</span>
    </div>

    <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(180,140,60,.1);display:flex;justify-content:flex-end;">
      <button class="set-btn" onclick="resetSettings()" style="color:#e07050;border-color:rgba(200,60,40,.3)">
        ↺ RESTORE DEFAULTS
      </button>
    </div>
  `;
}