import React, { useState, useEffect } from 'react';
import { Play, ShieldCheck, Loader2, RotateCcw, Trash2, Boxes } from 'lucide-react';
import { useStore } from '../store/useStore.js';
import { extractCodeBlocks } from '../lib/markdown.js';
import { godotStatus, verifyGodot } from '../lib/api.js';

// Godot can't be an engine chip on the Game tab: those are "CDN script -> JS global ->
// iframe", and Godot is a native engine. It gets its own page, verified server-side by
// running the real binary headless — the same idea as the Game tab's Chromium check.
const STARTER = `extends SceneTree

# A standalone GDScript must extend SceneTree and call quit() when it's done,
# otherwise headless Godot runs forever.
func _init():
\tvar total := 0
\tfor i in range(1, 6):
\t\ttotal += i
\tprint("sum 1..5 = ", total)
\tassert(total == 15, "arithmetic is broken")
\tprint("ok")
\tquit()
`;

export default function GodotPage() {
  const code = useStore(s => s.godotCode);
  const setCode = useStore(s => s.setGodotCode);
  const useProject = useStore(s => s.godotUseProject);
  const setUseProject = useStore(s => s.setGodotUseProject);
  const addToast = useStore(s => s.addToast);
  const chatThreads = useStore(s => s.chatThreads);
  const activeThreadId = useStore(s => s.activeThreadId);

  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    godotStatus().then(setStatus).catch(() => setStatus({ found: false }));
  }, []);

  const verify = async (run) => {
    if (busy) return;
    setBusy(true); setResult(null);
    try {
      const r = await verifyGodot({ code, run, useProject });
      setResult(r);
      addToast(r.ok ? 'Godot: passed.' : 'Godot: problems found.', r.ok ? 'success' : 'error');
    } catch (e) {
      setResult({ ok: false, verdict: `Could not reach the verifier: ${e.message}`, stages: [] });
      addToast('Verify failed — is the hub server running?', 'error');
    } finally { setBusy(false); }
  };

  // Pull the newest GDScript block the AI produced in the Code tab.
  const pullFromCode = () => {
    const id = activeThreadId['code'];
    const thread = id ? chatThreads[id] : null;
    if (!thread) { addToast('No Code conversation yet.', 'error'); return; }
    const last = [...thread.messages].reverse().find(m => m.role === 'assistant' && m.content);
    if (!last) { addToast('No AI reply to pull from.', 'error'); return; }
    const blocks = extractCodeBlocks(last.content);
    const pick = blocks.find(b => ['gdscript', 'gd'].includes((b.lang || '').toLowerCase())) || blocks[0];
    if (!pick) { addToast('No code block found in the last reply.', 'error'); return; }
    setCode(pick.code);
    addToast('Pulled latest code block.');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); verify(true); }
  };

  return (
    <div className="game-layout">
      <div className="game-toolbar">
        <span className="game-toolbar-title"><Boxes size={14} /> Godot</span>
        <span className="godot-status">
          {status === null ? 'checking…'
            : status.found ? `${status.version}` : 'Godot not found — set GODOT_BIN'}
        </span>
        {status?.projectAvailable && (
          <label className="godot-toggle" title="Run inside your real project so autoloads and class_name types resolve">
            <input type="checkbox" checked={useProject} onChange={e => setUseProject(e.target.checked)} />
            Dust Harvest context
          </label>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={pullFromCode} title="Load the latest code block from the Code tab">
          Pull from Code
        </button>
        <button className="btn btn-sm" onClick={() => { setCode(STARTER); setResult(null); }} title="Restore the starter script">
          <RotateCcw size={13} /> Reset
        </button>
        <button className="btn btn-sm" onClick={() => verify(false)} disabled={busy || !status?.found}
                title="Parse only — fast, does not execute">
          <ShieldCheck size={13} /> Parse
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => verify(true)} disabled={busy || !status?.found}
                title="Parse and run in headless Godot (⌘/Ctrl+Enter)">
          {busy ? <Loader2 size={13} className="spin" /> : <Play size={13} />} {busy ? 'Running…' : 'Run'}
        </button>
      </div>

      <div className="game-body">
        <textarea
          className="game-editor"
          value={code}
          spellCheck={false}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="# GDScript — must extend SceneTree and call quit()"
        />

        <div className="game-preview-wrap">
          {result && (
            <div className={`game-verdict ${result.ok ? 'ok' : 'bad'}`}>
              <div className="game-verdict-head">
                <ShieldCheck size={13} />
                <span>{result.ok ? 'Godot: PASS' : 'Godot: FAIL'}</span>
                <span style={{ flex: 1 }} />
                <button className="btn-icon" onClick={() => setResult(null)} title="Dismiss"><Trash2 size={12} /></button>
              </div>
              <div className="game-verdict-body">
                <div className="game-verdict-line">{result.verdict}</div>
                <div className="game-verdict-checks">
                  {(result.stages || []).map((s, i) => (
                    <span key={i}>{s.ok ? '✓' : '✗'} {s.stage}{s.timedOut ? ' (timed out)' : ''}</span>
                  ))}
                  {result.usedProject && <span>· in project context</span>}
                </div>
                {(result.stages || []).map((s, i) => s.output ? (
                  <div key={i} className={`game-log-line ${s.ok ? '' : 'error'}`}>{s.output}</div>
                ) : null)}
              </div>
            </div>
          )}
          <div className="game-console">
            <div className="game-console-head"><span>Output</span></div>
            <div className="game-console-body">
              {!result
                ? <div className="game-log-line muted">
                    Press Run to execute this script in headless Godot. Parse checks syntax only.
                    A script that never calls quit() will be stopped after 15s.
                  </div>
                : <div className="game-log-line muted">
                    {result.ranScript ? 'Parsed and executed.' : 'Parse check only.'}
                  </div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { STARTER as GODOT_STARTER };
