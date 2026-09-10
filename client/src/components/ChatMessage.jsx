import React, { useState } from 'react';
import { Copy, Loader2, AlertCircle, Check, Play } from 'lucide-react';
import { PROVIDER_MAP } from '../lib/constants.js';
import { codeToGame } from '../lib/flow.js';
import { useStore } from '../store/useStore.js';
import Markdown from './Markdown.jsx';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatMessage({ message, provider }) {
  const [copied, setCopied] = useState(false);
  const loadCodeIntoGame = useStore(s => s.loadCodeIntoGame);
  const providerMeta = PROVIDER_MAP[provider] || {};
  const isUser = message.role === 'user';

  // Find a runnable code block in a finished assistant reply so it can be sent straight
  // to the Game preview. The choice of block lives in lib/flow.js with the other
  // tab-to-tab rules, so there is one place to change what "runnable" means.
  const playable = (!isUser && message.content && !message.streaming) ? codeToGame(message.content) : null;
  const canPlay = !message.error && !!playable;
  const handlePlay = () => { if (playable) loadCodeIntoGame(playable.code); };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className={`chat-msg ${isUser ? 'chat-msg-user' : 'chat-msg-ai'}`}>
      <div className="chat-msg-meta">
        {isUser ? (
          <span className="chat-msg-who">You</span>
        ) : (
          <>
            <span className="provider-dot" style={{ background: providerMeta.color }} />
            <span className="chat-msg-who">{providerMeta.name || provider}</span>
            {message.streaming && <Loader2 size={11} className="spin" style={{ color: 'var(--text-tertiary)' }} />}
            {message.error && <AlertCircle size={11} style={{ color: 'var(--danger)' }} />}
          </>
        )}
        <span className="chat-msg-time">{formatTime(message.ts)}</span>
        {!isUser && message.tokens > 0 && (
          <span className="token-badge" style={{ marginLeft: 0 }}>{message.tokens} tok</span>
        )}
        {!isUser && (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {canPlay && (
              <button className="btn btn-sm" onClick={handlePlay} title="Run this code in the Game preview">
                <Play size={11} /> Play in Game
              </button>
            )}
            <button className="btn-icon" onClick={handleCopy} title="Copy">
              {copied ? <Check size={11} style={{ color: 'var(--success)' }} /> : <Copy size={11} />}
            </button>
          </span>
        )}
      </div>

      <div className={`chat-msg-body ${isUser ? 'chat-msg-body-user' : 'chat-msg-body-ai'}`}>
        {message.error ? (
          <span style={{ color: 'var(--danger)', fontSize: 13 }}>{message.error}</span>
        ) : isUser ? (
          <pre className="chat-user-pre">{message.content}</pre>
        ) : (
          <>
            <Markdown text={message.content} />
            {message.streaming && <span className="cursor" />}
          </>
        )}
      </div>
    </div>
  );
}
