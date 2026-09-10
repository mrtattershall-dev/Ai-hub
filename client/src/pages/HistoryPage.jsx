import React, { useEffect, useState } from 'react';
import { History as HistoryIcon, Trash2, ChevronDown, ChevronRight, RotateCcw, ArrowRight } from 'lucide-react';
import { useStore } from '../store/useStore.js';
import { PROVIDER_MAP, PROVIDERS } from '../lib/constants.js';
import Markdown from '../components/Markdown.jsx';
import { getHistory, deleteHistoryItem, clearHistory } from '../lib/api.js';
import { historyToPlan } from '../lib/flow.js';

function formatDate(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function HistoryPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tabFilter, setTabFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const addToast = useStore(s => s.addToast);
  const sendHandoff = useStore(s => s.sendHandoff);
  const setActiveTab = useStore(s => s.setActiveTab);

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (tabFilter !== 'all') params.tab = tabFilter;
      if (providerFilter !== 'all') params.provider = providerFilter;
      const data = await getHistory(params);
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tabFilter, providerFilter]);

  /**
   * Put a saved plan back in front of the flow.
   *
   * History is where every plan already lives, but as a transcript: readable, and dead.
   * Handing the row back to Strategy as an output restores the only thing that was
   * missing - the hops - so a plan written last night can still become a build brief or
   * an unattended chain this morning, without regenerating it and paying for a different
   * plan that happens to answer the same question.
   */
  const handleReopen = (row, e) => {
    e.stopPropagation();
    const plan = historyToPlan(row);
    if (!plan) { addToast('That entry has no plan text to reopen', 'error'); return; }
    sendHandoff('strategy', { plan });
    setActiveTab('strategy');
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await deleteHistoryItem(id);
      setRows(r => r.filter(row => row.id !== id));
      setTotal(t => Math.max(0, t - 1));
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Delete all saved history? This cannot be undone.')) return;
    try {
      await clearHistory();
      setRows([]);
      setTotal(0);
      addToast('History cleared');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div className="output-area" style={{ paddingTop: 14 }}>
      <div className="history-toolbar">
        <select value={tabFilter} onChange={(e) => setTabFilter(e.target.value)}>
          <option value="all">All tabs</option>
          <option value="code">Code</option>
          <option value="strategy">Strategy</option>
        </select>
        <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
          <option value="all">All providers</option>
          {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn btn-sm" onClick={load} title="Refresh">
          <RotateCcw size={12} /> Refresh
        </button>
        <span style={{ flex: 1 }} />
        <span className="topbar-sub">{total} saved</span>
        <button className="btn btn-sm btn-danger" onClick={handleClearAll} disabled={!rows.length}>
          <Trash2 size={12} /> Clear all
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading...</p></div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <HistoryIcon size={40} />
          <p>No history yet. Requests from the Code and Strategy tabs are saved here automatically.</p>
        </div>
      ) : (
        rows.map(row => {
          const provider = PROVIDER_MAP[row.provider] || {};
          const isOpen = expandedId === row.id;
          return (
            <div key={row.id} className="history-item" onClick={() => setExpandedId(isOpen ? null : row.id)}>
              <div className="history-meta">
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="provider-dot" style={{ background: provider.color }} />
                <span className="pill">{row.tab}</span>
                <span className="pill amber" style={{ textTransform: 'capitalize' }}>{row.task}</span>
                <span className="topbar-sub">{provider.name || row.provider}{row.model ? ` · ${row.model}` : ''}</span>
                <span className="history-time">{formatDate(row.created_at)}</span>
              </div>
              {!isOpen && <div className="history-prompt">{row.prompt}</div>}
              {isOpen && (
                <div className="history-detail">
                  <div className="out-block">
                    <div className="out-header">
                      Prompt
                      <span className="token-badge">
                        {row.tokens_used ? `${row.tokens_used} tokens · ` : ''}{row.duration_ms ? `${row.duration_ms}ms` : ''}
                      </span>
                    </div>
                    <div className="out-body">{row.prompt}</div>
                  </div>
                  <div className="out-block">
                    <div className="out-header">Response</div>
                    <div className="out-body"><Markdown text={row.response} /></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    {row.tab === 'strategy' && (
                      <button
                        className="btn btn-sm"
                        onClick={(e) => handleReopen(row, e)}
                        title="Put this plan back in the Strategy tab, with its handoffs"
                      >
                        <ArrowRight size={12} /> Open in Strategy
                      </button>
                    )}
                    <button className="btn btn-sm btn-danger" onClick={(e) => handleDelete(row.id, e)}>
                      <Trash2 size={12} /> Delete entry
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
