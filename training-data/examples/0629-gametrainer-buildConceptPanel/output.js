function buildConceptPanel() {
  const lesson = LESSONS[app.currentLesson];
  const c = lesson.concept;
  document.getElementById('panelConcept').innerHTML = `
    <div class="concept-card">
      <div class="concept-label">Core Pattern</div>
      <div class="concept-title">${c.title}</div>
      <div class="concept-desc">${c.desc}</div>
      <div class="code-snippet">${c.code}</div>
    </div>
    <div class="challenge-box">
      <div class="concept-label">Challenge</div>
      <div class="challenge-task">${lesson.challenge}</div>
      ${lesson.game === 'layerDemo' ? `
        <button class="check-btn" onclick="checkLayerOrder()">✓ Check Order</button>
      ` : ''}
    </div>
    <div class="concept-card">
      <div class="concept-label">Why This Matters</div>
      <div class="concept-desc">AI models training on game code need to see this pattern appear consistently. Every game in this trainer demonstrates real, runnable implementations.</div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn-sm accent" onclick="askAI('Explain ${c.title} in one sentence')">Ask AI Tutor ↗</button>
        <button class="btn-sm" onclick="askAI('Give me a common mistake with ${c.title}')">Common mistakes ↗</button>
      </div>
    </div>
  `;
}