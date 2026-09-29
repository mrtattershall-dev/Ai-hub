'use strict';
// B2 smoke: ONE editor.rule call against the local model, timed, to gauge
// viability/speed/crash-risk before committing to the full 5-rule run.
const path = require('node:path');
const { Editor } = require(path.join(__dirname, '..', '..', 'core', 'editor.js'));
const P = require(path.join(__dirname, '..', '..', 'core', 'persistence.js'));
const fs = require('node:fs');

// reuse the editor's real backend by setting OLLAMA_MODEL before require-time? it
// reads env at realModel() call. We build the model fn via the editor's export.
const { mockModel } = require(path.join(__dirname, '..', '..', 'core', 'editor.js'));

(async () => {
  // build a local-ollama callModel inline (mirror editor.realModel, kept local)
  const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
  const extract = (t) => { t = (t || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/gi, ''); const i = t.indexOf('{'); return i < 0 ? t : t.slice(i, t.lastIndexOf('}') + 1 || undefined); };
  const callModel = async (prompt) => {
    const r = await fetch('http://localhost:11434/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, stream: true, options: { temperature: 0.2, num_predict: 400 } }) });
    if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
    let out = '', buf = ''; const dec = new TextDecoder();
    for await (const chunk of r.body) { buf += dec.decode(chunk, { stream: true }); let nl;
      while ((nl = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (ln) { try { out += JSON.parse(ln).response || ''; } catch {} } } }
    return extract(out);
  };

  const world = path.join(__dirname, 'homestead_world.json');
  const ed = new Editor({ engine: P.load(JSON.parse(fs.readFileSync(world, 'utf8'))), callModel });
  ed.maxAttempts = 2;
  console.log(`smoke: model=${MODEL}, authoring ONE rule (grow) ...`);
  const t0 = Date.now();
  const r = await ed.command('rule watered crops (water above 0) gain 5 growth each tick');
  console.log(`elapsed ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(ed.render(r));
  process.exit(0);
})().catch(e => { console.error('SMOKE ERROR:', e.message); process.exit(1); });
