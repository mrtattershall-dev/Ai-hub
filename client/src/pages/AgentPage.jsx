import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, Play, Square, Check, X, Download, FileCode, FolderTree,
  Terminal, CheckCircle2, AlertTriangle, Loader2, BookOpen, ExternalLink,
  FileDiff, FilePlus2, FileSearch, Globe, Upload, Trash2, ListChecks,
  ShieldAlert, ShieldCheck, GitCommit, CornerDownRight, Eye, ClipboardCheck,
  Search, Download as DownloadIcon, StickyNote, History, Undo2, ListPlus, Images } from 'lucide-react';

// Core scaffold files the agent manages — locked so they can't be deleted by accident.
const PROTECTED = new Set(['index.html', 'style.css', 'script.js', 'main.py']);
import { useStore } from '../store/useStore.js';
import { agentStart, agentGet, agentApprove, agentStop, agentResume, agentFollowup, agentList, agentFiles, agentUpload, agentUploadZip, agentDeleteFile, agentReset, AGENT_EXPORT_URL, queueList, queueAdd, queueRemove, queueRunNext } from '../lib/api.js';

const fileToBase64 = (f) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1]);
  r.onerror = reject;
  r.readAsDataURL(f);
});

const STATUS_LABEL = {
  running: 'Working…',
  awaiting_approval: 'Needs your approval',
  done: 'Done',
  error: 'Error',
  stopped: 'Stopped',
  interrupted: 'Paused — tunnel dropped',
};

// All 18 tools. Six were labelled and twelve rendered as raw snake_case identifiers
// ("run_python", "git_undo"), so half the agent's activity was unreadable in the feed.
const TOOL_ICON = {
  list_dir: FolderTree, read_file: FileSearch, write_file: FilePlus2,
  edit_file: FileDiff, run_command: Terminal, test_web: Globe,
  search_file: Search, outline_file: FileCode, run_python: Terminal,
  web_search: Globe, web_fetch: Globe, download_file: DownloadIcon,
  remember: StickyNote, recall: StickyNote,
  git_diff: FileDiff, git_log: History, git_commit: GitCommit, git_undo: Undo2,
  see_screen: Eye, verify_project: ClipboardCheck,
  task_list: ListChecks, task_add: ListPlus, task_done: Check,
  spawn_subtask: CornerDownRight, queue_task: ListPlus, list_assets: Images,
};
const TOOL_LABEL = {
  list_dir: 'Listed files', read_file: 'Read', write_file: 'Wrote',
  edit_file: 'Patched', run_command: 'Ran', test_web: 'Browser test',
  search_file: 'Searched', outline_file: 'Outlined', run_python: 'Ran Python',
  web_search: 'Searched the web', web_fetch: 'Fetched a page', download_file: 'Downloaded',
  remember: 'Noted', recall: 'Read its notes',
  git_diff: 'Diffed', git_log: 'History', git_commit: 'Committed', git_undo: 'Reverted',
  see_screen: 'Looked at the screen', verify_project: 'Verified the project',
  task_list: 'Checked tasks', task_add: 'Added tasks', task_done: 'Task done',
  spawn_subtask: 'Delegated', queue_task: 'Queued for later', list_assets: 'Looked up assets',
};

// Starting goals for the empty state. Chosen so each one lands on a project type the
// hub can actually VERIFY — a web app it can browser-test and look at, a Node module it
// can execute, a Godot script it can parse. A starter the verifier can't check would be
// a worse first impression than no starter at all.
const STARTERS = [
  { label: 'Canvas game',
    goal: 'Build a single-file browser game in index.html: a paddle the mouse controls, a bouncing ball, and bricks that disappear when hit. Draw everything with the canvas API — no image or audio files. Show the score on screen.' },
  { label: 'Inventory module',
    goal: 'Write inventory.js: a complete, self-contained inventory system with a weight cap, add/remove/total, and stacking of identical items. End the file with a self-checking demo that asserts each behaviour and prints PASS lines.' },
  { label: 'Web tool',
    goal: 'Build a single-page tool in index.html that converts between units (length, weight, temperature), with a dropdown for the category and live conversion as you type. Plain HTML, CSS and JS — no build step.' },
  { label: 'Godot script',
    goal: 'Write a standalone GDScript for Godot 4 that extends SceneTree: a state machine with idle/walk/attack transitions, asserting that illegal transitions are rejected, then calling quit().' },
  { label: 'Python CLI',
    goal: 'Build a Python command-line todo app with add, list and done commands, storing tasks in tasks.json. Include a self-check at the bottom that exercises each command and prints the results.' },
];

const codeStyle = {
  fontSize: 11, fontFamily: 'var(--mono)', background: 'var(--bg-tertiary)',
  color: 'var(--text-secondary)', padding: '8px 10px', borderRadius: 7,
  marginTop: 6, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap',
  border: '0.5px solid var(--border)',
};

// before → after diff for surgical edit_file patches
function DiffBlock({ find, replace }) {
  const lines = (s, p) => (s || '').split('\n').map(l => p + l).join('\n');
  return (
    <div style={{ marginTop: 6, borderRadius: 7, overflow: 'hidden', border: '0.5px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 11 }}>
      {find != null && find !== '' && (
        <pre style={{ margin: 0, padding: '7px 10px', background: 'rgba(224,62,62,0.10)', color: '#ff9b9b', whiteSpace: 'pre-wrap', borderLeft: '2px solid #e03e3e' }}>{lines(find, '- ')}</pre>
      )}
      {replace != null && replace !== '' && (
        <pre style={{ margin: 0, padding: '7px 10px', background: 'rgba(22,166,121,0.10)', color: '#86e6bd', whiteSpace: 'pre-wrap', borderLeft: '2px solid #16a679' }}>{lines(replace, '+ ')}</pre>
      )}
    </div>
  );
}

/**
 * The agent's task ledger (workspace/TASKS.md) and any open escalations.
 *
 * Both are plain files in the workspace, which Express already serves at /workspace,
 * so this needs no new endpoint. The ledger is what stops a long run losing track of
 * itself — it was written, re-injected into every model call, and completely invisible
 * to the person watching.
 */
function LedgerStrip({ active }) {
  const [tasks, setTasks] = useState(null);
  const [escalations, setEscalations] = useState(0);

  useEffect(() => {
    let alive = true;
    const read = async () => {
      try {
        const r = await fetch('/workspace/TASKS.md', { cache: 'no-store' });
        if (!alive) return;
        if (!r.ok) { setTasks(null); return; }
        const body = await r.text();
        const rows = [...body.matchAll(/^\s*-\s*\[([ >xX])\]\s*(?:\d+\.\s*)?(.+?)\s*$/gm)]
          .map(m => ({ state: m[1].toLowerCase(), title: m[2] }));
        setTasks(rows.length ? rows : null);
      } catch { if (alive) setTasks(null); }
      try {
        const e = await fetch('/workspace/ESCALATIONS.md', { cache: 'no-store' });
        if (!alive) return;
        setEscalations(e.ok ? (await e.text()).split(/^## /m).length - 1 : 0);
      } catch { if (alive) setEscalations(0); }
    };
    read();
    // Only poll while something is actually running; an idle tab should be silent.
    const t = active ? setInterval(read, 4000) : null;
    return () => { alive = false; if (t) clearInterval(t); };
  }, [active]);

  if (!tasks && !escalations) return null;
  const done = tasks ? tasks.filter(t => t.state === 'x').length : 0;
  const total = tasks ? tasks.length : 0;
  const doing = tasks ? tasks.find(t => t.state === '>') : null;

  return (
    <div style={{ padding: '8px 14px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
      {total > 0 && (
        <>
          <ListChecks size={13} style={{ color: 'var(--info)', flexShrink: 0 }} />
          <span style={{ color: 'var(--text)', fontWeight: 600, flexShrink: 0 }}>{done}/{total}</span>
          <div style={{ flex: 1, minWidth: 40, height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
            <div style={{ width: `${total ? (100 * done) / total : 0}%`, height: '100%', background: 'var(--success)', transition: 'width .3s' }} />
          </div>
          <span style={{ color: 'var(--text-tertiary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '45%' }}>
            {doing ? doing.title : done === total ? 'all tasks complete' : ''}
          </span>
        </>
      )}
      {escalations > 0 && (
        <span title="Runs that stopped and need a person — see workspace/ESCALATIONS.md"
          style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b' }}>
          <AlertTriangle size={13} /> {escalations}
        </span>
      )}
    </div>
  );
}

function StepRow({ step, n }) {
  let Icon = TOOL_ICON[step.tool] || FileCode;
  let accent = 'var(--accent)';
  if (step.type === 'finish') { Icon = CheckCircle2; accent = 'var(--success)'; }
  else if (step.type === 'error') { Icon = AlertTriangle; accent = 'var(--danger)'; }
  else if (step.type === 'approval_request') { Icon = Terminal; accent = 'var(--info)'; }
  else if (step.type === 'approval_denied') { Icon = X; accent = 'var(--danger)'; }
  else if (step.type === 'plan') { Icon = ListChecks; accent = 'var(--info)'; }
  else if (step.type === 'followup') { Icon = Bot; accent = 'var(--accent)'; }
  // These all carry step.tool, so with no branch of their own they fell through to the
  // TOOL_LABEL lookup at the bottom — and a command the policy layer REFUSED rendered as
  // "Ran". The safety layer was reporting the opposite of what happened. Sub-agent steps
  // had the same problem: delegated work displayed as the parent's own.
  else if (step.type === 'policy_denied') { Icon = ShieldAlert; accent = 'var(--danger)'; }
  else if (step.type === 'policy_allowed') { Icon = ShieldCheck; accent = 'var(--success)'; }
  else if (step.type === 'checkpoint') { Icon = GitCommit; accent = 'var(--text-tertiary)'; }
  else if (step.type?.startsWith('subtask')) { Icon = CornerDownRight; accent = 'var(--info)'; }

  const title = step.type === 'finish' ? 'Finished'
    : step.type === 'approval_denied' ? 'Command denied'
    : step.type === 'approval_request' ? 'Wants to run'
    : step.type === 'policy_denied' ? 'Refused by policy'
    : step.type === 'policy_allowed' ? 'Auto-approved'
    : step.type === 'checkpoint' ? 'Checkpoint'
    : step.type === 'subtask_start' ? 'Sub-task started'
    : step.type === 'subtask_step' ? 'Sub-task'
    : step.type === 'subtask_done' ? 'Sub-task finished'
    : step.type === 'plan' ? 'Build plan'
    : step.type === 'followup' ? 'Follow-up'
    : step.type === 'note' ? 'Note'
    : step.type === 'error' ? 'Note'
    : (TOOL_LABEL[step.tool] || step.tool || step.type);
  const isDiff = step.tool === 'edit_file' && (step.args?.find || step.args?.replace);

  return (
    <div className="agent-step" style={{ display: 'flex', gap: 11, padding: '11px 16px', borderBottom: '0.5px solid var(--border)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>{n}</span>
        <Icon size={15} style={{ color: accent }} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: accent }}>{title}</span>
          {step.args?.path && <code style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 5 }}>{step.args.path}</code>}
          {step.args?.cmd && <code style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 5 }}>{step.args.cmd}</code>}
        </div>
        {step.thought && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{step.thought}</div>}
        {step.summary && <div style={{ fontSize: 13, marginTop: 4, color: 'var(--text)' }}>{step.summary}</div>}
        {step.text && (step.type === 'plan'
          ? <pre style={{ ...codeStyle, color: 'var(--text)', maxHeight: 340 }}>{step.text}</pre>
          : <div style={{ fontSize: 12, color: accent, marginTop: 3 }}>{step.text}</div>)}
        {isDiff && <DiffBlock find={step.args.find} replace={step.args.replace} />}
        {step.result && <pre style={codeStyle}>{step.result}</pre>}
      </div>
    </div>
  );
}

export default function AgentPage() {
  const addToast = useStore(s => s.addToast);
  const [goal, setGoal] = useState('');
  // Declared checks for a GOVERNED run (JSON: { requested: { script, files? }, protected: { script, files? } }).
  // Empty = ordinary run, which the server labels as having no behavioral acceptance protection.
  const [checksText, setChecksText] = useState('');
  const [showChecks, setShowChecks] = useState(false);
  const [run, setRun] = useState(null);
  const [runId, setRunId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [files, setFiles] = useState([]);
  const [resumable, setResumable] = useState([]);   // interrupted runs recovered after a tunnel drop / restart
  // Work queue: the backlog the supervisor pulls from, plus the approval mode that
  // decides what runs unattended. Both existed on the server with no way to see them.
  const [queue, setQueue] = useState([]);
  const [queueMode, setQueueMode] = useState(null);
  const [supervisor, setSupervisor] = useState(false);
  const [queueGoal, setQueueGoal] = useState('');
  // Set when the server refused an add (duplicate work). Holds the goal it refused so a
  // second press of the same text can override deliberately.
  const [queueDupe, setQueueDupe] = useState(null);
  const [showQueue, setShowQueue] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pollRef = useRef(null);
  const logRef = useRef(null);
  const fileInputRef = useRef(null);

  const refreshFiles = useCallback(async () => {
    try { setFiles(await agentFiles()); } catch {}
  }, []);
  useEffect(() => { refreshFiles(); }, [refreshFiles]);

  // On load, surface any runs the server recovered as 'interrupted' (tunnel dropped
  // mid-build, or the hub restarted) so they can be resumed with one click.
  const refreshResumable = useCallback(async () => {
    try { setResumable((await agentList()).filter(r => r.status === 'interrupted')); }
    catch { /* old server without /list — ignore */ }
  }, []);
  useEffect(() => { refreshResumable(); }, [refreshResumable]);

  const refreshQueue = useCallback(async () => {
    try {
      const q = await queueList();
      setQueue((q.items || []).filter(i => i.status === 'queued'));
      setQueueMode(q.approvalMode || null);
      setSupervisor(!!q.supervisor);
    } catch { /* a queue read must never break the page */ }
  }, []);
  useEffect(() => { refreshQueue(); }, [refreshQueue]);

  // The server refuses a goal that is already queued, in flight, or already done (the
  // guard that stops a self-queueing run from looping forever). That refusal has to be
  // VISIBLE: clearing the box and swallowing the error made a rejected add look exactly
  // like a successful one, so the typed text stays put until the add actually lands.
  const addToQueue = async () => {
    const g = queueGoal.trim();
    if (!g) return;
    const force = queueDupe && queueDupe.goal === g;   // second press = "yes, again"
    try {
      await queueAdd(g, 0, force);
      setQueueGoal('');
      setQueueDupe(null);
    } catch (e) {
      setQueueDupe({ goal: g, message: String(e.message || 'could not queue that') });
    }
    refreshQueue();
  };
  const dropFromQueue = async (id) => { try { await queueRemove(id); } catch {} refreshQueue(); };
  const runNextQueued = async () => {
    setBusy(true);
    try {
      const r = await queueRunNext();
      if (r?.runId) { setRunId(r.runId); setRun(null); }
    } catch (e) { /* 409 = a run is already active, which the UI already shows */ }
    setBusy(false);
    refreshQueue();
  };

  const uploadFiles = useCallback(async (fileList) => {
    const arr = Array.from(fileList || []);
    if (!arr.length) return;
    for (const f of arr) {
      try {
        if (f.name.toLowerCase().endsWith('.zip')) {
          await agentUploadZip(await fileToBase64(f));   // server unzips into the workspace
        } else {
          await agentUpload(f.name, await f.text());
        }
      } catch (e) { addToast(`Couldn't add ${f.name}: ${e.message}`, 'error'); }
    }
    addToast(`Added ${arr.length} item${arr.length > 1 ? 's' : ''} to the workspace`, 'success');
    refreshFiles();
  }, [addToast, refreshFiles]);

  const onDrop = (e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); };
  const removeFile = async (path) => { try { await agentDeleteFile(path); refreshFiles(); } catch (e) { addToast(e.message, 'error'); } };

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const poll = useCallback(async (id) => {
    try {
      const r = await agentGet(id);
      setRun(r);
      if (r.status !== 'running') { stopPolling(); refreshFiles(); }
    } catch (e) {
      stopPolling();
      addToast(`Lost the run: ${e.message}`, 'error');
    }
  }, [addToast, refreshFiles]);

  const startPolling = useCallback((id) => {
    stopPolling();
    pollRef.current = setInterval(() => poll(id), 1500);
  }, [poll]);

  useEffect(() => () => stopPolling(), []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [run?.steps?.length, run?.steps?.[run?.steps?.length - 1]?.result]);

  const handleStart = async () => {
    if (!goal.trim() || busy) return;
    let governed = null;
    if (checksText.trim()) {
      try { governed = { checks: JSON.parse(checksText) }; }
      catch (e) { addToast(`Declared checks are not valid JSON: ${e.message}`, 'error'); return; }
    }
    setBusy(true);
    try {
      const { runId: id } = await agentStart(goal.trim(), false, governed);
      setRunId(id);
      setRun({ status: 'running', goal: goal.trim(), steps: [], protection: governed ? 'BEHAVIORAL_ACCEPTANCE' : 'NONE' });
      setGoal('');
      startPolling(id);
    } catch (e) {
      // The server refuses a second concurrent run because both would share one
      // workspace, ledger and NOTES.md and corrupt each other. That is not a dead end -
      // the queue is exactly where this goal belongs, so put it there and say so.
      // A governed start the server could not verify is BLOCKED with a reason - it is never
      // downgraded to an unprotected run behind the user's back.
      if (e.status === 409 && e.body?.blocked) { addToast(e.body.error || e.message, 'error'); return; }
      if (e.status === 409 && e.body?.busy) {
        try {
          const q = await agentStart(goal.trim(), true);
          setGoal('');
          refreshQueue();
          addToast(q.queued
            ? `A run is already active — queued this instead (${q.depth} waiting).`
            : 'A run is already active.', 'info');
        } catch (e2) {
          addToast(e2.message, 'error');
        }
      } else {
        addToast(e.message, 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  // Continue the current finished run with a new instruction — keeps the prior
  // conversation + workspace so the agent builds on what it made instead of
  // starting over. The existing steps stay; new ones append below.
  const handleFollowup = async () => {
    if (!goal.trim() || busy || !runId) return;
    setBusy(true);
    try {
      await agentFollowup(runId, goal.trim());
      setGoal('');
      setRun(r => (r ? { ...r, status: 'running' } : r));
      startPolling(runId);
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // One entry point for the input: continue a finished run, else start a new one.
  // A paused (interrupted) run must be Resumed first — don't silently start over.
  const handleSend = () => {
    if (!goal.trim() || busy || isRunning || awaiting) return;
    if (interrupted) { addToast('This run is paused — Resume it first, then continue.', 'error'); return; }
    (finished && runId ? handleFollowup : handleStart)();
  };

  const handleApprove = async (approve) => {
    if (!runId || approving || run?.status !== 'awaiting_approval') return;
    setApproving(true);
    try {
      await agentApprove(runId, approve);
      setRun(r => ({ ...r, status: 'running', pending: null }));
      startPolling(runId);
    } catch (e) {
      if (!/nothing awaiting/i.test(e.message)) addToast(e.message, 'error');
    } finally {
      setApproving(false);
    }
  };

  const handleStop = async () => {
    if (!runId) return;
    try { await agentStop(runId); stopPolling(); poll(runId); } catch (e) { addToast(e.message, 'error'); }
  };

  // Continue a paused run. drive() replays from history server-side, so it picks up
  // exactly where the dropped call left off. Make sure the tunnel URL is set first.
  const handleResume = async (id) => {
    const target = id || runId;
    if (!target || busy) return;
    setBusy(true);
    try {
      await agentResume(target);
      setRunId(target);
      const r = await agentGet(target);
      setRun(r);
      setResumable(list => list.filter(x => x.id !== target));
      startPolling(target);
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleNewProject = async () => {
    if (isRunning || awaiting) return;
    if (!window.confirm('Start a new project? This clears the workspace — every file in it is deleted.')) return;
    try {
      await agentReset();
      stopPolling();
      setRun(null); setRunId(null); setGoal('');
      await refreshFiles();
      addToast('New project — workspace cleared', 'success');
    } catch (e) { addToast(e.message, 'error'); }
  };

  const isRunning = run?.status === 'running';
  const awaiting = run?.status === 'awaiting_approval';
  const interrupted = run?.status === 'interrupted';
  const finished = run && ['done', 'error', 'stopped'].includes(run.status);
  // Recovered runs the user isn't already looking at (the current run shows its own inline Resume).
  const otherResumable = resumable.filter(r => r.id !== runId);
  // Only show files the user dropped in — hide the locked base scaffold (index.html, etc.).
  const userFiles = files.filter(f => !PROTECTED.has(f.path));

  return (
    <div className="chat-layout" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Slim header + project actions */}
      <div style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Bot size={17} style={{ color: 'var(--accent)' }} /> <strong>Autonomous Agent</strong>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>— writes &amp; tests code in <code>workspace/</code></span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={handleNewProject} disabled={isRunning || awaiting} title="Clear the workspace and start a fresh project">
            <FilePlus2 size={13} /> New project
          </button>
          <a className="btn btn-sm" href="/workspace/index.html" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={13} /> Open app
          </a>
          <a className="btn btn-sm" href={AGENT_EXPORT_URL}>
            <Download size={13} /> Export
          </a>
        </div>
      </div>

      {/* Status bar */}
      {run && (
        <div style={{ padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '0.5px solid var(--border)' }}>
          {isRunning && <Loader2 size={14} className="spin" style={{ color: 'var(--accent)' }} />}
          <span style={{ fontWeight: 600, fontSize: 13, color: run.status === 'done' ? 'var(--success)' : run.status === 'error' ? 'var(--danger)' : run.status === 'interrupted' ? '#f59e0b' : 'var(--text)' }}>{STATUS_LABEL[run.status] || run.status}</span>
          {typeof run.modelCalls === 'number' && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>· {run.steps?.length || 0} steps</span>}
          {/* PROTECTION STATUS - on every run. Unprotected says so in words, not by omission. */}
          <span
            title={run.protectionNote || ''}
            style={{
              fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
              color: run.protection === 'BEHAVIORAL_ACCEPTANCE' ? 'var(--success)' : run.protection === 'FAILED_TO_APPLY' ? 'var(--danger)' : '#b45309',
              border: `1px solid ${run.protection === 'BEHAVIORAL_ACCEPTANCE' ? 'var(--success)' : run.protection === 'FAILED_TO_APPLY' ? 'var(--danger)' : '#b45309'}`,
            }}
          >
            {/* STATUS, not selection: while running, acceptance is ENABLED and the verdict is pending;
                afterwards the badge shows the actual disposition. It never implies success in advance. */}
            {run.protection === 'BEHAVIORAL_ACCEPTANCE'
              ? (run.governance?.disposition ? `ACCEPTANCE · ${run.governance.disposition}` : 'BEHAVIORAL ACCEPTANCE ENABLED · verdict pending')
              : run.protection === 'FAILED_TO_APPLY' ? 'PROTECTION FAILED TO APPLY'
                : 'NO BEHAVIORAL ACCEPTANCE PROTECTION'}
          </span>
          {interrupted && (
            <button className="btn btn-sm btn-primary" style={{ marginLeft: 'auto' }} onClick={() => handleResume()} disabled={busy} title="Continue this run from where the tunnel dropped">
              <Play size={13} /> Resume
            </button>
          )}
        </div>
      )}

      {/* Work queue + approval mode.
          The queue is what makes AGENT_SUPERVISOR=1 useful: a finished run pulls the
          next goal by itself. The mode is shown because it decides what executes with
          nobody watching — "build" and "yolo" run code unattended, and that should never
          be invisible. */}
      <div style={{ borderBottom: '0.5px solid var(--border)' }}>
        <div
          onClick={() => setShowQueue(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}
        >
          <ListPlus size={13} />
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>Queue</span>
          <span style={{ color: 'var(--text-tertiary)' }}>{queue.length} waiting</span>
          {supervisor && <span title="A clean finish pulls the next queued goal automatically" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(22,166,121,0.16)', color: 'var(--success)' }}>auto</span>}
          {queueMode && (
            // The approval mode decides what executes with nobody watching, so it scales
            // with the risk instead of sitting in one quiet grey pill:
            //   strict  quiet — nothing executes unattended
            //   build   amber — installs deps and runs workspace code on its own
            //   yolo    red, bordered, shouted — everything but the hard denylist
            <span
              title={queueMode === 'strict'
                ? 'Only read-only inspection runs unattended. Anything that executes waits for you.'
                : queueMode === 'build'
                  ? 'Installs dependencies and RUNS CODE in the workspace without asking. Use on a machine you can afford to lose.'
                  : 'Runs everything except the hard denylist, unattended. Disposable machines only.'}
              style={{
                marginLeft: 'auto', flexShrink: 0,
                fontSize: queueMode === 'strict' ? 10 : 11,
                fontWeight: queueMode === 'strict' ? 400 : 700,
                letterSpacing: queueMode === 'strict' ? 0 : '.06em',
                fontFamily: 'var(--mono)', padding: '1px 7px', borderRadius: 4,
                textTransform: queueMode === 'strict' ? 'none' : 'uppercase',
                background: queueMode === 'strict' ? 'rgba(120,130,150,0.18)'
                  : queueMode === 'build' ? 'rgba(245,158,11,0.18)' : 'rgba(224,62,62,0.20)',
                color: queueMode === 'strict' ? 'var(--text-tertiary)'
                  : queueMode === 'build' ? '#f59e0b' : '#ff8080',
                border: queueMode === 'yolo' ? '1px solid rgba(224,62,62,0.65)' : '1px solid transparent',
              }}
            >
              {queueMode !== 'strict' && '⚡ '}{queueMode}
            </span>
          )}
        </div>

        {showQueue && (
          <div style={{ padding: '0 14px 12px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: queue.length ? 8 : 0 }}>
              <input
                value={queueGoal}
                onChange={e => setQueueGoal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addToQueue(); }}
                placeholder="Queue a goal for after this run…"
                style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '6px 9px', borderRadius: 6, border: '0.5px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text)' }}
              />
              <button className="btn btn-sm" onClick={addToQueue} disabled={!queueGoal.trim()}>Add</button>
              <button className="btn btn-sm" onClick={runNextQueued} disabled={busy || !queue.length} title="Start the next queued goal now">
                <Play size={12} /> Next
              </button>
            </div>
            {queueDupe && queueDupe.goal === queueGoal.trim() && (
              <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 8, lineHeight: 1.5 }}>
                {queueDupe.message} — press <strong>Add</strong> again to queue it anyway.
              </div>
            )}
            {queue.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                <span style={{ flex: 1, minWidth: 0, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.goal}
                </span>
                {item.generation > 0 && (
                  <span
                    title={`${item.generation} step(s) removed from anything you asked for — the agent queued this itself`}
                    style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(120,130,150,0.18)', color: 'var(--text-tertiary)', flexShrink: 0 }}
                  >
                    gen {item.generation}
                  </span>
                )}
                {item.source === 'agent' && <span title="The agent queued this itself" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>self</span>}
                <button className="btn btn-sm" onClick={() => dropFromQueue(item.id)} title="Remove"><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <LedgerStrip active={!!run && run.status === 'running'} />

      {/* Recovery banner: runs the server restored as paused after a tunnel drop / restart */}
      {otherResumable.length > 0 && (
        <div style={{ padding: 12, background: 'rgba(245,158,11,0.08)', borderBottom: '0.5px solid rgba(245,158,11,0.5)' }}>
          <div style={{ fontSize: 13, marginBottom: 8, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
            {otherResumable.length} paused run{otherResumable.length > 1 ? 's' : ''} can be resumed — point the Ollama tunnel at the new URL in Settings first.
          </div>
          {otherResumable.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.goal} <span style={{ color: 'var(--text-tertiary)' }}>· {r.steps} steps</span>
              </span>
              <button className="btn btn-sm" onClick={() => handleResume(r.id)} disabled={busy}><Play size={13} /> Resume</button>
            </div>
          ))}
        </div>
      )}

      {/* Approval bar */}
      {awaiting && run.pending && (
        <div style={{ padding: 14, background: 'rgba(245,158,11,0.08)', borderBottom: '0.5px solid rgba(245,158,11,0.5)' }}>
          <div style={{ fontSize: 13, marginBottom: 8, color: 'var(--text)' }}>
            <AlertTriangle size={14} style={{ verticalAlign: -2, color: '#f59e0b' }} /> The agent wants to run a command:
          </div>
          <pre style={{ background: 'var(--bg-tertiary)', color: 'var(--text)', padding: 10, borderRadius: 7, fontSize: 13, margin: '0 0 10px', whiteSpace: 'pre-wrap', border: '0.5px solid var(--border)', fontFamily: 'var(--mono)' }}>
            {run.pending.args?.cmd}
          </pre>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => handleApprove(true)} disabled={approving}><Check size={14} /> Approve &amp; run</button>
            <button className="btn btn-sm" onClick={() => handleApprove(false)} disabled={approving}><X size={13} /> Deny</button>
          </div>
        </div>
      )}

      {/* Step log fills the available space */}
      <div ref={logRef} style={{ flex: 1, overflow: 'auto' }}>
        {!run && (
          // An empty state that only explains is a dead end. These are real starting
          // goals — one per kind of project the verifier knows how to check — so the
          // first click produces something the hub can actually prove works.
          <div className="empty-state" style={{ padding: '36px 40px', textAlign: 'center' }}>
            <BookOpen size={34} style={{ marginBottom: 10, opacity: 0.5 }} />
            <p style={{ opacity: 0.6, maxWidth: 460, margin: '0 auto 22px' }}>
              Give the agent a goal and it will plan, write files, and run code to build it
              {queueMode === 'strict' ? ' — pausing for your OK before any command.' : '.'}
            </p>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-tertiary)', marginBottom: 9 }}>
              Try one
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', maxWidth: 560, margin: '0 auto' }}>
              {STARTERS.map(s => (
                <button
                  key={s.label}
                  className="btn btn-sm"
                  title={s.goal}
                  onClick={() => setGoal(s.goal)}
                  style={{ fontSize: 12 }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {run?.steps?.map((s, i) => <StepRow key={i} step={s} n={s.n || i + 1} />)}
        {finished && run.status === 'done' && (
          <div style={{ padding: 16, color: 'var(--success)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={16} /> Build complete — click <strong>Open app</strong> to view it, or <strong>Export</strong> to download.
          </div>
        )}
      </div>

      {/* Input dock at the bottom (also a drop zone for your own files) */}
      <div
        style={{ padding: 14, borderTop: '0.5px solid var(--border)', background: dragging ? 'var(--accent-bg)' : 'var(--bg-secondary)', outline: dragging ? '2px dashed var(--accent)' : 'none', outlineOffset: -6, transition: 'background .1s' }}
        onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDrop={onDrop}
      >
        {/* Files you dropped in — the base scaffold (index.html, etc.) stays hidden */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={() => fileInputRef.current?.click()}>
            <Upload size={13} /> Add files
          </button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => { uploadFiles(e.target.files); e.target.value = ''; }} />
          {userFiles.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>…or drag &amp; drop files (or a .zip) here for the agent to edit</span>
          ) : (
            userFiles.map((f) => (
              <span key={f.path} className="pill" style={{ gap: 6, borderColor: 'var(--accent-border)', color: 'var(--text)', background: 'var(--accent-bg)' }}>
                <FileCode size={11} style={{ opacity: 0.8, color: 'var(--accent)' }} />
                {f.path}
                <Trash2 size={11} style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => removeFile(f.path)} title="Remove this file" />
              </span>
            ))
          )}
        </div>

        <textarea
          className="chat-input"
          style={{ width: '100%', minHeight: 64, resize: 'vertical' }}
          placeholder={finished
            ? "Keep building — e.g. 'add a reset button', or 'the score never updates, fix it'. The agent keeps the current files and your last result.  (⌘/Ctrl+Enter)"
            : "Describe what to build, e.g. 'Build a Python CLI todo app with add/list/done commands, stored in tasks.json. Test it.'  (⌘/Ctrl+Enter to build)"}
          value={goal}
          onChange={e => setGoal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend(); } }}
          disabled={isRunning || awaiting}
        />
        {/* GOVERNED RUN: declared checks. With these, the start state is verified, the result is evaluated
            in the isolated worker, and protected behaviour that breaks is rolled back. Without them the
            run is ordinary and is labelled as unprotected. */}
        <div style={{ marginTop: 6 }}>
          <button className="btn btn-sm" onClick={() => setShowChecks(v => !v)} disabled={isRunning || awaiting}
            title="Declare requested and protected checks to run this goal with behavioral acceptance protection">
            {showChecks ? 'Hide' : (checksText.trim() ? 'Governed run · checks declared' : 'Governed run · declare checks')}
          </button>
          {showChecks && (
            <textarea
              className="chat-input"
              style={{ width: '100%', minHeight: 90, resize: 'vertical', marginTop: 6, fontFamily: 'monospace', fontSize: 12 }}
              placeholder={'{ "requested": { "script": "python3 /check/req.py", "files": { "req.py": "..." } },\n  "protected": { "script": "python3 /check/prot.py", "files": { "prot.py": "..." } } }\nScripts run in the isolated worker with the candidate mounted read-only at /candidate. Protected must PASS on the starting state or the start is BLOCKED.'}
              value={checksText}
              onChange={e => setChecksText(e.target.value)}
              disabled={isRunning || awaiting}
            />
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary" onClick={handleSend} disabled={busy || isRunning || awaiting || !goal.trim()}>
            <Play size={14} /> {isRunning || awaiting ? 'Running…' : finished ? 'Continue building' : (checksText.trim() ? 'Build it (governed)' : 'Build it')}
          </button>
          {(isRunning || awaiting) && (
            <button className="btn btn-sm" onClick={handleStop}><Square size={13} /> Stop</button>
          )}
        </div>
        {finished && (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
            Continuing this run — the agent keeps its previous work &amp; conversation. Use <strong>New project</strong> above to start fresh instead.
          </div>
        )}
      </div>
    </div>
  );
}
