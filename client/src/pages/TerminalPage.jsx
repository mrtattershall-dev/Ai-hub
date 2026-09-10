import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { TerminalSquare, Plus, X, RotateCcw, CornerDownLeft } from 'lucide-react';
import { useStore } from '../store/useStore.js';
import { getHubToken, sendToTerminalApi } from '../lib/api.js';
import '@xterm/xterm/css/xterm.css';

// Shells offered in the picker. `id` is passed to the server as ?shell=, which
// spawns it directly, so anything on PATH (or an absolute path) works.
const SHELLS = [
  { id: 'powershell.exe', label: 'PowerShell' },
  { id: 'cmd.exe',        label: 'cmd' },
  { id: 'C:/Program Files/Git/bin/bash.exe', label: 'Git Bash' },
];

let seq = 1;

/**
 * One shell. Mounted for the life of its tab — hidden rather than unmounted when you
 * switch away, so a background build keeps running and its scrollback survives.
 * That's why `visible` triggers a refit: xterm measures 0x0 while display:none, so
 * it has to re-measure the moment it comes back on screen.
 */
function TerminalSession({ shell, visible, onStatus, onExit }) {
  const setActiveTerminalSession = useStore(s => s.setActiveTerminalSession);
  const sessionIdRef = useRef(null);
  const hostRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);
  const visibleRef = useRef(visible);
  const closingRef = useRef(false);      // true when WE are tearing down, so don't retry
  const retryRef = useRef(0);
  const reconnectRef = useRef(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { visibleRef.current = visible; }, [visible]);
  useEffect(() => { closingRef.current = false; }, [attempt]);

  const sync = useCallback(() => {
    const fit = fitRef.current, term = termRef.current, ws = wsRef.current;
    if (!fit || !term || !ws) return;
    try {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    } catch {}
  }, []);

  useEffect(() => {
    if (!hostRef.current) return;
    const term = new XTerm({
      fontSize: 13,
      fontFamily: 'Consolas, "Cascadia Mono", "DejaVu Sans Mono", monospace',
      cursorBlink: true,
      scrollback: 5000,
      theme: { background: '#0c0d11', foreground: '#d5d8de', cursor: '#7aa2f7' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    try { fit.fit(); } catch {}
    termRef.current = term; fitRef.current = fit;

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = location.port === '5173' ? `${location.hostname}:3001` : location.host;
    // A WebSocket cannot set headers, so the token rides as a query param.
    const tok = getHubToken();
    const auth = tok ? `&token=${encodeURIComponent(tok)}` : '';
    const ws = new WebSocket(`${proto}//${host}/api/terminal?shell=${encodeURIComponent(shell)}&cols=${term.cols}&rows=${term.rows}${auth}`);
    wsRef.current = ws;

    ws.onopen = () => { retryRef.current = 0; onStatus('connected'); sync(); };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'session') { sessionIdRef.current = m.id; if (visibleRef.current) setActiveTerminalSession(m.id); }
      else if (m.type === 'output') term.write(m.data);
      else if (m.type === 'exit') { term.write(`\r\n\x1b[90m[exited ${m.code}]\x1b[0m\r\n`); onStatus('exited'); onExit && onExit(); }
      else if (m.type === 'error') { term.write(`\r\n\x1b[31m${m.msg}\x1b[0m\r\n`); onStatus('error'); }
    };
    ws.onclose = () => {
      // Auto-reconnect on an unexpected drop (server restart, network blip). A shell
      // that exited on purpose, or errored, stays down - reconnecting those would
      // silently resurrect a session the user or the shell deliberately ended.
      onStatus(s => {
        if (s === 'exited' || s === 'error') return s;
        if (!closingRef.current) {
          retryRef.current = Math.min((retryRef.current || 0) + 1, 6);
          const wait = Math.min(1000 * 2 ** (retryRef.current - 1), 15000);   // 1s..15s backoff
          reconnectRef.current = setTimeout(() => setAttempt(a => a + 1), wait);
          return 'reconnecting';
        }
        return 'disconnected';
      });
    };
    ws.onerror = () => onStatus('error');

    const sub = term.onData((d) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data: d }));
    });
    const ro = new ResizeObserver(() => sync());
    ro.observe(hostRef.current);

    return () => {
      closingRef.current = true;
      clearTimeout(reconnectRef.current);
      ro.disconnect(); sub.dispose();
      try { ws.close(); } catch {}
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shell, attempt]);

  // Re-measure when this tab becomes visible again.
  useEffect(() => {
    if (!visible) return;
    if (sessionIdRef.current != null) setActiveTerminalSession(sessionIdRef.current);
    const t = setTimeout(sync, 30);
    return () => clearTimeout(t);
  }, [visible, sync, setActiveTerminalSession]);

  return <div className="term-host" ref={hostRef} style={{ display: visible ? 'block' : 'none' }} />;
}

export default function TerminalPage() {
  const [tabs, setTabs] = useState(() => [{ id: seq++, shell: SHELLS[0].id, label: SHELLS[0].label, status: 'connecting' }]);
  // Must derive from the tab actually created: `seq` is module-level, so a SECOND
  // TerminalPage (e.g. a second split pane) gets id 2+, and a hardcoded 1 left it
  // with no matching tab - an empty pane reading 'no shell'.
  const [activeId, setActiveId] = useState(() => tabs[0].id);
  const [picker, setPicker] = useState(false);
  const activeSession = useStore(s => s.activeTerminalSession);
  const addToast = useStore(s => s.addToast);

  const setStatus = (id) => (v) =>
    setTabs(ts => ts.map(t => t.id === id ? { ...t, status: typeof v === 'function' ? v(t.status) : v } : t));

  const addTab = (shell) => {
    const meta = SHELLS.find(s => s.id === shell) || { id: shell, label: shell };
    const id = seq++;
    setTabs(ts => [...ts, { id, shell: meta.id, label: meta.label, status: 'connecting' }]);
    setActiveId(id);
    setPicker(false);
  };

  const closeTab = (id, e) => {
    e && e.stopPropagation();
    setTabs(ts => {
      const next = ts.filter(t => t.id !== id);
      if (id === activeId && next.length) setActiveId(next[next.length - 1].id);
      return next;
    });
  };

  // Restart = drop the tab and open a fresh one on the same shell, so the old
  // socket closes and the server kills its shell rather than leaving it orphaned.
  const restart = () => {
    const cur = tabs.find(t => t.id === activeId);
    if (!cur) return;
    closeTab(cur.id);
    setTimeout(() => addTab(cur.shell), 0);
  };

  // Submit the current line without a keypress.
  //
  // Needed because a browser marks synthetic key events untrusted and xterm ignores
  // them, so anything driving this page programmatically (automation, an agent, a
  // remote session) can type but cannot press Enter. The PTY accepts a bare CR
  // perfectly well - this just exposes that as an action.
  const sendEnter = async () => {
    try {
      await sendToTerminalApi({ text: '', newline: true, sessionId: activeSession });
    } catch (e) {
      addToast(e.message || 'No open terminal.', 'error');
    }
  };

  const active = tabs.find(t => t.id === activeId);

  return (
    <div className="term-layout">
      <div className="game-toolbar">
        <span className="game-toolbar-title"><TerminalSquare size={14} /> Terminal</span>

        <div className="term-tabs">
          {tabs.map(t => (
            <button key={t.id}
                    className={`term-tab ${t.id === activeId ? 'active' : ''}`}
                    onClick={() => setActiveId(t.id)}
                    title={t.shell}>
              <span className={`term-dot ${t.status}`} />
              {t.label}
              <span className="term-tab-x" onClick={(e) => closeTab(t.id, e)}><X size={11} /></span>
            </button>
          ))}
          <div className="term-add-wrap">
            <button className="term-tab term-add" onClick={() => setPicker(p => !p)} title="New shell">
              <Plus size={12} />
            </button>
            {picker && (
              <div className="term-picker" onMouseLeave={() => setPicker(false)}>
                {SHELLS.map(s => (
                  <button key={s.id} className="term-picker-item" onClick={() => addTab(s.id)}>{s.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        <span style={{ flex: 1 }} />
        <span className={`term-status ${active?.status || 'disconnected'}`}>{active?.status || 'no shell'}</span>
        <button className="btn btn-sm" onClick={sendEnter} disabled={!active}
                title="Press Enter in this shell (submits the current line)">
          <CornerDownLeft size={13} /> Enter
        </button>
        <button className="btn btn-sm" onClick={restart} disabled={!active} title="Kill this shell and start a fresh one">
          <RotateCcw size={13} /> Restart
        </button>
      </div>

      <div className="term-stack">
        {tabs.map(t => (
          <TerminalSession key={t.id} shell={t.shell} visible={t.id === activeId}
                           onStatus={setStatus(t.id)} />
        ))}
        {!tabs.length && (
          <div className="term-empty">No shells open. Press <strong>+</strong> to start one.</div>
        )}
      </div>
    </div>
  );
}
