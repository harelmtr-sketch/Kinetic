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
