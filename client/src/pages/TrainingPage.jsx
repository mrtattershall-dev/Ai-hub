import React, { useState } from 'react';
import { Plus, Trash2, Edit3, Check, X, BookOpen, AlertTriangle, Zap, Shield } from 'lucide-react';
import { useStore } from '../store/useStore.js';

const CATEGORIES = [
  { id: 'principle', label: 'Principle', icon: Zap, color: '#7c6af7', bg: 'var(--accent-bg)', border: 'var(--accent-border)' },
  { id: 'weakness', label: 'Weakness', icon: AlertTriangle, color: '#e03e3e', bg: '#fef2f2', border: '#fecaca' },
  { id: 'rule',     label: 'Rule',      icon: Shield,        color: '#16a679', bg: '#f0fdf4', border: '#bbf7d0' },
  { id: 'note',     label: 'Note',      icon: BookOpen,      color: '#6b6b65', bg: 'var(--bg-tertiary)', border: 'var(--border-mid)' },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

function formatDate(ts) {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function EntryCard({ entry, onEdit, onDelete }) {
  const cat = CAT_MAP[entry.category] || CAT_MAP.note;
  const Icon = cat.icon;

  return (
    <div className="training-card" style={{ borderLeftColor: cat.color, background: cat.bg, borderLeftWidth: 3, borderLeft: `3px solid ${cat.color}` }}>
      <div className="training-card-head">
        <div className="training-cat-badge" style={{ color: cat.color, background: 'transparent', border: `0.5px solid ${cat.color}` }}>
          <Icon size={10} /> {cat.label}
        </div>
        <span className="training-card-date">{formatDate(entry.createdAt)}</span>
        <div className="training-card-actions">
          <button className="btn-icon" onClick={() => onEdit(entry)} title="Edit"><Edit3 size={12} /></button>
          <button className="btn-icon" onClick={() => onDelete(entry.id)} title="Delete"><Trash2 size={12} /></button>
        </div>
      </div>
      <div className="training-card-title">{entry.title}</div>
      {entry.body && <div className="training-card-body">{entry.body}</div>}
    </div>
  );
}

function EntryForm({ initial, onSave, onCancel }) {
  const [category, setCategory] = useState(initial?.category || 'principle');
  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ category, title: title.trim(), body: body.trim() });
  };

  return (
    <div className="training-form">
      <div className="training-form-cats">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            className={`chip ${category === c.id ? 'active' : ''}`}
            style={category === c.id ? { background: c.color, borderColor: c.color } : {}}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Title — e.g. 'Enforce task decomposition'"
        value={title}
        onChange={e => setTitle(e.target.value)}
        autoFocus
      />
      <textarea
        rows={4}
        placeholder="Details, examples, when to apply…"
        value={body}
        onChange={e => setBody(e.target.value)}
      />
      <div className="training-form-actions">
        <button className="btn" onClick={onCancel}><X size={13} /> Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={!title.trim()}>
          <Check size={13} /> Save
        </button>
      </div>
    </div>
  );
}

export default function TrainingPage() {
  const trainingLog = useStore(s => s.trainingLog);
  const addTrainingEntry = useStore(s => s.addTrainingEntry);
  const updateTrainingEntry = useStore(s => s.updateTrainingEntry);
  const deleteTrainingEntry = useStore(s => s.deleteTrainingEntry);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // entry object
  const [filterCat, setFilterCat] = useState('all');

  const handleAdd = (fields) => {
    addTrainingEntry({ id: `entry-${Date.now()}`, ...fields, createdAt: Date.now() });
    setAdding(false);
  };

  const handleUpdate = (fields) => {
    updateTrainingEntry(editing.id, fields);
    setEditing(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this entry?')) deleteTrainingEntry(id);
  };

  const filtered = filterCat === 'all'
    ? trainingLog
    : trainingLog.filter(e => e.category === filterCat);

  // Group by category for display
  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    entries: filtered.filter(e => e.category === cat.id),
  })).filter(g => g.entries.length > 0);

  return (
    <div className="output-area" style={{ paddingTop: 0 }}>
      {/* Header bar */}
      <div className="training-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={15} style={{ opacity: 0.6 }} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Dev Training Log</span>
          <span className="token-badge">{trainingLog.length} entries</span>
        </div>
        <div className="chips" style={{ flex: 1, justifyContent: 'flex-end' }}>
          <button className={`chip ${filterCat === 'all' ? 'active' : ''}`} onClick={() => setFilterCat('all')}>All</button>
          {CATEGORIES.map(c => (
            <button key={c.id} className={`chip ${filterCat === c.id ? 'active' : ''}`} onClick={() => setFilterCat(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setAdding(true); setEditing(null); }}>
          <Plus size={12} /> Add entry
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <EntryForm onSave={handleAdd} onCancel={() => setAdding(false)} />
      )}

      {/* Entries */}
      {trainingLog.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={40} />
          <p>Your personal dev rulebook. Add principles, weaknesses to watch for, and hard rules you want to enforce.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No {filterCat} entries yet.</p>
        </div>
      ) : (
        grouped.map(group => (
          <div key={group.id} className="training-group">
            <div className="training-group-label" style={{ color: group.color }}>
              <group.icon size={12} /> {group.label}s
            </div>
            {group.entries.map(entry => (
              editing?.id === entry.id ? (
                <EntryForm key={entry.id} initial={entry} onSave={handleUpdate} onCancel={() => setEditing(null)} />
              ) : (
                <EntryCard key={entry.id} entry={entry} onEdit={setEditing} onDelete={handleDelete} />
              )
            ))}
          </div>
        ))
      )}
    </div>
  );
}
