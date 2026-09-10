import React, { useRef, useState, useCallback } from 'react';
import { SplitSquareHorizontal, SplitSquareVertical, X, ChevronDown } from 'lucide-react';
import { useStore } from '../store/useStore.js';
import { layout, countLeaves } from '../lib/panes.js';
import PaneBoundary from './PaneBoundary.jsx';
import { VIEWS, viewLabel, viewIcon } from '../lib/views.jsx';

// Every pane is rendered ONCE here as an absolutely positioned sibling. Splitting
// only changes rects, never the DOM parent, so a pane's contents (a live shell, a
// running game) keep running across splits.
export default function Workspace() {
  const tree = useStore(s => s.paneTree);
  const activePaneId = useStore(s => s.activePaneId);
  const setActivePane = useStore(s => s.setActivePane);
  const splitPane = useStore(s => s.splitPane);
  const closePane = useStore(s => s.closePane);
  const setPaneView = useStore(s => s.setPaneView);
  const setPaneRatio = useStore(s => s.setPaneRatio);

  const hostRef = useRef(null);
  const [menuFor, setMenuFor] = useState(null);
  const { panes, splitters } = layout(tree);
  const multi = countLeaves(tree) > 1;

  // Drag a splitter: convert pointer position to a 0..1 ratio of the parent's box.
  const startDrag = useCallback((sp, e) => {
    e.preventDefault();
    const host = hostRef.current;
    if (!host) return;
    const box = host.getBoundingClientRect();
    const move = (ev) => {
      const pct = sp.dir === 'row'
        ? ((ev.clientX - box.left) / box.width) * 100
        : ((ev.clientY - box.top) / box.height) * 100;
      // The splitter's rect gives the parent's origin and extent along the drag axis.
      const origin = sp.dir === 'row' ? sp.parent.x : sp.parent.y;
      const extent = sp.dir === 'row' ? sp.parent.w : sp.parent.h;
      if (extent <= 0) return;
      setPaneRatio(sp.path, (pct - origin) / extent);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.classList.remove('ws-dragging');
    };
    document.body.classList.add('ws-dragging');
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, [setPaneRatio]);

  return (
    <div className="ws-host" ref={hostRef}>
      {panes.map(p => {
        const View = VIEWS[p.view] || VIEWS.code;
        const isActive = p.id === activePaneId;
        return (
          <div key={p.id}
               className={`ws-pane ${isActive && multi ? 'active' : ''}`}
               style={{ left: p.rect.x + '%', top: p.rect.y + '%', width: p.rect.w + '%', height: p.rect.h + '%' }}
               onMouseDown={() => setActivePane(p.id)}>
            <div className="ws-pane-head">
              <button className="ws-view-btn" onClick={() => setMenuFor(m => m === p.id ? null : p.id)}
                      title="Change what this pane shows">
                {viewIcon(p.view)} {viewLabel(p.view)} <ChevronDown size={11} />
              </button>
              {menuFor === p.id && (
                <div className="ws-view-menu" onMouseLeave={() => setMenuFor(null)}>
                  {Object.keys(VIEWS).map(v => (
                    <button key={v} className={`ws-view-item ${v === p.view ? 'on' : ''}`}
                            onClick={() => { setPaneView(p.id, v); setMenuFor(null); }}>
                      {viewIcon(v)} {viewLabel(v)}
                    </button>
                  ))}
                </div>
              )}
              <span style={{ flex: 1 }} />
              <button className="ws-icon" title="Split right" onClick={() => splitPane(p.id, 'row')}>
                <SplitSquareHorizontal size={13} />
              </button>
              <button className="ws-icon" title="Split down" onClick={() => splitPane(p.id, 'col')}>
                <SplitSquareVertical size={13} />
              </button>
              {multi && (
                <button className="ws-icon danger" title="Close pane" onClick={() => closePane(p.id)}>
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="ws-pane-body">
              {/* keyed by view so switching a crashed pane's view clears the error */}
              <PaneBoundary key={p.view} view={p.view}><View /></PaneBoundary>
            </div>
          </div>
        );
      })}

      {splitters.map((sp, i) => {
        // Recover the parent box so the drag maths knows its origin and extent.
        const parent = parentRect(tree, sp.path);
        const s = { ...sp, parent };
        return (
          <div key={i}
               className={`ws-splitter ${sp.dir}`}
               style={sp.dir === 'row'
                 ? { left: sp.rect.x + '%', top: sp.rect.y + '%', height: sp.rect.h + '%' }
                 : { left: sp.rect.x + '%', top: sp.rect.y + '%', width: sp.rect.w + '%' }}
               onMouseDown={(e) => startDrag(s, e)} />
        );
      })}
    </div>
  );
}

// Walk `path` from the root, tracking the rect each split occupies.
function parentRect(node, path) {
  let rect = { x: 0, y: 0, w: 100, h: 100 };
  let cur = node;
  for (const step of path) {
    const r = Math.min(0.9, Math.max(0.1, cur.ratio ?? 0.5));
    if (cur.dir === 'row') {
      const wA = rect.w * r;
      rect = step === 'a' ? { ...rect, w: wA } : { x: rect.x + wA, y: rect.y, w: rect.w - wA, h: rect.h };
    } else {
      const hA = rect.h * r;
      rect = step === 'a' ? { ...rect, h: hA } : { x: rect.x, y: rect.y + hA, w: rect.w, h: rect.h - hA };
    }
    cur = cur[step];
  }
  return rect;
}
