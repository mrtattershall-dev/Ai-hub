function buildConcept(){
  const l=LESSONS[app.cur],c=l.concept;
  document.getElementById('panelConcept').innerHTML=`
    <div class="ccard">
      <div class="clabel">Core Pattern</div>
      <div class="ctitle">${c.title}</div>
      <div class="cdesc">${c.desc}</div>
      <div class="code">${c.code}</div>
    </div>
    <div class="cbox">
      <div class="clabel">Challenge</div>
      <div class="ctask">${l.challenge}</div>
    </div>
    <div class="ccard">
      <div class="clabel">Training Signal</div>
      <div class="cdesc">This live demo shows the exact pattern an AI model should reproduce. The code above maps 1:1 to what's running on the canvas.</div>
      <div class="brow">
        <button class="bsm acc" onclick="askAI('Explain ${c.title} with a concrete example')">Ask AI ↗</button>
        <button class="bsm" onclick="askAI('What are common bugs when implementing ${c.title}?')">Common bugs ↗</button>
      </div>
    </div>`;
}