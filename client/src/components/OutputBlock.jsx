import React, { useState } from 'react';
import { Copy, Trash2, Loader2, AlertCircle, ArrowRight, ListPlus } from 'lucide-react';
import { PROVIDER_MAP } from '../lib/constants.js';
import { splitMarkdownSections } from '../lib/markdown.js';
import Markdown from './Markdown.jsx';
import { useStore } from '../store/useStore.js';
import { hopsFor } from '../lib/flow.js';
import { queueChain } from '../lib/api.js';

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function OutputBlock({ output, footer = null }) {
  const removeOutput = useStore(s => s.removeOutput);
  const addToast = useStore(s => s.addToast);
  const sendHandoff = useStore(s => s.sendHandoff);
  const provider = PROVIDER_MAP[output.providerId] || {};

  // Where this output can go next. Nothing is offered mid-stream: a half-written plan
  // derives a half-written brief, and the button would look like it worked.
  const hops = output.streaming || output.error ? [] : hopsFor(output);

  // Posting a chain is a network call, unlike a handoff, so the button has to be able to
  // say "in flight" and refuse a second click. Queueing the same plan twice is not
  // harmless: the server dedups by goal text, so the second attempt looks like a chain
  // that silently did nothing.
  const [queueing, setQueueing] = useState(false);

  const runHop = async (hop) => {
    // A blocked hop is a button that exists to explain itself. Pressing it is how you find
    // out why the plan cannot go this way, so this is the message doing its whole job.
    if (hop.blocked) { addToast(hop.blocked, 'error'); return; }
    if (hop.action !== 'queueChain') {
      sendHandoff(hop.to, hop.payload);
      addToast(hop.label);
      return;
    }
    if (queueing) return;
    setQueueing(true);
    try {
      const r = await queueChain(hop.payload.goals);
      const parts = [`Queued ${r.queued.length} goal${r.queued.length === 1 ? '' : 's'} in order`];
      // Say what did NOT get queued. A chain quietly one step short is the kind of thing
      // you only discover from the run log at 3am.
      if (r.skipped?.length) parts.push(`${r.skipped.length} skipped (${r.skipped[0].reason})`);
      if (hop.payload.dropped) parts.push(`${hop.payload.dropped} beyond the cap not queued`);
      if (!r.supervisor) parts.push('supervisor is OFF — run them from the Agent tab');
      addToast(parts.join(' · '), r.queued.length ? 'success' : 'error');
      if (r.queued.length) useStore.getState().setActiveTab('agent');
    } catch (e) {
      addToast(`Could not queue the chain: ${e.message}`, 'error');
    } finally {
      setQueueing(false);
    }
  };

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
          {hops.map(h => {
            const isQueue = h.action === 'queueChain';
            const busy = isQueue && queueing;
            const count = isQueue && h.payload ? h.payload.goals.length : 0;
            // Blocked hops are dimmed but NOT `disabled`: a disabled button swallows the
            // click, and the click is the only way most people will ever read the reason.
            const title = h.blocked
              ? `${h.label} - unavailable. ${h.blocked}`
              : isQueue ? `${h.label} (${count} goal${count === 1 ? '' : 's'})` : h.label;
            return (
              <button
                key={h.to}
                className={h.blocked ? 'btn-icon hop-blocked' : 'btn-icon'}
                onClick={() => runHop(h)}
                disabled={busy}
                title={title}
              >
                {busy ? <Loader2 size={13} className="spin" /> : isQueue ? <ListPlus size={13} /> : <ArrowRight size={13} />}
                {h.blocked && <AlertCircle size={9} className="hop-blocked-badge" />}
              </button>
            );
          })}
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

      {/* Owned by the page, not by this block: Strategy hangs its refine box here so a
          plan can be reworked in place instead of regenerated from the top of the tab. */}
      {footer}
    </div>
  );
}
