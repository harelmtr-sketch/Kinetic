import { INIT } from '../data/initialTree';
import { BRANCH_MAP } from '../constants/tree';

export const resolveBranch = (node) => node.branch || BRANCH_MAP[node.id] || (node.isStart ? 'neutral' : 'core');

export const toRGBA = (hex, alpha = 1) => {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const int = parseInt(n, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

export function canUnlock(id, nodes, edges) {
  const p = edges.filter((e) => e.to === id).map((e) => e.from);
  if (!p.length) return false;
  return p.every((pid) => nodes.find((n) => n.id === pid)?.unlocked);
}

export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay; const l = dx * dx + dy * dy;
  if (!l) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

export function segmentIntersectsRect(ax, ay, bx, by, rect) {
  const { left, top, right, bottom } = rect;
  const pointInRect = (x, y) => x >= left && x <= right && y >= top && y <= bottom;
  if (pointInRect(ax, ay) || pointInRect(bx, by)) return true;

  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  const minY = Math.min(ay, by);
  const maxY = Math.max(ay, by);
  if (maxX < left || minX > right || maxY < top || minY > bottom) return false;

  const edgeIntersects = (x1, y1, x2, y2, x3, y3, x4, y4) => {
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (den === 0) return false;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };

  return (
    edgeIntersects(ax, ay, bx, by, left, top, right, top)
    || edgeIntersects(ax, ay, bx, by, right, top, right, bottom)
    || edgeIntersects(ax, ay, bx, by, right, bottom, left, bottom)
    || edgeIntersects(ax, ay, bx, by, left, bottom, left, top)
  );
}

export function normalizeTree(rawTree) {
  return {
    ...INIT,
    ...rawTree,
    nodes: (rawTree?.nodes || INIT.nodes).map((n) => (
      { ...n, branch: resolveBranch(n) }
    )),
    info: { ...INIT.info, ...(rawTree?.info || {}) },
  };
}

export function getTreeStats(tree) {
  const nodes = (tree?.nodes || []).filter((n) => !n.isStart);
  const unlocked = nodes.filter((n) => n.unlocked);
  const byBranch = ['push', 'pull', 'core'].reduce((acc, b) => {
    const branchNodes = nodes.filter((n) => resolveBranch(n) === b);
    const unlockedCount = branchNodes.filter((n) => n.unlocked).length;
    acc[b] = {
      total: branchNodes.length,
      unlocked: unlockedCount,
      pct: branchNodes.length ? Math.round((unlockedCount / branchNodes.length) * 100) : 0,
    };
    return acc;
  }, {});
  const leadingBranch = ['push', 'pull', 'core'].sort((a, b) => byBranch[b].pct - byBranch[a].pct)[0] || 'push';
  const completionPct = nodes.length ? Math.round((unlocked.length / nodes.length) * 100) : 0;
  return { total: nodes.length, unlocked: unlocked.length, completionPct, byBranch, leadingBranch };
}
