import React, { useEffect, useRef, useState } from 'react';
import { Send, Compass, Wand2, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore.js';
import ChipGroup from '../components/ChipGroup.jsx';
import OutputBlock from '../components/OutputBlock.jsx';
import { CANVAS_TYPES } from '../lib/constants.js';
import { buildStrategyPrompt, buildStrategyRevisionPrompt } from '../lib/prompts.js';
import { chatStream } from '../lib/api.js';

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * The refine box under a plan.
 *
 * A plan is a draft you argue with, and until this existed the only way to argue was to
 * retype the whole description at the top of the tab and generate a stranger. The
 * instruction is deliberately one line: it is an amendment to a plan that already exists,
 * not a new brief.
 */
function RefineBox({ onRefine, busy }) {
  const [text, setText] = useState('');
  const send = () => {
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    onRefine(t);
  };
  return (
    <div className="refine-row">
      <Wand2 size={13} />
      <input
        type="text"
        placeholder='Refine this plan - "split milestone 2", "add a rollback task", "cut scope to one week"'
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
        disabled={busy}
      />
      <button className="btn btn-sm" onClick={send} disabled={!text.trim() || busy}>
        {busy ? <Loader2 size={12} className="spin" /> : 'Revise'}
      </button>
    </div>
  );
}

export default function StrategyPage() {
  const [input, setInput] = useState('');
  const [temperature, setTemperature] = useState(0.4);

  const activeCanvas = useStore(s => s.activeCanvas);
  const setActiveCanvas = useStore(s => s.setActiveCanvas);
  const activeProvider = useStore(s => s.activeProvider);
  const connectedProviders = useStore(s => s.connectedProviders);
  const isStreaming = useStore(s => s.isStreaming);
  const setIsStreaming = useStore(s => s.setIsStreaming);
  const outputs = useStore(s => s.outputs);
  const addOutput = useStore(s => s.addOutput);
  const updateOutput = useStore(s => s.updateOutput);
  const addToast = useStore(s => s.addToast);
  const setActiveTab = useStore(s => s.setActiveTab);
  const handoff = useStore(s => s.handoff);
  const consumeHandoff = useStore(s => s.consumeHandoff);

  const strategyOutputs = outputs.filter(o => o.kind === 'strategy');
  const canvas = CANVAS_TYPES.find(c => c.id === activeCanvas) || CANVAS_TYPES[0];
  const textareaRef = useRef(null);

  // A plan revived from History arrives as a finished output rather than as a prefilled
  // composer: there is nothing left to send, the point is to get its hops back. The canvas
  // switches to match, so refining it keeps the same section shape the chain reads.
  useEffect(() => {
    const payload = consumeHandoff('strategy');
    if (!payload?.plan) return;
    const plan = payload.plan;
    addOutput({ ...plan, id: newId(), streaming: false });
    if (plan.canvasId) setActiveCanvas(plan.canvasId);
    addToast('Plan reopened - its handoffs are live again');
  }, [handoff, consumeHandoff, addOutput, setActiveCanvas, addToast]);

  // Every send goes through here, so a missing key is caught once rather than per caller.
  const providerReady = () => {
    if (activeProvider !== 'ollama' && !connectedProviders[activeProvider]) {
      addToast('No API key configured for this provider. Add one in Settings.', 'error');
      setActiveTab('settings');
      return false;
    }
    return true;
  };

  /**
   * Stream one canvas response into a new output block.
   *
   * `meta` is what separates a fresh plan from a revision of one: revisions carry their
   * lineage so the block can say which draft you are looking at, and so a plan and its
   * rework are not two unrelated things stacked in the same list.
   */
  const runCanvas = (prompt, meta) => {
    const id = newId();
    addOutput({
      id,
      kind: 'strategy',
      providerId: activeProvider,
      canvasId: activeCanvas,
      label: canvas.label,
      prompt,
      response: '',
      tokens: 0,
      streaming: true,
      createdAt: Date.now(),
      ...meta,
    });

    setIsStreaming(true);
    chatStream(
      { provider: activeProvider, prompt, temperature, tab: 'strategy', task: activeCanvas },
      (delta) => updateOutput(id, (o) => ({ response: o.response + delta })),
      (tokens) => { updateOutput(id, { streaming: false, tokens: tokens || 0 }); setIsStreaming(false); },
      (err) => { updateOutput(id, { streaming: false, error: err }); setIsStreaming(false); addToast(err, 'error'); }
    );
  };

  const handleSend = () => {
    if (!input.trim() || isStreaming || !providerReady()) return;
    runCanvas(buildStrategyPrompt(activeCanvas, input), { rev: 1 });
  };

  const handleRefine = (source, instruction) => {
    if (isStreaming || !providerReady()) return;
    const canvasId = source.canvasId || activeCanvas;
    const prompt = buildStrategyRevisionPrompt(canvasId, source.response, instruction);
    runCanvas(prompt, {
      canvasId,
      rev: (source.rev || 1) + 1,
      revisionOf: source.id,
      revisionNote: instruction,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div className="input-panel">
        <div className="field-group">
          <label>Canvas</label>
          <ChipGroup items={CANVAS_TYPES} activeId={activeCanvas} onChange={setActiveCanvas} />
          <p className="hint" style={{ marginTop: 2 }}>{canvas.description}</p>
        </div>
        <div className="field-group">
          <label>What are you working on?</label>
          <textarea
            ref={textareaRef}
            rows={6}
            placeholder="Describe the project, feature, or decision you want help thinking through..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="send-row">
          <div className="temp-control">
            <label>Temperature</label>
            <input
              type="range"
              min="0" max="1" step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
            />
            <span className="temp-value">{temperature.toFixed(1)}</span>
          </div>
          <span style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={handleSend} disabled={!input.trim() || isStreaming}>
            <Send size={14} /> Generate
          </button>
        </div>
      </div>

      <div className="output-area">
        {strategyOutputs.length === 0 ? (
          <div className="empty-state">
            <Compass size={40} />
            <p>
              Describe what you are working on and get a plan you can act on: refine it in
              place, hand it to Code, or queue it as an unattended chain. Plans you generated
              earlier are saved under History - reopen one there to use its handoffs again.
            </p>
          </div>
        ) : (
          strategyOutputs.map(o => (
            <OutputBlock
              key={o.id}
              output={{ ...o, label: o.rev > 1 ? `${o.label} - revision ${o.rev}` : o.label }}
              footer={o.streaming || o.error ? null : (
                <>
                  {o.revisionNote && <div className="refine-note">Revised: {o.revisionNote}</div>}
                  <RefineBox busy={isStreaming} onRefine={(text) => handleRefine(o, text)} />
                </>
              )}
            />
          ))
        )}
      </div>
    </>
  );
}
