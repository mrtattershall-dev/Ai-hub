import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play, ShieldCheck, Loader2, RotateCcw, Trash2, Boxes, Plus, FileCode2,
  Wrench, Sparkles, Download, StopCircle, ListTree, Eraser,
} from 'lucide-react';
import { useStore } from '../store/useStore.js';
import { extractCodeBlocks } from '../lib/markdown.js';
import { godotStatus, verifyGodot, chatStream } from '../lib/api.js';
import {
  STARTERS, GODOT_OPS, buildGodotSystem, buildGodotPrompt, parseFileSet,
  godotVerdictToFix, describeRun, resPath, shortPath,
} from '../lib/godot.js';
import ChipGroup from '../components/ChipGroup.jsx';

/**
 * The Godot tab.
 *
 * It used to be one textarea holding one script that had to `extends SceneTree`, with no
 * model anywhere in it: you pasted GDScript in by hand and it told you whether the parser
 * liked it. That made Godot the one step of the pipeline that could neither generate nor
 * be driven unattended, and the only shape of GDScript it could check was the shape
 * almost nobody writes.
 *
 * The unit here is now a PROJECT - several files, scenes included - because that is what
 * Godot work actually is, and what a model trained for it emits. Three things follow, and
 * they are the whole page:
 *
 *   ask     op chips + a composer that states the verifier's rules   (lib/godot.js)
 *   run     parse -> execute -> did it actually do anything          (server/godotVerify.js)
 *   repair  a failed verdict, with file:line, handed to the Code tab
 *
 * The middle one is why the other two are worth having: the verdict is real - the actual
 * engine, the actual scene tree - so "generate, run, fix" closes on evidence rather than
 * on the model's opinion of its own output.
 */

const OP_CHIPS = GODOT_OPS.map((o) => ({ id: o.id, label: o.label }));
const STARTER_CHOICES = Object.entries(STARTERS).map(([id, s]) => ({ id, ...s }));

const lineCount = (s) => String(s || '').split('\n').length;

export default function GodotPage() {
  const files = useStore((s) => s.godotFiles);
  const setFiles = useStore((s) => s.setGodotFiles);
  const main = useStore((s) => s.godotMain);
  const setMain = useStore((s) => s.setGodotMain);
  const op = useStore((s) => s.godotOp);
  const setOp = useStore((s) => s.setGodotOp);
  const frames = useStore((s) => s.godotFrames);
  const setFrames = useStore((s) => s.setGodotFrames);
  const useProject = useStore((s) => s.godotUseProject);
  const setUseProject = useStore((s) => s.setGodotUseProject);
  const provider = useStore((s) => s.activeProvider);
  const addToast = useStore((s) => s.addToast);
  const sendHandoff = useStore((s) => s.sendHandoff);
  const chatThreads = useStore((s) => s.chatThreads);
  const activeThreadId = useStore((s) => s.activeThreadId);

  const [status, setStatus] = useState(null);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [reply, setReply] = useState('');
  const [generating, setGenerating] = useState(false);
  const editorRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    godotStatus().then(setStatus).catch(() => setStatus({ found: false }));
    return () => { try { if (streamRef.current) streamRef.current.abort(); } catch {} };
  }, []);

  const file = files[Math.min(active, files.length - 1)] || null;
  const plan = useMemo(() => describeRun(files, main), [files, main]);

  // The verdict describes the files as they were when it ran. The editor is live, so once
  // anything is edited the verdict is about code that no longer exists - leaving it on
  // screen would have you fixing a failure you have already fixed.
  const editFile = (idx, content) => {
    setFiles(files.map((f, i) => (i === idx ? { ...f, content } : f)));
    setResult(null);
  };

  const addFile = () => {
    let path = 'res://New.gd';
    let n = 2;
    while (files.some((f) => f.path === path)) path = `res://New${n++}.gd`;
    setFiles([...files, { path, content: 'extends Node2D\n\nfunc _ready() -> void:\n\tprint("hello")\n' }]);
    setActive(files.length);
    setResult(null);
  };

  const renameFile = (idx) => {
    const cur = files[idx];
    const next = window.prompt('Path inside the project:', cur.path);
    if (next == null) return;
    const path = resPath(next);
    if (!path) { addToast('That is not a usable path.', 'error'); return; }
    if (files.some((f, i) => i !== idx && f.path === path)) { addToast(`${path} already exists.`, 'error'); return; }
    setFiles(files.map((f, i) => (i === idx ? { ...f, path } : f)));
    setResult(null);
  };

  const removeFile = (idx) => {
    if (files.length === 1) { addToast('A project needs at least one file.', 'error'); return; }
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    setActive(Math.max(0, Math.min(active, next.length - 1)));
    setResult(null);
  };

  const loadStarter = (id) => {
    const s = STARTERS[id];
    if (!s) return;
    setFiles(s.files.map((f) => ({ ...f })));
    setMain('');
    setActive(0);
    setResult(null);
    setReply('');
  };

  // ------------------------------------------------------------------ verify

  const verify = async (run) => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await verifyGodot({
        files: files.map((f) => ({ path: shortPath(f.path), content: f.content })),
        main: main ? shortPath(main) : '',
        run,
        frames,
        useProject,
      });
      // Keep the exact project that produced this verdict. By the time "Fix in Code" is
      // pressed the buffers may have moved on, and a repair brief has to carry what
      // actually failed rather than what happens to be on screen.
      setResult({ ...r, files: files.map((f) => ({ ...f })) });
      addToast(r.ok ? 'Godot: passed.' : 'Godot: problems found.', r.ok ? 'success' : 'error');
    } catch (e) {
      setResult({ ok: false, verdict: `Could not reach the verifier: ${e.message}`, stages: [], errors: [] });
      addToast('Verify failed — is the hub server running?', 'error');
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------------------------- generate

  const generate = () => {
    if (generating || !prompt.trim()) return;
    const controller = new AbortController();
    streamRef.current = controller;
    setGenerating(true);
    setReply('');
    setResult(null);
    let acc = '';

    const finish = () => {
      setGenerating(false);
      streamRef.current = null;
      const parsed = parseFileSet(acc);
      if (!parsed.length) {
        // Not worth discarding the reply over: "explain" and "review" are supposed to
        // answer in prose, and a model that forgot the format still said something. The
        // reply stays readable in the Output pane either way.
        addToast('No files in that reply — it is shown in Output.', 'info');
        return;
      }
      setFiles(parsed.map((f) => ({ path: f.path, content: f.content })));
      setMain('');
      setActive(0);
      addToast(`Loaded ${parsed.length} file(s) from the model.`);
    };

    chatStream(
      {
        provider,
        messages: [
          { role: 'system', content: buildGodotSystem(op) },
          { role: 'user', content: buildGodotPrompt(op, prompt, files) },
        ],
        temperature: 0.3,
        tab: 'godot',
        task: op,
      },
      (delta) => { acc += delta; setReply(acc); },
      () => finish(),
      (err) => {
        if (controller.signal.aborted) { finish(); return; }
        setGenerating(false);
        streamRef.current = null;
        addToast(err, 'error');
      },
      controller.signal,
    );
  };

  const stopGenerating = () => { try { if (streamRef.current) streamRef.current.abort(); } catch {} };

  // Grab the newest Godot work the AI produced in the Code tab. A multi-block reply comes
  // across as a project, not just its first block - a scene and its script are two files,
  // and pulling one of them over is worse than pulling neither.
  const pullFromCode = () => {
    const id = activeThreadId['code'];
    const thread = id ? chatThreads[id] : null;
    if (!thread) { addToast('No Code conversation yet.', 'error'); return; }
    const last = [...thread.messages].reverse().find((m) => m.role === 'assistant' && m.content);
    if (!last) { addToast('No AI reply to pull from.', 'error'); return; }
    const parsed = parseFileSet(last.content);
    if (parsed.length) {
      setFiles(parsed.map((f) => ({ path: f.path, content: f.content })));
      setMain('');
      setActive(0);
      setResult(null);
      addToast(`Pulled ${parsed.length} file(s) from Code.`);
      return;
    }
    const blocks = extractCodeBlocks(last.content);
    const pick = blocks.find((b) => ['gdscript', 'gd'].includes((b.lang || '').toLowerCase())) || blocks[0];
    if (!pick) { addToast('No code block found in the last reply.', 'error'); return; }
    setFiles([{ path: 'res://snippet.gd', content: pick.code }]);
    setActive(0);
    setResult(null);
    addToast('Pulled latest code block.');
  };

  const fixInCode = () => {
    const payload = godotVerdictToFix(result, (result && result.files) || files);
    if (payload) sendHandoff('code', payload);
  };

  /** Jump the editor to the file and line an error names. */
  const focusError = (err) => {
    if (!err || !err.file) return;
    const idx = files.findIndex((f) => resPath(f.path) === resPath(err.file));
    if (idx < 0) return;
    setActive(idx);
    if (!err.line) return;
    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (!el) return;
      const lines = String(files[idx].content).split('\n');
      const start = lines.slice(0, err.line - 1).join('\n').length + (err.line > 1 ? 1 : 0);
      el.focus();
      el.setSelectionRange(start, start + (lines[err.line - 1] || '').length);
      // Roughly centre the line: a textarea has no scrollIntoView for its caret.
      el.scrollTop = Math.max(0, (err.line - 6) * (el.scrollHeight / Math.max(1, lines.length)));
    });
  };

  const onEditorKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); verify(true); return; }
    // GDScript indents with tabs, and a textarea that treats Tab as focus-change makes the
    // editor unusable for the one language that requires them.
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.target;
      const { selectionStart: s, selectionEnd: en, value } = el;
      editFile(active, `${value.slice(0, s)}\t${value.slice(en)}`);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 1; });
    }
  };

  const onPromptKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generate(); }
  };

  const canRunInProject = status && status.projectAvailable
    && files.length === 1 && /\.gd$/i.test((files[0] || {}).path || '');

  return (
    <div className="game-layout godot-layout">
      <div className="game-toolbar">
        <span className="game-toolbar-title"><Boxes size={14} /> Godot</span>
        <span className="godot-status" title={(status && status.bin) || ''}>
          {status === null ? 'checking…'
            : status.found ? status.version : 'Godot not found — set GODOT_BIN'}
        </span>

        {/* What Run will actually do, before you press it. The server decides for real;
            this mirrors that decision so the button is not a surprise. */}
        <span className="godot-plan" title={plan.detail}>{plan.label}</span>

        {plan.mode === 'scene' && (
          <label className="godot-frames" title="How many engine iterations the scene runs before Godot stops it">
            frames
            <input
              type="number" min="1" max="600" value={frames}
              onChange={(e) => setFrames(Math.max(1, Math.min(600, Number(e.target.value) || 60)))}
            />
          </label>
        )}

        {canRunInProject && (
          <label className="godot-toggle" title="Run inside your real project so autoloads and class_name types resolve">
            <input type="checkbox" checked={useProject} onChange={(e) => setUseProject(e.target.checked)} />
            Dust Harvest context
          </label>
        )}

        <span style={{ flex: 1 }} />

        <select
          className="godot-starter"
          value=""
          onChange={(e) => { loadStarter(e.target.value); e.target.value = ''; }}
          title="Replace the project with a starter"
        >
          <option value="" disabled>Starter…</option>
          {STARTER_CHOICES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button className="btn btn-sm" onClick={pullFromCode} title="Load the latest Godot files from the Code tab">
          <Download size={13} /> Pull from Code
        </button>
        <button className="btn btn-sm" onClick={() => loadStarter('node')} title="Restore the default starter">
          <RotateCcw size={13} /> Reset
        </button>
        <button className="btn btn-sm" onClick={() => verify(false)} disabled={busy || !(status && status.found)}
                title="Parse every script — fast, does not execute">
          <ShieldCheck size={13} /> Parse
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => verify(true)} disabled={busy || !(status && status.found)}
                title={`${plan.detail} (⌘/Ctrl+Enter)`}>
          {busy ? <Loader2 size={13} className="spin" /> : <Play size={13} />} {busy ? 'Running…' : 'Run'}
        </button>
      </div>

      <div className="game-body">
        <div className="godot-editor-col">
          <div className="godot-files">
            {files.map((f, i) => (
              <div
                key={f.path + i}
                className={`godot-file ${i === active ? 'active' : ''} ${resPath(main) === resPath(f.path) ? 'entry' : ''}`}
                onClick={() => setActive(i)}
                onDoubleClick={() => renameFile(i)}
                title={`${f.path} — double-click to rename`}
              >
                <FileCode2 size={11} />
                <span className="godot-file-name">{shortPath(f.path)}</span>
                <span className="godot-file-lines">{lineCount(f.content)}</span>
                <button
                  className="btn-icon godot-file-x"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  title="Remove this file"
                ><Trash2 size={10} /></button>
              </div>
            ))}
            <button className="btn-icon godot-file-add" onClick={addFile} title="Add a file"><Plus size={12} /></button>
            <span style={{ flex: 1 }} />
            {/* Which file is the entry point is a real decision once a project has more
                than one: a scene and a SceneTree tool script are both runnable and they
                run in completely different ways. Auto means "you decide", which is what
                the server does with an empty value anyway. */}
            <select
              className="godot-entry"
              value={main || ''}
              onChange={(e) => { setMain(e.target.value); setResult(null); }}
              title="Which file to run. Auto lets the verifier choose."
            >
              <option value="">Entry: auto</option>
              {files.map((f) => <option key={f.path} value={f.path}>Entry: {shortPath(f.path)}</option>)}
            </select>
          </div>

          <textarea
            ref={editorRef}
            className="game-editor godot-code"
            value={(file && file.content) || ''}
            spellCheck={false}
            onChange={(e) => editFile(active, e.target.value)}
            onKeyDown={onEditorKeyDown}
            placeholder="# GDScript — tabs, not spaces"
          />

          <div className="godot-composer">
            <ChipGroup items={OP_CHIPS} activeId={op} onChange={setOp} compact />
            <div className="godot-composer-row">
              <textarea
                className="godot-prompt"
                value={prompt}
                placeholder="Ask for Godot work — the current project is sent with it. (⌘/Ctrl+Enter)"
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={onPromptKeyDown}
              />
              {generating ? (
                <button className="btn btn-sm" onClick={stopGenerating} title="Stop generating">
                  <StopCircle size={13} /> Stop
                </button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={generate} disabled={!prompt.trim()}
                        title="Generate with the selected provider and load the files it returns">
                  <Sparkles size={13} /> Generate
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="game-preview-wrap">
          {result && (
            <div className={`game-verdict ${result.ok ? 'ok' : 'bad'}`}>
              <div className="game-verdict-head">
                <ShieldCheck size={13} />
                <span>{result.ok ? 'Godot: PASS' : 'Godot: FAIL'}</span>
                <span style={{ flex: 1 }} />
                {!result.ok && (
                  <button className="btn btn-sm" onClick={fixInCode} title="Send the failure and the project to the Code tab">
                    <Wrench size={12} /> Fix in Code
                  </button>
                )}
                <button className="btn-icon" onClick={() => setResult(null)} title="Dismiss"><Trash2 size={12} /></button>
              </div>
              <div className="game-verdict-body">
                <div className="game-verdict-line">{result.verdict}</div>

                <div className="game-verdict-checks">
                  {(result.stages || []).map((s, i) => (
                    <span key={i}>
                      {s.ok ? '✓' : '✗'} {s.stage}
                      {s.stage === 'parse' && s.checked ? ` (${s.checked})` : ''}
                      {s.timedOut ? ' — timed out' : ''}
                    </span>
                  ))}
                  {result.mode && <span>· {result.mode}{result.frames ? ` ×${result.frames}f` : ''}</span>}
                  {result.usedProject && <span>· in project context</span>}
                </div>

                {(result.notes || []).map((n, i) => <div key={i} className="godot-note">{n}</div>)}

                {/* Errors are clickable because they have an address. That is the thing
                    Godot gives us that the Chromium verifier cannot. */}
                {(result.errors || []).map((e, i) => (
                  <div
                    key={i}
                    className={`game-log-line error ${e.file ? 'godot-err-link' : ''}`}
                    onClick={() => focusError(e)}
                    title={e.file ? 'Jump to this line' : ''}
                  >
                    {e.file ? `${shortPath(e.file)}:${e.line} — ` : ''}{e.message}
                  </div>
                ))}

                {(result.assetsMissing || []).length > 0 && (
                  <div className="game-log-line error">
                    Missing resources: {result.assetsMissing.map((a) => a.path).join(', ')}
                  </div>
                )}
                {(result.assetsUsed || []).length > 0 && (
                  <div className="game-log-line muted">Assets resolved: {result.assetsUsed.join(', ')}</div>
                )}

                {result.tree && result.tree.length > 0 && (
                  <div className="godot-tree">
                    <div className="godot-tree-head"><ListTree size={11} /> Scene tree, live</div>
                    <pre>{result.tree.join('\n')}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="game-console">
            <div className="game-console-head">
              <span>Output</span>
              <span style={{ flex: 1 }} />
              {reply && (
                <button className="btn-icon" onClick={() => setReply('')} title="Clear the model's reply">
                  <Eraser size={11} />
                </button>
              )}
            </div>
            <div className="game-console-body">
              {generating && <div className="game-log-line muted"><Loader2 size={11} className="spin" /> generating…</div>}
              {reply && <pre className="godot-reply">{reply}</pre>}
              {(result && result.prints ? result.prints : []).map((p, i) => <div key={i} className="game-log-line">{p}</div>)}
              {(result && result.warnings ? result.warnings : []).map((w, i) => (
                <div key={`w${i}`} className="game-log-line muted">
                  {w.file ? `${shortPath(w.file)}:${w.line} — ` : ''}{w.message}
                </div>
              ))}
              {!reply && !result && !generating && (
                <div className="game-log-line muted">
                  Ask for Godot work below, or press Run. {plan.detail}
                  {' '}Every res:// path must be a file in this project or a real asset — an invented one fails the run.
                </div>
              )}
              {result && !(result.prints || []).length && !reply && (
                <div className="game-log-line muted">
                  {result.ranScript ? 'Ran with no printed output.' : 'Parse check only.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
