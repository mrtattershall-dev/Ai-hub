import React, { useState, useRef, useEffect } from 'react';
import { Send, Code2, Plus, ChevronDown, Trash2, Square, RotateCcw, TerminalSquare } from 'lucide-react';
import { useStore } from '../store/useStore.js';
import ChipGroup from '../components/ChipGroup.jsx';
import ChatMessage from '../components/ChatMessage.jsx';
import { CODE_TASKS, CODE_MODES } from '../lib/constants.js';
import { buildCodeSystem } from '../lib/prompts.js';
import { chatStream, sendToTerminalApi } from '../lib/api.js';

// How many recent messages of history to send. Bounds context on a long thread
// (the local 14B runs at 32k ctx); older turns drop off, recent ones stay.
const HISTORY_CAP = 12;

export default function CodePage() {
  const [input, setInput] = useState('');
  const [temperature, setTemperature] = useState(0.3);
  const [showThreads, setShowThreads] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const streamRef = useRef(null);   // AbortController for the in-flight generation

  const activeTask = useStore(s => s.activeTask);
  const setActiveTask = useStore(s => s.setActiveTask);
  const activeCodeMode = useStore(s => s.activeCodeMode);
  const setActiveCodeMode = useStore(s => s.setActiveCodeMode);
  const activeProvider = useStore(s => s.activeProvider);
  const gameEngine = useStore(s => s.gameEngine);
  const connectedProviders = useStore(s => s.connectedProviders);
  const isStreaming = useStore(s => s.isStreaming);
  const setIsStreaming = useStore(s => s.setIsStreaming);
  const addToast = useStore(s => s.addToast);
  const activeTerminalSession = useStore(s => s.activeTerminalSession);
  const setActiveTab = useStore(s => s.setActiveTab);
  const handoff = useStore(s => s.handoff);
  const consumeHandoff = useStore(s => s.consumeHandoff);

  const chatThreads = useStore(s => s.chatThreads);
  const activeThreadId = useStore(s => s.activeThreadId);
  const startNewThread = useStore(s => s.startNewThread);
  const addMessageToThread = useStore(s => s.addMessageToThread);
  const updateLastAssistantMessage = useStore(s => s.updateLastAssistantMessage);
  const switchThread = useStore(s => s.switchThread);
  const deleteThread = useStore(s => s.deleteThread);
  const truncateThread = useStore(s => s.truncateThread);

  const currentThreadId = activeThreadId['code'];
  const currentThread = currentThreadId ? chatThreads[currentThreadId] : null;
  const messages = currentThread?.messages || [];

  // All code threads sorted newest first
  const codeThreads = Object.values(chatThreads)
    .filter(t => t.tab === 'code')
    .sort((a, b) => b.updatedAt - a.updatedAt);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messages[messages.length - 1]?.content]);

  // A plan handed over from Strategy lands in the composer rather than being sent. The
  // brief is usually worth a glance before it becomes code, and an auto-send would burn a
  // request on a prefill you were about to edit. Anything already typed is kept: losing a
  // half-written prompt to a button pressed in another pane would be indefensible.
  useEffect(() => {
    const payload = consumeHandoff('code');
    if (!payload) return;
    setInput(prev => (prev.trim() ? `${prev.trim()}

${payload.input}` : payload.input));
    if (payload.task) setActiveTask(payload.task);
    textareaRef.current?.focus();
  }, [handoff, consumeHandoff, setActiveTask]);

  // Build the message list the model sees: a persistent system frame, the recent
  // conversation (so it builds on its own last output), then the latest turn.
  const buildConvo = (priorMessages) => {
    const prior = priorMessages
      .filter(m => m.content && !m.error)
      .slice(-HISTORY_CAP)
      .map(m => ({ role: m.role, content: m.content }));
    return [{ role: 'system', content: buildCodeSystem(activeTask, activeCodeMode, gameEngine) }, ...prior];
  };

  // Add a streaming assistant placeholder and pump the reply into it. Streaming
  // keeps the tunnel alive — a slow 14B non-streaming reply trips Cloudflare's
  // ~100s quick-tunnel timeout and returns an HTML error page. `settled` guards a
  // double finish; the AbortController lets the Stop button cancel mid-generation.
  const stream = (threadId, convo) => {
    addMessageToThread(threadId, { role: 'assistant', content: '', ts: Date.now(), streaming: true, tokens: 0 });
    setIsStreaming(true);
    const controller = new AbortController();
    streamRef.current = controller;
    let acc = '';
    let settled = false;
    const finish = (patch) => {
      if (settled) return;
      settled = true;
      streamRef.current = null;
      updateLastAssistantMessage(threadId, { streaming: false, ...patch });
      setIsStreaming(false);
    };
    chatStream(
      { provider: activeProvider, messages: convo, temperature, tab: 'code', task: activeTask },
      (delta) => { acc += delta; updateLastAssistantMessage(threadId, { content: acc, streaming: true }); },
      (tokens) => finish({ content: acc, tokens: tokens || 0 }),
      (err) => {
        // A user-initiated Stop aborts the fetch — keep what streamed so far, no error.
        if (controller.signal.aborted) { finish({ content: acc }); return; }
        finish({ content: acc, error: err });
        addToast(err, 'error');
      },
      controller.signal,
    );
  };

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;

    if (activeProvider !== 'ollama' && !connectedProviders[activeProvider]) {
      addToast('No API key configured for this provider. Add one in Settings.', 'error');
      setActiveTab('settings');
      return;
    }

    let threadId = currentThreadId;
    if (!threadId) threadId = startNewThread('code', activeTask, activeProvider);

    const convo = [...buildConvo(messages), { role: 'user', content: input }];
    addMessageToThread(threadId, { role: 'user', content: input, ts: Date.now() });
    setInput('');
    stream(threadId, convo);
  };

  // Cancel the in-flight generation; whatever streamed so far is kept.
  const handleStop = () => {
    try { streamRef.current?.abort(); } catch {}
  };

  // Redo the last assistant reply: drop it, then re-run the same last user turn
  // with the conversation up to that point. Now possible because we send history.
  const handleRegenerate = () => {
    if (isStreaming || !currentThreadId) return;
    const msgs = currentThread?.messages || [];
    let lastUser = -1;
    for (let i = msgs.length - 1; i >= 0; i--) { if (msgs[i].role === 'user') { lastUser = i; break; } }
    if (lastUser === -1) return;
    truncateThread(currentThreadId, lastUser + 1);     // keep through that user message
    stream(currentThreadId, buildConvo(msgs.slice(0, lastUser + 1)));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend(); }
  };

  const handleNewThread = () => {
    startNewThread('code', activeTask, activeProvider);
    setShowThreads(false);
  };

  const estTokens = Math.ceil(input.length / 4);
  const hasReply = messages.some(m => m.role === 'assistant' && m.content && !m.streaming);

  // Send whatever you've highlighted to the live shell in the Terminal tab. With
  // nothing selected, falls back to the last code block the AI produced - which is
  // the common case: read a command in the reply, run it without retyping it.
  const sendToTerminal = async () => {
    let text = (window.getSelection && window.getSelection().toString()) || '';
    let source = 'selection';
    if (!text.trim()) {
      const thread = activeThreadId['code'] ? chatThreads[activeThreadId['code']] : null;
      const lastAsst = thread && [...thread.messages].reverse().find(m => m.role === 'assistant' && m.content);
      const blocks = lastAsst ? extractCodeBlocks(lastAsst.content) : [];
      const pick = blocks.find(b => ['bash','sh','shell','powershell','ps1','cmd'].includes((b.lang||'').toLowerCase())) || blocks[0];
      if (!pick) { addToast('Select some text, or generate a code block first.', 'error'); return; }
      text = pick.code; source = 'last code block';
    }
    try {
      await sendToTerminalApi({ text, newline: false, sessionId: activeTerminalSession });
      addToast('Sent ' + source + ' to Terminal (press Enter there to run).');
    } catch (e) {
      addToast(e.message || 'No open terminal - open the Terminal tab first.', 'error');
    }
  };

  return (
    <div className="chat-layout">
      {/* Thread bar */}
      <div className="thread-bar">
        <button className="btn btn-sm" onClick={handleNewThread} title="New conversation">
          <Plus size={12} /> New chat
        </button>
        <div className="thread-switcher" onClick={() => setShowThreads(v => !v)}>
          <span className="thread-title-short">
            {currentThread
              ? (currentThread.messages[0]?.content?.slice(0, 40) || 'Conversation') + (currentThread.messages[0]?.content?.length > 40 ? '…' : '')
              : 'No conversation yet'}
          </span>
          <ChevronDown size={12} />
        </div>

        {showThreads && (
          <div className="thread-dropdown">
            {codeThreads.length === 0 && <div className="thread-dd-empty">No conversations yet</div>}
            {codeThreads.map(t => (
              <div
                key={t.id}
                className={`thread-dd-item ${t.id === currentThreadId ? 'active' : ''}`}
                onClick={() => { switchThread('code', t.id); setShowThreads(false); }}
              >
                <span className="thread-dd-label">
                  {t.messages[0]?.content?.slice(0, 50) || 'Empty'}
                  {t.messages[0]?.content?.length > 50 ? '…' : ''}
                </span>
                <span className="thread-dd-meta">{t.messages.length} msgs</span>
                <button className="btn-icon thread-dd-del" onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }} title="Delete">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <Code2 size={40} />
            <p>Pick a task, type your prompt, and start a conversation with your AI provider.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} provider={activeProvider} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input panel */}
      <div className="chat-input-panel">
        <div className="chat-input-controls">
          <ChipGroup items={CODE_TASKS} activeId={activeTask} onChange={setActiveTask} compact />
          <div className="chat-mode-sep" />
          <ChipGroup items={CODE_MODES} activeId={activeCodeMode} onChange={setActiveCodeMode} compact />
        </div>
        <div className="chat-compose">
          <textarea
            ref={textareaRef}
            rows={3}
            placeholder="Paste code or describe what you need… (⌘+Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="chat-textarea"
          />
          <div className="chat-compose-footer">
            <div className="temp-control" style={{ flex: 1 }}>
              <label style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Temp</label>
              <input type="range" min="0" max="1" step="0.1" value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))} />
              <span className="temp-value">{temperature.toFixed(1)}</span>
            </div>
            <span className="token-badge">~{estTokens} tok</span>
            <button className="btn btn-sm" onClick={sendToTerminal}
                    title="Send the highlighted text (or the last code block) to the Terminal tab">
              <TerminalSquare size={13} /> To Terminal
            </button>
            {hasReply && !isStreaming && (
              <button className="btn btn-sm" onClick={handleRegenerate} title="Redo the last reply">
                <RotateCcw size={13} /> Regenerate
              </button>
            )}
            {isStreaming ? (
              <button className="btn" onClick={handleStop} title="Stop generating">
                <Square size={13} /> Stop
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleSend} disabled={!input.trim()}>
                <Send size={13} /> Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
