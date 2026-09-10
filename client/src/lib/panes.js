/**
 * panes.js - the split-workspace layout tree.
 *
 * A node is either
 *   { type:'leaf',  id, view }
 *   { type:'split', dir:'row'|'col', ratio, a, b }
 *
 * `layout()` flattens the tree into absolute rectangles (percentages) instead of
 * nested DOM. That matters: if panes were nested divs, splitting a pane would
 * reparent it and React would unmount/remount its contents - killing a running
 * shell or reloading a game preview. Flat siblings + computed rects means a pane
 * survives every split, close and resize around it.
 */

let paneSeq = 100;
export const nextPaneId = () => ++paneSeq;

export function leaf(view, id) {
  return { type: 'leaf', id: id != null ? id : nextPaneId(), view };
}

// Split `targetId` in two, the new pane showing `view`.
export function splitNode(node, targetId, dir, view) {
  if (node.type === 'leaf') {
    if (node.id !== targetId) return node;
    return { type: 'split', dir, ratio: 0.5, a: node, b: leaf(view || node.view) };
  }
  return { ...node, a: splitNode(node.a, targetId, dir, view), b: splitNode(node.b, targetId, dir, view) };
}

// Remove a pane; its sibling takes over the space.
export function closeNode(node, targetId) {
  if (node.type === 'leaf') return node.id === targetId ? null : node;
  const a = closeNode(node.a, targetId);
  const b = closeNode(node.b, targetId);
  if (!a) return b;
  if (!b) return a;
  return { ...node, a, b };
}

export function setNodeView(node, targetId, view) {
  if (node.type === 'leaf') return node.id === targetId ? { ...node, view } : node;
  return { ...node, a: setNodeView(node.a, targetId, view), b: setNodeView(node.b, targetId, view) };
}

// Splitters are identified by their path from the root ('' = root, then 'a'/'b').
export function setNodeRatio(node, path, ratio) {
  if (!path.length) return { ...node, ratio };
  const [head, ...rest] = path;
  return { ...node, [head]: setNodeRatio(node[head], rest, ratio) };
}

export function findLeaf(node, id) {
  if (!node) return null;
  if (node.type === 'leaf') return node.id === id ? node : null;
  return findLeaf(node.a, id) || findLeaf(node.b, id);
}

export function firstLeaf(node) {
  if (!node) return null;
  return node.type === 'leaf' ? node : firstLeaf(node.a);
}

export function countLeaves(node) {
  if (!node) return 0;
  return node.type === 'leaf' ? 1 : countLeaves(node.a) + countLeaves(node.b);
}

const GAP = 3;   // px gutter, matches .ws-splitter width in css

/**
 * Flatten to { panes:[{id,view,rect}], splitters:[{path,dir,rect}] }
 * Rects are percentages of the container, with a small px gutter subtracted so
 * the splitter handle sits between panes rather than on top of their content.
 */
export function layout(node, rect = { x: 0, y: 0, w: 100, h: 100 }, path = [], out = { panes: [], splitters: [] }) {
  if (!node) return out;
  if (node.type === 'leaf') {
    out.panes.push({ id: node.id, view: node.view, rect });
    return out;
  }
  const r = Math.min(0.9, Math.max(0.1, node.ratio ?? 0.5));
  if (node.dir === 'row') {
    const wA = rect.w * r;
    layout(node.a, { x: rect.x, y: rect.y, w: wA, h: rect.h }, [...path, 'a'], out);
    layout(node.b, { x: rect.x + wA, y: rect.y, w: rect.w - wA, h: rect.h }, [...path, 'b'], out);
    out.splitters.push({ path, dir: 'row', rect: { x: rect.x + wA, y: rect.y, w: 0, h: rect.h } });
  } else {
    const hA = rect.h * r;
    layout(node.a, { x: rect.x, y: rect.y, w: rect.w, h: hA }, [...path, 'a'], out);
    layout(node.b, { x: rect.x, y: rect.y + hA, w: rect.w, h: rect.h - hA }, [...path, 'b'], out);
    out.splitters.push({ path, dir: 'col', rect: { x: rect.x, y: rect.y + hA, w: rect.w, h: 0 } });
  }
  return out;
}

export { GAP };
