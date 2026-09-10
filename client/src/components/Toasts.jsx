import React from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { useStore } from '../store/useStore.js';

export default function Toasts() {
  const toasts = useStore(s => s.toasts);

  if (!toasts.length) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {t.type === 'error' ? <AlertCircle size={14} /> : <Check size={14} />}
            {t.message}
          </span>
        </div>
      ))}
    </div>
  );
}
