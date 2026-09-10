import React from 'react';
import { Copy, Trash2, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { PROVIDER_MAP } from '../lib/constants.js';
import { splitMarkdownSections } from '../lib/markdown.js';
import Markdown from './Markdown.jsx';
import { useStore } from '../store/useStore.js';
import { hopsFor } from '../lib/flow.js';

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function OutputBlock({ output }) {
  const removeOutput = useStore(s => s.removeOutput);
  const addToast = useStore(s => s.addToast);
  const sendHandoff = useStore(s => s.sendHandoff);
  const provider = PROVIDER_MAP[output.providerId] || {};

  // Where this output can go next. Nothing is offered mid-stream: a half-written plan
  // derives a half-written brief, and the button would look like it worked.
  const hops = output.streaming || output.error ? [] : hopsFor(output);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output.response || '');
      addToast('Copied to clipboard');
    } catch {
      addToast('Could not copy', 'error');
    }
  };

  const isCanvas = output.kind === 'strategy';
  const sections = isCanvas ? splitMarkdownSections(output.response) : [];

  return (
    <div className="out-block">
      <div className="out-header">
        <span className="provider-dot" style={{ background: provider.color }} />
        <span>{provider.name || output.providerId}</span>
        <span className="topbar-sep">·</span>
        <span style={{ textTransform: 'capitalize' }}>{output.label}</span>
        {output.streaming && <Loader2 size={12} className="spin" />}
        {output.error && <AlertCircle size={12} color="var(--danger)" />}
        <span className="token-badge">
          {output.tokens ? `${output.tokens} tokens · ` : ''}{formatTime(output.createdAt)}
        </span>
        <div className="out-actions">
          {hops.map(h => (
            <button
              key={h.to}
              className="btn-icon"
              onClick={() => { sendHandoff(h.to, h.payload); addToast(h.label); }}
              title={h.label}
            >
              <ArrowRight size={13} />
            </button>
          ))}
          <button className="btn-icon" onClick={handleCopy} title="Copy response">
            <Copy size={13} />
          </button>
          <button className="btn-icon" onClick={() => removeOutput(output.id)} title="Remove">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {output.error ? (
        <div className="out-body" style={{ color: 'var(--danger)' }}>
          {output.error}
        </div>
      ) : isCanvas ? (
        <div className="canvas-output">
          {sections.length === 0 && !output.response && (
            <span className="cs-content" style={{ color: 'var(--text-tertiary)' }}>
              Waiting for response<span className="cursor" />
            </span>
          )}
          {sections.map((sec, i) => (
            <div className="canvas-section" key={i}>
              <div className="cs-label">{sec.label}</div>
              <div className="cs-content">
                <Markdown text={sec.content} />
                {output.streaming && i === sections.length - 1 && <span className="cursor" />}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="out-body">
          <Markdown text={output.response} />
          {output.streaming && <span className="cursor" />}
        </div>
      )}
    </div>
  );
}
