import React, { useState } from 'react';
import { Send, Compass } from 'lucide-react';
import { useStore } from '../store/useStore.js';
import ChipGroup from '../components/ChipGroup.jsx';
import OutputBlock from '../components/OutputBlock.jsx';
import { CANVAS_TYPES } from '../lib/constants.js';
import { buildStrategyPrompt } from '../lib/prompts.js';
import { chatStream } from '../lib/api.js';

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

  const strategyOutputs = outputs.filter(o => o.kind === 'strategy');
  const canvas = CANVAS_TYPES.find(c => c.id === activeCanvas) || CANVAS_TYPES[0];

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;

    if (activeProvider !== 'ollama' && !connectedProviders[activeProvider]) {
      addToast(`No API key configured for this provider. Add one in Settings.`, 'error');
      setActiveTab('settings');
      return;
    }

    const prompt = buildStrategyPrompt(activeCanvas, input);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    addOutput({
      id,
      kind: 'strategy',
      providerId: activeProvider,
      label: canvas.label,
      prompt,
      response: '',
      tokens: 0,
      streaming: true,
      createdAt: Date.now(),
    });

    setIsStreaming(true);

    chatStream(
      { provider: activeProvider, prompt, temperature, tab: 'strategy', task: activeCanvas },
      (delta) => updateOutput(id, (o) => ({ response: o.response + delta })),
      (tokens) => { updateOutput(id, { streaming: false, tokens: tokens || 0 }); setIsStreaming(false); },
      (err) => { updateOutput(id, { streaming: false, error: err }); setIsStreaming(false); addToast(err, 'error'); }
    );
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
            <p>Choose a canvas type, describe what you're working on, and get a structured breakdown.</p>
          </div>
        ) : (
          strategyOutputs.map(o => <OutputBlock key={o.id} output={o} />)
        )}
      </div>
    </>
  );
}
