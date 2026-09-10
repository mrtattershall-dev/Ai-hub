import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Download, Trash2, Gamepad2, ShieldCheck, Loader2 } from 'lucide-react';
import { verifyGame } from '../lib/api.js';
import { useStore } from '../store/useStore.js';
import { extractCodeBlocks } from '../lib/markdown.js';
import { ENGINES as ENGINE_CDN, engineHead } from '@shared/engines.js';
import { PHASER_STARTER, PIXI_STARTER, THREE_STARTER } from '../lib/gameTemplate.js';
import ChipGroup from '../components/ChipGroup.jsx';

// CDN + global come from shared/engines.js (the server's verifier reads the same
// file); only the starter template is client-only, so it is merged in here.
const TEMPLATES = { phaser: PHASER_STARTER, pixi: PIXI_STARTER, three: THREE_STARTER };
const ENGINES = Object.fromEntries(
  Object.entries(ENGINE_CDN).map(([id, e]) => [id, { ...e, template: TEMPLATES[id] }])
);
const ENGINE_CHIPS = Object.entries(ENGINES).map(([id, e]) => ({ id, label: e.label }));

// Wrap the user's code in a minimal HTML doc that loads the chosen engine and
// forwards errors + console output to the parent via postMessage. The iframe runs
// with sandbox="allow-scripts" only (no same-origin), so it's isolated from the hub.
function buildSrcDoc(engineId, code) {
  const e = ENGINES[engineId] || ENGINES.phaser;
  return `<!DOCTYPE html><html><head>
${engineHead(engineId)}
<script>
(function(){
  function send(t,m){try{parent.postMessage({__game:true,type:t,msg:String(m)},'*')}catch(e){}}
  window.addEventListener('error',function(e){send('error',e.message+(e.lineno?' (line '+e.lineno+')':''))});
  window.addEventListener('unhandledrejection',function(e){send('error',(e.reason&&e.reason.message)||e.reason)});
  ['log','warn','error'].forEach(function(k){var o=console[k];console[k]=function(){send(k,Array.prototype.slice.call(arguments).join(' '));o.apply(console,arguments)}});
  window.addEventListener('load',function(){if(!window.${e.global})send('error','${e.label} failed to load — check your internet connection.')});
})();
<\/script></head><body>
<script>
try {
${code}
} catch (err) { parent.postMessage({__game:true,type:'error',msg:String((err&&err.message)||err)},'*'); }
<\/script>
</body></html>`;
}

export default function GamePage() {
  const gameEngine = useStore(s => s.gameEngine);
  const setGameEngine = useStore(s => s.setGameEngine);
  const phaserCode = useStore(s => s.gameCode);
  const pixiCode = useStore(s => s.gamePixiCode);
  const threeCode = useStore(s => s.gameThreeCode);
  const setPhaserCode = useStore(s => s.setGameCode);
  const setPixiCode = useStore(s => s.setGamePixiCode);
  const setThreeCode = useStore(s => s.setGameThreeCode);
  const chatThreads = useStore(s => s.chatThreads);
  const activeThreadId = useStore(s => s.activeThreadId);
  const addToast = useStore(s => s.addToast);

  // Read/write the stored code for a given engine.
  const codeByEngine = { phaser: phaserCode, pixi: pixiCode, three: threeCode };
  const setByEngine = { phaser: setPhaserCode, pixi: setPixiCode, three: setThreeCode };
  const storedFor = (eng) => codeByEngine[eng] || ENGINES[eng].template;
  const saveFor = (eng, c) => setByEngine[eng](c);

  const [code, setCode] = useState(storedFor(gameEngine));
  const [srcDoc, setSrcDoc] = useState('');
  const [runNonce, setRunNonce] = useState(0);
  const [logs, setLogs] = useState([]);
  const [verifying, setVerifying] = useState(false);
  const [verdict, setVerdict] = useState(null);   // { ok, verdict, checks, errors, shot }
  const ranOnce = useRef(false);

  // Capture console/errors postMessaged from the sandboxed iframe.
  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data;
      if (!d || !d.__game) return;
      setLogs(l => [...l.slice(-200), { type: d.type, msg: d.msg }]);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Build + reload the preview. `eng`/`src` default to current engine/buffer.
  const run = (src, eng) => {
    const e = eng || gameEngine;
    const c = src != null ? src : code;
    saveFor(e, c);
    setLogs([]);
    setVerdict(null);           // stale once the code changes
    setSrcDoc(buildSrcDoc(e, c));
    setRunNonce(n => n + 1);   // force the iframe to fully reload
  };

  // Auto-run once on mount so the preview isn't blank.
  useEffect(() => {
    if (!ranOnce.current) { ranOnce.current = true; run(code, gameEngine); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switching engines: persist the current buffer, load the other engine's code, run it.
  const switchEngine = (next) => {
    if (next === gameEngine || !ENGINES[next]) return;
    saveFor(gameEngine, code);
    const nextCode = storedFor(next);
    setCode(nextCode);
    setGameEngine(next);
    run(nextCode, next);
  };

  const resetTemplate = () => {
    const tpl = ENGINES[gameEngine].template;
    setCode(tpl);
    run(tpl, gameEngine);
  };

  // Grab the most recent code block the AI produced in the Code tab.
  const pullFromCode = () => {
    const threadId = activeThreadId['code'];
    const thread = threadId ? chatThreads[threadId] : null;
    if (!thread) { addToast('No Code conversation yet — generate a game in the Code tab first.', 'error'); return; }
    const lastAsst = [...thread.messages].reverse().find(m => m.role === 'assistant' && m.content);
    if (!lastAsst) { addToast('No AI reply to pull from.', 'error'); return; }
    const blocks = extractCodeBlocks(lastAsst.content);
    const pick = blocks.find(b => ['js', 'javascript'].includes(b.lang))
      || blocks.find(b => b.lang === 'html')
      || blocks[0];
    if (!pick) { addToast('No code block found in the last reply.', 'error'); return; }
    setCode(pick.code);
    run(pick.code, gameEngine);
    addToast(`Pulled latest code into ${ENGINES[gameEngine].label}.`);
  };

  // Run the current buffer in real headless Chromium server-side. The iframe shows
  // what the game looks like; this reports whether the engine loaded, whether anything
  // actually rendered, and any runtime error — including the silent case where the
  // preview is simply blank.
  const verify = async () => {
    if (verifying) return;
    setVerifying(true);
    setVerdict(null);
    saveFor(gameEngine, code);
    try {
      const r = await verifyGame({ engine: gameEngine, code });
      setVerdict(r);
      addToast(r.ok ? 'Verified: runs clean in Chromium.' : 'Verification found problems.', r.ok ? 'success' : 'error');
    } catch (err) {
      setVerdict({ ok: false, verdict: `Could not reach the verifier: ${err.message}`, errors: [], shot: null });
      addToast('Verify failed — is the hub server running?', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); }
  };

  return (
    <div className="game-layout">
      <div className="game-toolbar">
        <span className="game-toolbar-title"><Gamepad2 size={14} /> Preview</span>
        <ChipGroup items={ENGINE_CHIPS} activeId={gameEngine} onChange={switchEngine} compact />
        <span style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={pullFromCode} title="Load the latest code block from the Code tab">
          <Download size={13} /> Pull from Code
        </button>
        <button className="btn btn-sm" onClick={resetTemplate} title="Restore the starter template for this engine">
          <RotateCcw size={13} /> Reset
        </button>
        <button className="btn btn-sm" onClick={verify} disabled={verifying}
                title="Run this code in real headless Chromium and report whether it actually works">
          {verifying ? <Loader2 size={13} className="spin" /> : <ShieldCheck size={13} />} {verifying ? 'Verifying…' : 'Verify'}
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => run()} title="Run (⌘/Ctrl+Enter)">
          <Play size={13} /> Run
        </button>
      </div>

      <div className="game-body">
        <textarea
          className="game-editor"
          value={code}
          spellCheck={false}
          onChange={(e) => setCode(e.target.value)}
          onBlur={() => saveFor(gameEngine, code)}
          onKeyDown={onKeyDown}
          placeholder="// Game code — runs in a sandboxed iframe with the selected engine loaded"
        />

        <div className="game-preview-wrap">
          <iframe
            key={runNonce}
            title="game-preview"
            className="game-frame"
            sandbox="allow-scripts"
            srcDoc={srcDoc}
          />
          {verdict && (
            <div className={`game-verdict ${verdict.ok ? 'ok' : 'bad'}`}>
              <div className="game-verdict-head">
                <ShieldCheck size={13} />
                <span>{verdict.ok ? 'Chromium: PASS' : 'Chromium: FAIL'}</span>
                <span style={{ flex: 1 }} />
                <button className="btn-icon" onClick={() => setVerdict(null)} title="Dismiss">
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="game-verdict-body">
                <div className="game-verdict-line">{verdict.verdict}</div>
                {verdict.checks && (
                  <div className="game-verdict-checks">
                    <span>{verdict.checks.engineLoaded ? '✓' : '✗'} engine loaded</span>
                    <span>{verdict.checks.rendered ? '✓' : '✗'} rendered {verdict.checks.canvasWidth}×{verdict.checks.canvasHeight}</span>
                    <span>{verdict.errors?.length ? `${verdict.errors.length} issue(s)` : 'no errors'}</span>
                  </div>
                )}
                {verdict.errors?.map((e, i) => (
                  <div key={i} className="game-log-line error">{e}</div>
                ))}
                {verdict.shot && (
                  <img className="game-verdict-shot" src={verdict.shot}
                       alt="What Chromium actually rendered" title="What Chromium actually rendered" />
                )}
              </div>
            </div>
          )}

          <div className="game-console">
            <div className="game-console-head">
              <span>Console</span>
              <button className="btn-icon" onClick={() => setLogs([])} title="Clear console">
                <Trash2 size={12} />
              </button>
            </div>
            <div className="game-console-body">
              {logs.length === 0
                ? <div className="game-log-line muted">No output yet. Errors and console.log from the game appear here.</div>
                : logs.map((l, i) => (
                    <div key={i} className={`game-log-line ${l.type}`}>{l.msg}</div>
                  ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
